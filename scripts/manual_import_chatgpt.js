// ======================================================================
// Script: manual_import_chatgpt.js
// Autor: Foncho & GPT-5
// Objetivo: Importación MANUAL y SEGURA de histórico proveniente de ChatGPT
//           Fusiona con data/historico.json SIN tocar FareBot ni su cron.
// Uso:     node scripts/manual_import_chatgpt.js
// Requiere: "type": "module" en package.json
// ======================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -----------------------------------------------
// 0) Utilidades base
// -----------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR      = path.join(__dirname, "..", "data");
const HIST_PATH     = path.join(DATA_DIR, "historico.json");
const CONTEXT_FULL  = path.join(DATA_DIR, "historico_contextual_full.json");
const BACKUP_DIR    = DATA_DIR; // guardamos backups en /data

function nowIso() {
  return new Date().toISOString();
}
function stampForFilename(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const Y = d.getUTCFullYear();
  const M = pad(d.getUTCMonth() + 1);
  const D = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const m = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  return `${Y}${M}${D}_${h}${m}${s}Z`;
}
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// -----------------------------------------------
// 1) PEGAR AQUÍ LA CARGA DE CHATGPT (si la hay)
//    Si no tienes nada que importar aún, déjalo como [].
//    Estructura esperada: arreglo de snapshots del mismo formato
//    que data.json (con meta.generado único por snapshot).
// -----------------------------------------------
const CHATGPT_IMPORT = [
  // EJEMPLO (opcional):
  // {
  //   "meta": {
  //     "ruta": "LIM-FLL",
  //     "generado": "2025-10-26T10:00:00.000Z",
  //     "proveedor": "kayak",
  //     "umbral": 360
  //   },
  //   "resultados": [
  //     {
  //       "precio_total_pp": 355,
  //       "moneda": "USD",
  //       "cumple": true,
  //       "salida": "2026-02-15",
  //       "retorno": "2026-02-20",
  //       "paradas": 1,
  //       "carry_on": true,
  //       "link": "https://…"
  //     }
  //   ]
  // }
];

// -----------------------------------------------
// 2) Cargar histórico actual y hacer backup
// -----------------------------------------------
console.log("🔄 Importación manual desde ChatGPT iniciada…");

ensureDir(DATA_DIR);

const historicoActual = readJsonSafe(HIST_PATH, []);
const antes = historicoActual.length;

const backupName = path.join(
  BACKUP_DIR,
  `historico_backup_${stampForFilename()}.json`
);
if (fs.existsSync(HIST_PATH)) {
  fs.copyFileSync(HIST_PATH, backupName);
  console.log(`🗂️  Backup creado: ${backupName}`);
} else {
  console.log("ℹ️  No existía data/historico.json; se creará desde cero.");
}

// -----------------------------------------------
// 3) Fusionar sin duplicados por meta.generado
// -----------------------------------------------
const llave = (snap) => String(snap?.meta?.generado ?? "");
const indice = new Map();
historicoActual.forEach((snap) => {
  const k = llave(snap);
  if (k) indice.set(k, true);
});

let agregados = 0;
for (const snap of CHATGPT_IMPORT) {
  const k = llave(snap);
  if (!k) continue; // ignorar entradas sin stamp
  if (!indice.has(k)) {
    historicoActual.push(snap);
    indice.set(k, true);
    agregados++;
  }
}

// -----------------------------------------------
// 4) Ordenar por fecha meta.generado asc
// -----------------------------------------------
historicoActual.sort((a, b) => {
  const ta = Date.parse(a?.meta?.generado ?? 0);
  const tb = Date.parse(b?.meta?.generado ?? 0);
  return ta - tb;
});

// -----------------------------------------------
// 5) Guardar histórico fusionado y contexto "full"
// -----------------------------------------------
fs.writeFileSync(HIST_PATH, JSON.stringify(historicoActual, null, 2), "utf8");

const payloadFull = {
  meta: {
    tipo: "contextual_full",
    version_contexto: "v1.2",
    fuente: "ChatGPT_manual_import + GitHub",
    fecha_sync: nowIso(),
    repo: "fonchovega/ultra-lowfare-miami"
  },
  resumen: {
    registros_antes: antes,
    importados_desde_chatgpt: agregados,
    registros_totales: historicoActual.length,
    dedupe_por: "meta.generado",
    observacion: "Este merge NO altera FareBot ni su cron; es manual y seguro."
  },
  referencias: {
    historico_json: "data/historico.json",
    backup_ultimo: fs.existsSync(backupName) ? path.basename(backupName) : null
  }
};

fs.writeFileSync(CONTEXT_FULL, JSON.stringify(payloadFull, null, 2), "utf8");

// -----------------------------------------------
// 6) Salida
// -----------------------------------------------
console.log("✅ Importación manual completada.");
console.log(`   • Registros previos: ${antes}`);
console.log(`   • Agregados desde ChatGPT: ${agregados}`);
console.log(`   • Total ahora: ${historicoActual.length}`);
console.log(`   • Histórico: ${HIST_PATH}`);
console.log(`   • Contexto full: ${CONTEXT_FULL}`);
