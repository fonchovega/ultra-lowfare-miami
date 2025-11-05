// scripts/audit_historico_shapes_v133.js
// Auditoría de formas para data/historico.json — v1.3.3 (revisado)
// Uso: node scripts/audit_historico_shapes_v133.js

import fs from "node:fs";
import path from "node:path";
import { normalizeHistoricoEntryV133 } from "./helpers/normalize_historico_v133.js";

const ROOT = path.resolve(".");
const DATA = path.join(ROOT, "data", "historico.json");
const OUT_UNKNOWN = path.join(ROOT, "data", "historico_unknown_samples.json");

function loadJSON(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

// ---- Detectores tolerantes (solo informativos) ----
function detectShapeLoose(entry) {
  try {
    if (Array.isArray(entry)) {
      // V8 u otras variantes por bloques anidados
      const ok = entry.every(b =>
        b && typeof b === "object" &&
        b.meta &&
        (Array.isArray(b.resultados) || Array.isArray(b.resumen))
      );
      if (ok) return "V8";
      return "unknown-array";
    }

    if (!entry || typeof entry !== "object") return "unknown";

    const hasMeta = !!entry.meta;
    const hasResumen = Array.isArray(entry.resumen);
    const hasResultados = Array.isArray(entry.resultados);
    const hasDetalles = !!entry.detalles;
    const hasTitulo = !!entry.meta?.titulo;

    if (hasTitulo && hasResumen && hasDetalles) return "V5";
    if (hasResumen && (entry.resumen[0]?.salida || entry.resumen[0]?.retorno)) return "V6";
    if (hasResumen && entry.resumen[0]?.destino) return "V7";
    if (hasResultados) return "V1-4";

    // Otras variantes antiguas que traían "historico"/"historico_detallado"
    if (Array.isArray(entry.historico) || Array.isArray(entry.historico_detallado)) return "V1-4*";

    return "unknown";
  } catch {
    return "unknown";
  }
}

// ---- Auditor principal: prioriza el normalizador ----
function main() {
  const raw = loadJSON(DATA);
  const entries = Array.isArray(raw) ? raw : [raw];

  const stats = {
    "V1-4": 0, "V1-4*": 0, V5: 0, V6: 0, V7: 0, V8: 0, recognized_via_normalizer: 0,
    "unknown": 0, "error": 0
  };
  const unknownSamples = [];
  const lines = [];

  entries.forEach((entry, index) => {
    const tag = detectShapeLoose(entry);

    // 1) Intento normalizar SIEMPRE.
    let normBlocks;
    let normErr = null;
    try {
      normBlocks = normalizeHistoricoEntryV133(entry);
    } catch (e) {
      normErr = e;
    }

    const hasValid =
      Array.isArray(normBlocks) &&
      normBlocks.length > 0 &&
      normBlocks.some(b => Array.isArray(b?.resultados) && b.resultados.length > 0 && !b?.meta?._shape);

    if (hasValid) {
      // Contabiliza por tag si es reconocido, si no, cuenta como “recognized_via_normalizer”
      if (stats[tag] !== undefined && tag !== "unknown" && !tag.startsWith("unknown")) {
        stats[tag]++;
        lines.push(`✔ index ${index}: ${tag} (normalizado OK)`);
      } else {
        stats.recognized_via_normalizer++;
        lines.push(`✔ index ${index}: reconocido por normalizador (tag: ${tag})`);
      }
    } else {
      // No se logró normalizar: unknown real
      stats[tag] !== undefined ? stats[tag]++ : stats.unknown++;
      unknownSamples.push({ index, sample: entry });
      const reason = normErr ? `error:${String(normErr?.message || normErr)}` : `tag:${tag}`;
      lines.push(`✖ index ${index}: UNKNOWN (${reason})`);
    }
  });

  fs.writeFileSync(OUT_UNKNOWN, JSON.stringify(unknownSamples, null, 2));

  // Reporte
  const report = [
    "✅ Auditoría v1.3.3 (revisado)",
    `  V1-4  : ${stats["V1-4"]}`,
    `  V1-4* : ${stats["V1-4*"]}`,
    `  V5    : ${stats["V5"]}`,
    `  V6    : ${stats["V6"]}`,
    `  V7    : ${stats["V7"]}`,
    `  V8    : ${stats["V8"]}`,
    `  Reconocidos solo por normalizador: ${stats["recognized_via_normalizer"]}`,
    `  Unknown: ${stats["unknown"]}`,
    "",
    `Muestras desconocidas guardadas en ${path.relative(ROOT, OUT_UNKNOWN)}`,
    "",
    "Detalle:",
    ...lines
  ].join("\n");

  console.log(report);
}

main();
