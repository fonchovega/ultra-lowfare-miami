// ======================================================================
// Script: sync_all.js
// Autor: Foncho & GPT-5
// Objetivo: Unificar sincronización de contexto (v1.2) + actualización de histórico
// Uso:     node scripts/sync_all.js
// ======================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas base
const DATA_PATH = path.join(__dirname, "..", "data.json");
const HIST_PATH = path.join(__dirname, "..", "data", "historico.json");
const CONTEXT_PATH = path.join(__dirname, "..", "data", "historico_contextual_v1.2.json");
const CFG_PATH = path.join(__dirname, "..", "config.json");

// Utilitarios
const readJsonSafe = (p, fallback = {}) => {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};
const nowIsoUtc = () => new Date().toISOString();
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

// --- 1️⃣  Consolidar histórico ---
function updateHistorico() {
  console.log("📘 Actualizando histórico...");
  const data = readJsonSafe(DATA_PATH, null);
  if (!data) {
    console.log("⚠️ No se encontró data.json, omitiendo.");
    return 0;
  }

  let historico = readJsonSafe(HIST_PATH, []);
  const yaExiste = historico.some((item) => item.meta?.generado === data.meta?.generado);

  if (!yaExiste) {
    historico.push(data);
    ensureDir(path.dirname(HIST_PATH));
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log(`✅ Histórico actualizado (${historico.length} snapshots)`);
  } else {
    console.log("ℹ️ Registro ya existente. No se agregó al histórico.");
  }
  return historico.length;
}

// --- 2️⃣  Generar contexto v1.2 ---
function generateContext(snapshotsCount) {
  console.log("🧭 Generando contexto histórico v1.2...");

  const REPO = "fonchovega/ultra-lowfare-miami";
  const TZ = "America/Chicago";
  const cfg = readJsonSafe(CFG_PATH, null);

  // Config por defecto
  const defaultConfigResumen = {
    timezone: TZ,
    auto_runs_per_day: 8,
    max_stops: 1,
    carry_on_required: true,
    routes: [
      { label: "LIM ⇄ FLL", dst: "FLL", depart: "2026-02-15", return: ["2026-02-20", "2026-02-21"], umbral: 360 },
      { label: "LIM ⇄ MIA", dst: "MIA", depart: "2026-02-15", return: ["2026-02-20", "2026-02-21"], umbral: 360 },
      { label: "LIM ⇄ MCO", dst: "MCO", depart: "2026-02-15", return: ["2026-02-20", "2026-02-21"], umbral: 400 }
    ],
    providers_prefer: ["kayak", "skyscanner", "expedia"],
    providers_airlines: ["avianca", "copa", "latam", "aa", "jetblue", "spirit"],
    use_real_apis: false
  };

  const configResumen = {
    ...defaultConfigResumen,
    ...(cfg || {})
  };

  // Obtener commit actual
  let headSha = null;
  try {
    headSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    headSha = "n/a";
  }

  const payload = {
    meta: {
      tipo: "contextual",
      version_contexto: "v1.2",
      fuente: "ChatGPT_sync + GitHub Actions API",
      fecha_sync: nowIsoUtc(),
      repo: REPO
    },
    resumen: {
      snapshots_en_historico_json: snapshotsCount,
      ultimo_dedupe: { ejecutado: true, registros_unicos: snapshotsCount },
      config_resumen: configResumen
    },
    artefactos: {
      archivos_clave: [
        "scripts/farebot.js",
        "scripts/historico.js",
        "scripts/rebuild_historico_from_git.js",
        "scripts/dedupe.js",
        "scripts/guard_run.js",
        ".github/workflows/farebot.yml",
        "data/historico.json"
      ]
    },
    ejecuciones_actions: {
      total: null,
      workflow: "farebot.yml",
      runs: []
    },
    bitacora_tecnica: [
      "v1.1: split de data en /data.json y /data/historico.json, mover histórico a carpeta /data.",
      "v1.2: agregar guard_run + scheduler, reconstrucción del histórico desde Git, dedupe y límites de tamaño.",
      "Workflows estables: farebot.yml con guard condicional y persistencia de logs."
    ]
  };

  ensureDir(path.dirname(CONTEXT_PATH));
  fs.writeFileSync(CONTEXT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`✅ Contexto v1.2 generado en ${CONTEXT_PATH}`);
}

// --- 3️⃣  Ejecución completa ---
console.log("🚀 Iniciando sincronización total...");
const totalSnapshots = updateHistorico();
generateContext(totalSnapshots);
console.log("🎯 Sincronización completa. Histórico y contexto actualizados.\n");
