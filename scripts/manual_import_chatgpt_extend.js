// ======================================================================
// Script: manual_import_chatgpt_extend.js
// Objetivo: Crear un import "extendido" consolidando el histórico actual
//           (data/historico.json) + la config (config.json) en un archivo
//           data/chatgpt_import.json con más contexto y métricas.
//
// Uso:     node scripts/manual_import_chatgpt_extend.js
// Efectos: - Lee data/historico.json (snapshots)
//          - Lee config.json (parámetros del proyecto)
//          - Genera data/chatgpt_import.json con:
//              * meta, resumen global, métricas por ruta
//              * respaldo automático del import previo (si existe)
// ======================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------------------------------------------------
// Utilidades base
// -------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HIST_PATH = path.join(__dirname, "..", "data", "historico.json");
const CFG_PATH  = path.join(__dirname, "..", "config.json");
const OUT_PATH  = path.join(__dirname, "..", "data", "chatgpt_import.json");

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const txt = fs.readFileSync(p, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    return fallback;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ts() {
  return new Date().toISOString();
}

function backupIfExists(p) {
  if (!fs.existsSync(p)) return null;
  const dir = path.dirname(p);
  const base = path.basename(p, ".json");
  const stamp = ts().replace(/[:.]/g, "-");
  const bak = path.join(dir, base + ".bak." + stamp + ".json");
  fs.copyFileSync(p, bak);
  return bak;
}

// -------------------------------------------------------------
// Cargar insumos
// -------------------------------------------------------------
console.log("=== Importación extendida ChatGPT -> chatgpt_import.json ===");

const historico = readJsonSafe(HIST_PATH, []);
const cfg = readJsonSafe(CFG_PATH, null);
if (!Array.isArray(historico) || historico.length === 0) {
  console.log("⚠️  No hay snapshots en data/historico.json. Abortando import extendido.");
  process.exit(0);
}

// Normalizar snapshots (según tu estructura real)
const snapshots = historico.map((item) => {
  const metaGen = item && item.meta ? item.meta.generado : null;
  const r = item && item.resumen ? item.resumen : null;

  return {
    fecha: metaGen || (r && r.fecha) || null,
    ruta: r ? r.ruta : null,
    precio_encontrado: r ? r.precio_encontrado : null,
    cumple: r ? r.cumple : null,
    limite: r ? r.limite : null,
    fuente: r ? r.fuente : null,
    equipaje: r ? r.equipaje : null,
    escalas_max: r ? r.escalas_max : null
  };
}).filter(s => !!s.ruta && !!s.fecha);

// Ordenar por fecha
snapshots.sort(function(a, b) {
  return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
});

// Métricas globales
const fechas = snapshots.map(s => s.fecha);
const primera = fechas.length ? fechas[0] : null;
const ultima = fechas.length ? fechas[fechas.length - 1] : null;

// Agrupar por ruta
const rutasUnicas = Array.from(new Set(snapshots.map(s => s.ruta)));
const porRuta = {};
rutasUnicas.forEach(function(r) {
  porRuta[r] = snapshots.filter(s => s.ruta === r);
});

// Estadísticas por ruta
function buildStats(arr) {
  const precios = arr.map(x => Number(x.precio_encontrado)).filter(n => !isNaN(n));
  const min = precios.length ? Math.min.apply(null, precios) : null;
  const max = precios.length ? Math.max.apply(null, precios) : null;
  const avg = precios.length ? (precios.reduce((a,b) => a + b, 0) / precios.length) : null;
  const total = arr.length;
  const cumple = arr.filter(x => {
    if (typeof x.limite !== "number" || typeof x.precio_encontrado !== "number") return false;
    return x.precio_encontrado <= x.limite;
  }).length;

  const last = total ? arr[arr.length - 1] : null;

  return {
    total_snapshots: total,
    min_precio: min,
    max_precio: max,
    avg_precio: avg !== null ? Math.round(avg * 100) / 100 : null,
    cuenta_cumple: cumple,
    ultimo_snapshot: last
  };
}

const statsPorRuta = {};
rutasUnicas.forEach(function(r) {
  statsPorRuta[r] = buildStats(porRuta[r]);
});

// Resumen de config (no toca FareBot)
const defaultConfigResumen = {
  timezone: "America/Chicago",
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

const configResumen = cfg ? Object.assign({}, defaultConfigResumen, cfg) : defaultConfigResumen;

// Payload extendido
const payload = {
  meta: {
    fuente: "ChatGPT extendido (consolidado desde historico.json + config.json)",
    generado: ts(),
    ventana: { inicio: primera, fin: ultima }
  },
  resumen: {
    total_snapshots: snapshots.length,
    rutas: rutasUnicas,
    stats_por_ruta: statsPorRuta,
    config_resumen: configResumen
  },
  data: snapshots
};

// Respaldar archivo previo si existe
ensureDir(path.dirname(OUT_PATH));
const bak = backupIfExists(OUT_PATH);
if (bak) {
  console.log("Respaldo creado de chatgpt_import.json -> " + bak);
}

// Grabar import extendido
fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");

console.log("✅ Import extendido generado: " + OUT_PATH);
console.log("📊 Total snapshots: " + snapshots.length);
console.log("🗂  Rutas: " + rutasUnicas.join(", "));
