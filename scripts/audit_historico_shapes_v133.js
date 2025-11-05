// scripts/audit_historico_shapes_v133.js
// v1.3.3 — Auditoría de formas/estructuras presentes en data/historico.json
// Uso: node scripts/audit_historico_shapes_v133.js
//
// Salidas:
//   • data/historico_shapes_report.json
//   • data/historico_unknown_samples.json  (sólo si hay desconocidos; el script termina con exit 1)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT, "data");
const SRC_FILE = path.resolve(DATA_DIR, "historico.json");
const REPORT_FILE = path.resolve(DATA_DIR, "historico_shapes_report.json");
const UNKNOWN_FILE = path.resolve(DATA_DIR, "historico_unknown_samples.json");

// Helpers
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o ?? {}, k);

// Detectores de formas
function isFlatV1(x) {
  // { meta:{}, resumen:{} } (típicamente dentro de un array)
  return isObj(x) && isObj(x.meta) && isObj(x.resumen);
}
function isSnapshotV2(x) {
  // { meta:{}, resultados:[...] }
  return isObj(x) && isObj(x.meta) && Array.isArray(x.resultados);
}
function isMixto(x) {
  // { historico:[...], historico_detallado:{...} } (puede tener uno o ambos)
  return isObj(x) && (Array.isArray(x.historico) || isObj(x.historico_detallado));
}
function isRouteBlocks(x) {
  // Objeto cuyas claves parecen rutas y cada valor tiene { bloque, evaluaciones[] }
  if (!isObj(x)) return false;
  // heurística: si alguna clave mapea a objeto con 'bloque' o 'evaluaciones'
  for (const [k, v] of Object.entries(x)) {
    if (!isObj(v)) continue;
    if (has(v, "bloque") || has(v, "evaluaciones")) return true;
  }
  return false;
}

// Clasifica un elemento u objeto raíz
function classifyNode(node) {
  if (isFlatV1(node)) return "flat_v1";
  if (isSnapshotV2(node)) return "snapshot_v2";
  if (isMixto(node)) return "mixto";
  if (isRouteBlocks(node)) return "route_blocks";
  return "unknown";
}

function summarizeUnknownSample(x) {
  // Devuelve una versión recortada para el JSON de muestras desconocidas
  try {
    const str = JSON.stringify(x);
    if (str.length <= 2000) return x;
    // si es muy grande, intenta recortar claves
    if (Array.isArray(x)) return x.slice(0, 3);
    if (isObj(x)) {
      const out = {};
      const keys = Object.keys(x).slice(0, 10);
      for (const k of keys) out[k] = x[k];
      return out;
    }
    return String(x).slice(0, 2000);
  } catch {
    return "[[unserializable]]";
  }
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  let payloadRaw;
  try {
    payloadRaw = await readFile(SRC_FILE, "utf8");
  } catch (e) {
    console.error("❌ No se pudo leer", SRC_FILE, e.message);
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (e) {
    console.error("❌ JSON inválido en", SRC_FILE, e.message);
    process.exit(1);
  }

  const stats = {
    source_file: path.relative(ROOT, SRC_FILE),
    total_nodes: 0,
    kinds: {
      flat_v1: { count: 0, examples: [] },
      snapshot_v2: { count: 0, examples: [] },
      route_blocks: { count: 0, examples: [] },
      mixto: { count: 0, examples: [] },
      unknown: { count: 0, examples: [] },
    },
    inspected_mode: "",
    notes: [
      "flat_v1: items con {meta, resumen}",
      "snapshot_v2: objeto con {meta, resultados[]}",
      "route_blocks: claves por ruta con {bloque, evaluaciones[]}",
      "mixto: {historico[], historico_detallado{}} (uno o ambos)",
      "unknown: no coincide con ninguna de las anteriores",
    ],
  };

  const unknownSamples = [];

  // Inspección tolerante: si el payload es array, clasificamos cada ítem;
  // si es objeto, clasificamos el objeto raíz y, si corresponde, también sus hijos.
  if (Array.isArray(payload)) {
    stats.inspected_mode = "array";
    stats.total_nodes = payload.length;

    payload.forEach((node, idx) => {
      const kind = classifyNode(node);
      stats.kinds[kind].count++;
      if (stats.kinds[kind].examples.length < 3) {
        // guardamos ejemplo mínimo (índice + claves principales)
        const ex = { index: idx };
        if (isObj(node)) ex.keys = Object.keys(node);
        stats.kinds[kind].examples.push(ex);
      }
      if (kind === "unknown" && unknownSamples.length < 20) {
        unknownSamples.push({ index: idx, sample: summarizeUnknownSample(node) });
      }
    });

  } else if (isObj(payload)) {
    stats.inspected_mode = "object";
    stats.total_nodes = 1;

    const rootKind = classifyNode(payload);
    stats.kinds[rootKind].count++;
    stats.kinds[rootKind].examples.push({ root: true, keys: Object.keys(payload) });

    // Si es objeto y no lo clasificamos bien, intentamos mirar “hijos” de primer nivel
    if (rootKind === "unknown") {
      if (isObj(payload)) {
        for (const [k, v] of Object.entries(payload)) {
          const kind = classifyNode(v);
          stats.kinds[kind].count++;
          if (stats.kinds[kind].examples.length < 3) {
            stats.kinds[kind].examples.push({ parentKey: k, keys: isObj(v) ? Object.keys(v) : null });
          }
          if (kind === "unknown" && unknownSamples.length < 20) {
            unknownSamples.push({ parentKey: k, sample: summarizeUnknownSample(v) });
          }
        }
      }
    }

  } else {
    stats.inspected_mode = typeof payload;
    stats.total_nodes = 1;
    stats.kinds.unknown.count = 1;
    unknownSamples.push({ root: true, sample: summarizeUnknownSample(payload) });
  }

  await writeFile(REPORT_FILE, JSON.stringify(stats, null, 2), "utf8");
  let exitCode = 0;

  if (unknownSamples.length) {
    await writeFile(UNKNOWN_FILE, JSON.stringify(unknownSamples, null, 2), "utf8");
    console.error(`❌ Auditoría: se encontraron ${unknownSamples.length} muestras 'unknown'.
Revisa ${path.relative(ROOT, UNKNOWN_FILE)} y ajusta el normalizador si es necesario.`);
    exitCode = 1;
  } else {
    console.log("✅ Auditoría: sin formas desconocidas. Reporte en", path.relative(ROOT, REPORT_FILE));
  }

  process.exit(exitCode);
}

main().catch((e) => {
  console.error("❌ Falla inesperada en auditoría:", e?.message || e);
  process.exit(1);
});
