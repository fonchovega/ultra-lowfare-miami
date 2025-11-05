// scripts/audit_historico_shapes_v133.js
// Auditor de formas para historico.json — v1.3.3
// Uso: node scripts/audit_historico_shapes_v133.js
// Reporta cuántas entradas caen en V1–V8 y recolecta muestras "unknown" en data/historico_unknown_samples.json

import fs from "node:fs";
import path from "node:path";
import { normalizeHistoricoEntryV133 } from "./helpers/normalize_historico_v133.js";

const ROOT = path.resolve(".");
const DATA = path.join(ROOT, "data", "historico.json");
const OUT_UNKNOWN = path.join(ROOT, "data", "historico_unknown_samples.json");

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function detectShape(entry) {
  // devuelvo etiqueta aproximada
  const s = JSON.stringify(entry);
  if (Array.isArray(entry) && entry[0]?.meta && Array.isArray(entry[0]?.resultados)) return "V8";
  if (entry?.meta?.titulo && entry?.detalles && Array.isArray(entry?.resumen)) return "V5";
  if (Array.isArray(entry?.resumen) && entry.resumen[0]?.salida) return "V6";
  if (Array.isArray(entry?.resumen) && entry.resumen[0]?.destino) return "V7";
  if (Array.isArray(entry?.resultados)) return "V1-4";
  return "unknown";
}

function main() {
  const raw = loadJSON(DATA);
  const arr = Array.isArray(raw) ? raw : [raw];

  const stats = { "V1-4": 0, V5: 0, V6: 0, V7: 0, V8: 0, unknown: 0, error: 0 };
  const unknownSamples = [];

  arr.forEach((entry, index) => {
    const tag = detectShape(entry);
    stats[tag] = (stats[tag] || 0) + 1;

    // Si el normalizador dice "unknown/error", guardamos muestra
    const norm = normalizeHistoricoEntryV133(entry);
    const flagged = norm.some(b => (b?.meta?._shape === "unknown" || b?.meta?._shape === "error"));
    if (tag === "unknown" || flagged) {
      if (unknownSamples.length < 50) {
        unknownSamples.push({ index, sample: entry });
      }
    }
  });

  fs.writeFileSync(OUT_UNKNOWN, JSON.stringify(unknownSamples, null, 2));
  const report = [
    "✅ Auditoría v1.3.3",
    `  V1-4: ${stats["V1-4"]}`,
    `  V5  : ${stats["V5"]}`,
    `  V6  : ${stats["V6"]}`,
    `  V7  : ${stats["V7"]}`,
    `  V8  : ${stats["V8"]}`,
    `  unknown: ${stats["unknown"]}`,
    "",
    `Muestras desconocidas guardadas en ${path.relative(ROOT, OUT_UNKNOWN)}`
  ].join("\n");

  console.log(report);
}

main();
