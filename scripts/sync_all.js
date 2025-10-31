// ======================================================================
// Script: sync_all.js
// Autor: Foncho & GPT-5
// Objetivo: Unificar sincronización de histórico + generar contexto v1.2
// Uso:     node scripts/sync_all.js
// Cambios v1.3.1:
//   - Integra dedupe.js (dedupeHistorico) para asegurar conteo consistente
//   - Usa helper.js para IO y logging
// ======================================================================

import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { readJsonSafe, writeJson, ensureDir, nowIsoUtc, log } from "./helper.js";
import { dedupeHistorico } from "./dedupe.js";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Rutas base
const DATA_PATH = path.join(__dirname, "..", "data.json");
const HIST_PATH = path.join(__dirname, "..", "data", "historico.json");
const CONTEXT_PATH = path.join(__dirname, "..", "data", "historico_contextual_v1.2.json");
const CFG_PATH = path.join(__dirname, "..", "config.json");

log("🚀 Iniciando sincronización total...");

// --- 1) Consolidar histórico: añadir snapshot si no existe
function updateHistorico() {
  const data = readJsonSafe(DATA_PATH, null);
  if (!data) {
    log("⚠️ No se encontró data.json, omitiendo append al histórico.", "WARN");
    return 0;
  }

  let historico = readJsonSafe(HIST_PATH, []);
  const yaExiste = historico.some((item) => item.meta?.generado === data.meta?.generado);

  if (!yaExiste) {
    historico.push(data);
    ensureDir(path.dirname(HIST_PATH));
    writeJson(HIST_PATH, historico);
    log(`✅ Histórico actualizado (${historico.length} snapshots)`);
  } else {
    log("ℹ️ Registro ya existente. No se agregó al histórico.");
  }

  return historico.length;
}

// --- 2) Generar contexto v1.2 con conteo post-dedupe
function generateContext(snapshotsCount) {
  log("🧭 Generando contexto histórico v1.2...");

  const REPO = "fonchovega/ultra-lowfare-miami";
  const cfg = readJsonSafe(CFG_PATH, null);

  let headSha = "n/a";
  try {
    headSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    // está bien si no hay git en el runner
  }

  const payload = {
    meta: {
      tipo: "contextual",
      version_contexto: "v1.2",
      fuente: "ChatGPT_sync + GitHub Actions API",
      fecha_sync: nowIsoUtc(),
      repo: REPO,
      commit: headSha,
    },
    resumen: {
      snapshots_en_historico_json: snapshotsCount,
      ultimo_dedupe: { ejecutado: true, registros_unicos: snapshotsCount },
      config: cfg ?? {},
    },
    artefactos: {
      archivos_clave: [
        "scripts/farebot.js",
        "scripts/historico.js",
        "scripts/rebuild_historico_from_git.js",
        "scripts/dedupe.js",
        "scripts/guard_run.js",
        ".github/workflows/farebot.yml",
        "data/historico.json",
      ],
    },
    bitacora_tecnica: [
      "v1.1: split de data en /data.json y /data/historico.json",
      "v1.2: guard_run + reconstrucción desde Git + dedupe y límites",
      "v1.3.1: helper.js consolidado, dedupe integrado en sync_all",
    ],
  };

  ensureDir(path.dirname(CONTEXT_PATH));
  writeJson(CONTEXT_PATH, payload);
  log(`✅ Contexto v1.2 generado en ${CONTEXT_PATH}`);
}

// --- 3) Flujo principal
const countBefore = updateHistorico();
const dedupeRes = dedupeHistorico(); // asegura unicidad antes de contar para contexto
log(
  `🧹 Dedupe: antes=${dedupeRes.antes} despues=${dedupeRes.despues} removidos=${dedupeRes.removidos}
`);
generateContext(dedupeRes.desde ?? dedupeRes.despues ?? countBefore);
log("🎯 Sincronización completa. Histórico y contexto actualizados.\n");
