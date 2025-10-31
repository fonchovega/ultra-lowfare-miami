// ============================================================
// sync_all.js — Sincroniza histórico y contexto (v1.3.1)
// ============================================================

import path from "path";
import { fileURLToPath } from "url";

import {
  readJsonSafe,
  writeJson,
  ensureDir,
  readFileSafe,
  writeFileSafe,
  nowIsoUtc,
  log,
} from "./helper.js";

import { dedupeHistorico } from "./dedupe.js";

// ---------------------------------------------
// ESM-safe __filename / __dirname
// ---------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------
// Rutas
// ---------------------------------------------
const BASE_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(BASE_DIR, "data");
const LOGS_DIR = path.join(BASE_DIR, "logs");
const OUTPUTS_DIR = path.join(BASE_DIR, "outputs");

const DATA_PATH = path.join(BASE_DIR, "data.json"); // si existe
const HIST_PATH = path.join(DATA_DIR, "historico.json");
const CONTEXT_PATH = path.join(DATA_DIR, "historico_contextual_v1.2.json");
const DEV_NOTES = path.join(BASE_DIR, "dev_notes.md");

// ---------------------------------------------
// Flags
// ---------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function header(msg) {
  log(`🚀 ${msg}`);
}

function writeDevNotes(lines = []) {
  const stamp = nowIsoUtc();
  const content = [
    `## Sync @ ${stamp}`,
    ...lines.map((l) => `- ${l}`),
    "",
  ].join("\n");
  const prev = readFileSafe(DEV_NOTES, "");
  writeFileSafe(DEV_NOTES, prev ? `${prev}\n${content}` : content);
}

// ---------------------------------------------
// 1) Cargar / construir histórico base
// ---------------------------------------------
function loadHistorico() {
  // prioridad: data/historico.json, luego data.json.historico, luego []
  const directo = readJsonSafe(HIST_PATH, null);
  if (Array.isArray(directo)) return directo;

  const rootData = readJsonSafe(DATA_PATH, null);
  if (rootData && Array.isArray(rootData.historico)) return rootData.historico;

  return [];
}

// ---------------------------------------------
// 2) Generar contexto v1.2
// ---------------------------------------------
function generateContext(historico = []) {
  const payload = {
    meta: {
      generado: nowIsoUtc(),
      version: "1.2",
      total_snapshots: historico.length,
    },
    bitacora_tecnica: [
      "v1.1: split de data en /data.json y /data/historico.json",
      "v1.2: guard_run + reconstrucción desde Git + dedupe y notas",
      "v1.3.1: helper.js consolidado y logs con backticks",
    ],
  };

  ensureDir(path.dirname(CONTEXT_PATH));
  writeJson(CONTEXT_PATH, payload);
  log(`✅ Contexto v1.2 generado en ${CONTEXT_PATH}`);
}

// ---------------------------------------------
// 3) Flujo principal
// ---------------------------------------------
(async function main() {
  header("Iniciando sincronización total…");

  // Asegura carpetas
  [DATA_DIR, LOGS_DIR, OUTPUTS_DIR].forEach(ensureDir);

  // Carga histórico actual
  let historico = loadHistorico();
  log(`📦 Histórico base: ${historico.length} snapshots`);

  // Dedupe
  const dedupeRes = dedupeHistorico(historico);
  log(`🧹 Dedupe: antes=${dedupeRes.antes} despues=${dedupeRes.despues} removidos=${dedupeRes.removidos}`);
  historico = dedupeRes.data;

  // Persistencia (omitida si DRY_RUN)
  if (DRY_RUN) {
    log(`🧪 DRY-RUN activo: no se escriben archivos`);
  } else {
    ensureDir(path.dirname(HIST_PATH));
    writeJson(HIST_PATH, historico);
    log(`✅ Histórico actualizado (${historico.length} snapshots)`);
  }

  // Generar contexto
  generateContext(historico);

  // dev_notes.md
  writeDevNotes([
    `Snapshots: ${historico.length}`,
    `Dedupe: -${dedupeRes.removidos}`,
    `Contexto: ${path.relative(BASE_DIR, CONTEXT_PATH)}`,
    DRY_RUN ? "Modo: DRY-RUN" : "Modo: real",
  ]);

  log(`🎯 Listo.`);
})();
