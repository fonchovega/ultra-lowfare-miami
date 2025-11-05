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

// Detector informativo (tolerante)
function detectShapeLoose(entry) {
  try {
    if (Array.isArray(entry)) {
      const ok = entry.every(b =>
        b && typeof b === "object" &&
        b.meta &&
        (Array.isArray(b.resultados) || Array.isArray(b.resumen))
      );
      return ok ? "V8" : "unknown-array";
    }

    if (!entry || typeof entry !== "object") return "unknown";

    const hasResumen = Array.isArray(entry.resumen);
    const hasResultados = Array.isArray(entry.resultados);

    if (entry?.meta?.titulo && hasResumen && entry?.detalles) return "V5";
    if (hasResumen && (entry.resumen[0]?.salida || entry.resumen[0]?.retorno)) return "V6";
    if (hasResumen && entry.resumen[0]?.destino) return "V7";
    if (hasResultados) return "V1-4";
    if (Array.isArray(entry.historico) || Array.isArray(entry.historico_detallado)) return "V1-4*";

    return "unknown";
  } catch {
    return "unknown";
  }
}

function main() {
  const raw = loadJSON(DATA);
  const entries = Array.isArray(raw) ? raw : [raw];

  const stats = {
    "V1-4": 0, "V1-4*": 0, V5: 0, V6: 0, V7: 0, V8: 0,
    recognized_via_normalizer: 0, unknown: 0
  };
  const unknownSamples = [];
  const lines = [];

  entries.forEach((entry, index) => {
    const tag = detectShapeLoose(entry);

    let normBlocks = [];
    let normOk = false;
    let normErr = null;

    try {
      normBlocks = normalizeHistoricoEntryV133(entry);
      normOk =
        Array.isArray(normBlocks) &&
        normBlocks.length > 0 &&
        normBlocks.some(b => Array.isArray(b?.resultados) && b.resultados.length > 0);
    } catch (e) {
      normErr = e;
    }

    if (normOk) {
      if (stats[tag] !== undefined && tag !== "unknown" && !tag.startsWith("unknown")) {
        stats[tag]++;
        lines.push(`✔ index ${index}: ${tag} (normalizado OK)`);
      } else {
        stats.recognized_via_normalizer++;
        lines.push(`✔ index ${index}: reconocido por normalizador (tag:${tag})`);
      }
    } else {
      stats.unknown++;
      unknownSamples.push({ index, sample: entry, reason: normErr ? String(normErr?.message || normErr) : `tag:${tag}` });
      lines.push(`✖ index ${index}: UNKNOWN (${normErr ? String(normErr?.message || normErr) : `tag:${tag}`})`);
    }
  });

  fs.writeFileSync(OUT_UNKNOWN, JSON.stringify(unknownSamples, null, 2));

  console.log([
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
    `Muestras desconocidas: data/historico_unknown_samples.json`,
    "",
    "Detalle:",
    ...lines
  ].join("\n"));
}

main();
