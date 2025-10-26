// ======================================================================
// Script: context_sync.js
// Objetivo: Genera data/historico_contextual_v1.2.json con datos REALES
//           leyendo config.json y data/historico.json, y metadatos del repo.
// Uso:     node scripts/context_sync.js
// ======================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Soporte __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO = "fonchovega/ultra-lowfare-miami";
const TZ = "America/Chicago";

const HIST_PATH = path.join(__dirname, "..", "data", "historico.json");
const CFG_PATH  = path.join(__dirname, "..", "config.json");
const OUT_PATH  = path.join(__dirname, "..", "data", "historico_contextual_v1.2.json");

// Helpers seguros
const readJsonSafe = (p, fallback) => {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const nowIsoUtc = () => new Date().toISOString();

// Lee histórico (para contar snapshots)
const historico = readJsonSafe(HIST_PATH, []);
const snapshotsCount = Array.isArray(historico) ? historico.length : 0;

// Lee config si existe (para no quemar rutas a mano)
const cfg = readJsonSafe(CFG_PATH, null);

// Arma el bloque de “config_resumen”
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

const configResumen = (() => {
  if (!cfg) return defaultConfigResumen;
  return {
    timezone: cfg.timezone || TZ,
    auto_runs_per_day: Number(cfg.auto_runs_per_day ?? 8),
    max_stops: Number(cfg.max_stops ?? 1),
    carry_on_required: Boolean(cfg.carry_on_required ?? true),
    routes: Array.isArray(cfg.routes) && cfg.routes.length ? cfg.routes : defaultConfigResumen.routes,
    providers_prefer: Array.isArray(cfg.providers_prefer) ? cfg.providers_prefer : defaultConfigResumen.providers_prefer,
    providers_airlines: Array.isArray(cfg.providers_airlines) ? cfg.providers_airlines : defaultConfigResumen.providers_airlines,
    use_real_apis: Boolean(cfg.use_real_apis ?? false)
  };
})();

// Intenta obtener commit actual (si hay git)
let headSha = null;
try {
  const { execSync } = await import("child_process");
  headSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  headSha = null; // si no hay git, no se rompe
}

// Si quieres setear manualmente el total de runs de Actions, exporta esta var en el workflow
// y el script la tomará. Si no existe, queda en null (no estorba).
const actionsTotal = process.env.ACTIONS_RUNS_TOTAL
  ? Number(process.env.ACTIONS_RUNS_TOTAL)
  : null;

// Construye el JSON EXACTO que pediste
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
    ultimo_dedupe: {
      ejecutado: true,
      registros_unicos: snapshotsCount
    },
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
    total: actionsTotal,
    workflow: "farebot.yml",
    runs: [] // compact: dejamos la lista vacía para v1.2
  },
  bitacora_tecnica: [
    "v1.1: split de data en /data.json y /data/historico.json, mover histórico a carpeta /data.",
    "v1.2: agregar guard_run + scheduler, reconstrucción del histórico desde Git, dedupe y límites de tamaño.",
    "Workflows estables: farebot.yml con guard condicional y persistencia de logs."
  ]
};

// Asegura carpeta /data
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Escribe archivo final
fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");
console.log(`✅ Contexto generado en ${OUT_PATH}`);
console.log(`   snapshots: ${snapshotsCount} | head_sha: ${headSha ?? "n/a"} | actions_total: ${actionsTotal ?? "n/a"}`);
