// ======================================================================
// Script: reconstruct_chatgpt_import.js
// Objetivo: Construir data/chatgpt_import.json con snapshots REALES
//           (15–27 oct 2025) a partir de:
//           a) data/historico.json (si existe y tiene snapshots)
//           b) data.json encontrado en commits del repo (git history)
//           -> NUNCA inventa precios. Solo usa lo que realmente esté.
// Uso:
//   node scripts/reconstruct_chatgpt_import.js
// Requisitos:
//   - "type": "module" en package.json
//   - git instalado en el entorno (para leer historia de commits)
// ======================================================================

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR         = path.join(__dirname, "..", "data");
const HIST_FILE        = path.join(DATA_DIR, "historico.json");
const DATA_FILE        = path.join(__dirname, "..", "data.json");
const OUTPUT_IMPORT    = path.join(DATA_DIR, "chatgpt_import.json");

// Ventana de fechas a reconstruir (UTC)
const START_ISO = "2025-10-15T00:00:00.000Z";
const END_ISO   = "2025-10-28T00:00:00.000Z"; // exclusive

// Rutas válidas y umbrales (para etiquetar)
const RUTAS = {
  "LIM-FLL": 360,
  "LIM-MIA": 360,
  "LIM-MCO": 400
};

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseJSONSafe(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function inWindow(iso) {
  const t = Date.parse(iso);
  return t >= Date.parse(START_ISO) && t < Date.parse(END_ISO);
}

function rutaFromMeta(meta) {
  // intenta inferir ruta desde meta.ruta o meta.origen/destino
  if (meta?.ruta) return meta.ruta;
  if (meta?.origen && meta?.destino) return `${meta.origen}-${meta.destino}`;
  return null;
}

function toSnapshot(obj) {
  // Normaliza un data.json a snapshot
  // Espera formato: { meta: {...}, resultados: [...] }
  if (!obj?.meta || !obj?.resultados) return null;
  const ruta = rutaFromMeta(obj.meta);
  if (!ruta || !RUTAS[ruta]) return null;

  return {
    meta: {
      ruta,
      generado: obj.meta.generado || obj.meta.fecha || obj.meta.timestamp || null,
      proveedor: obj.meta.proveedor || obj.meta.fuente || "repo",
      umbral: RUTAS[ruta]
    },
    resultados: obj.resultados
  };
}

function byGeneratedAsc(a, b) {
  const ta = Date.parse(a?.meta?.generado || 0);
  const tb = Date.parse(b?.meta?.generado || 0);
  return ta - tb;
}

function uniqueByGenerated(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const k = s?.meta?.generado;
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

function loadFromHistorico() {
  if (!fs.existsSync(HIST_FILE)) return [];
  const raw = fs.readFileSync(HIST_FILE, "utf8");
  const list = parseJSONSafe(raw);
  if (!Array.isArray(list)) return [];
  const snaps = [];
  for (const item of list) {
    const s = toSnapshot(item);
    if (!s) continue;
    if (!s.meta.generado) continue;
    if (!inWindow(s.meta.generado)) continue;
    snaps.push(s);
  }
  return snaps;
}

function loadFromWorkingDataJson() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const obj = parseJSONSafe(raw);
  if (!obj) return [];
  const s = toSnapshot(obj);
  if (!s) return [];
  if (!s.meta.generado) return [];
  if (!inWindow(s.meta.generado)) return [];
  return [s];
}

function loadFromGitHistory() {
  // Recorre commits recientes y extrae data.json si existe en cada commit
  // Filtra por ventana 2025-10-15 .. 2025-10-27
  const snaps = [];
  try {
    // Lista commits con fecha ISO
    const log = execSync('git log --since="2025-10-14" --until="2025-10-28" --pretty=format:%H', { encoding: "utf8" });
    const shas = log.split("\n").map(s => s.trim()).filter(Boolean);
    for (const sha of shas) {
      try {
        const content = execSync(`git show ${sha}:data.json`, { encoding: "utf8" });
        const obj = parseJSONSafe(content);
        if (!obj) continue;
        const s = toSnapshot(obj);
        if (!s) continue;
        if (!s.meta.generado) continue;
        if (!inWindow(s.meta.generado)) continue;
        snaps.push(s);
      } catch {
        // en ese commit quizá no existía data.json → ignorar
      }
    }
  } catch {
    // si git no está disponible o no hay historia → ignorar
  }
  return snaps;
}

function main() {
  ensureDir(DATA_DIR);

  const A = loadFromHistorico();         // desde data/historico.json
  const B = loadFromWorkingDataJson();   // desde data.json en el árbol actual
  const C = loadFromGitHistory();        // desde commits (exacto por fecha)

  let all = [...A, ...B, ...C];

  // Filtrar por rutas esperadas (por seguridad)
  all = all.filter(s => !!s?.meta?.ruta && RUTAS[s.meta.ruta]);

  // Unicos por meta.generado (valor exacto)
  all = uniqueByGenerated(all);

  // Orden ascendente por fecha
  all.sort(byGeneratedAsc);

  // Guardar resultado
  fs.writeFileSync(OUTPUT_IMPORT, JSON.stringify(all, null, 2), "utf8");

  console.log("✅ chatgpt_import.json reconstruido con snapshots REALES.");
  console.log(`   • Ventana: ${START_ISO} .. ${END_ISO} (UTC)`);
  console.log(`   • Rutas: ${Object.keys(RUTAS).join(", ")}`);
  console.log(`   • Total snapshots: ${all.length}`);
  console.log(`   • Archivo: ${OUTPUT_IMPORT}`);
}

main();
