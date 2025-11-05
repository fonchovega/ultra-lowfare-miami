// ===================================================================
// scripts/writer_historico_v133_full.js
// Ultra-LowFare v1.3.3 — Normaliza TODO el histórico y genera:
//   - data/historico_v133_merged.json  (único dataset unificado)
//   - data/historico_audit_v133.json   (resumen de auditoría)
//   - data/historico_unknown_samples.json (muestras no reconocidas)
// Requiere: scripts/helpers/helper.js y scripts/helpers/schema_v133.js
// ===================================================================

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import {
  ensureDir,
  readJsonSafe,
  writeJson,
  logInfo,
  logWarn,
  logError,
  cleanString,
  nowIsoUtc
} from "./helpers/helper.js";

import {
  detectSampleVersion,
  normalizeToV133,
  normalizeHistoricoArray,
  mergeNormalized,
  isValidV133
} from "./helpers/schema_v133.js";

// ---------------------------------------------------------------
// Resolución de rutas base
// ---------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");

const HISTORICO_JSON = path.join(DATA_DIR, "historico.json");
const OUT_MERGED = path.join(DATA_DIR, "historico_v133_merged.json");
const OUT_AUDIT = path.join(DATA_DIR, "historico_audit_v133.json");
const OUT_UNKNOWN = path.join(DATA_DIR, "historico_unknown_samples.json");

// ---------------------------------------------------------------
// Utilidades locales
// ---------------------------------------------------------------
function countBy(arr) {
  var map = {};
  arr.forEach(function(k) {
    var kk = k || "unknown";
    if (!map[kk]) map[kk] = 0;
    map[kk]++;
  });
  return map;
}

function humanTag(vtag) {
  // para compatibilidad con el reporte que has venido viendo
  if (vtag === "V1-4") return "V1-4";
  if (vtag === "V5") return "V5";
  if (vtag === "V6") return "V6";
  if (vtag === "V7") return "V7";
  if (vtag === "V8") return "V8";
  if (vtag === "V1-4*") return "V1-4*";
  if (!vtag) return "unknown";
  return String(vtag);
}

// Clasifica si una muestra normalizada terminó con items vacíos
function isEmptyNormalized(n) {
  return !n || !Array.isArray(n.items) || n.items.length === 0;
}

// ---------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------
function buildAuditReport(samples, normalizedList, detectedTags) {
  var unknownIdx = [];
  var recognizedOnlyByNormalizer = 0; // reservado si luego queremos distinguir heurísticas

  for (var i = 0; i < samples.length; i++) {
    var n = normalizedList[i];
    if (isEmptyNormalized(n)) unknownIdx.push(i);
  }

  var counts = countBy(detectedTags.map(humanTag));

  // Reordena llaves de interés para mostrar primero
  var orderedKeys = ["V1-4", "V1-4*", "V5", "V6", "V7", "V8", "unknown"];
  var summary = {};
  orderedKeys.forEach(function(k) {
    if (counts[k]) summary[k] = counts[k];
    else summary[k] = 0;
  });

  var audit = {
    generated_at: nowIsoUtc(),
    totals: {
      V1_4: summary["V1-4"] || 0,
      V1_4_star: summary["V1-4*"] || 0,
      V5: summary["V5"] || 0,
      V6: summary["V6"] || 0,
      V7: summary["V7"] || 0,
      V8: summary["V8"] || 0,
      recognized_only_by_normalizer: recognizedOnlyByNormalizer,
      unknown: summary["unknown"] || 0
    },
    unknown_indexes: unknownIdx
  };

  return audit;
}

function formatConsoleAudit(audit) {
  var lines = [];
  lines.push("✅ Auditoría v1.3.3 (revisado)");
  lines.push("  V1-4  : " + audit.totals.V1_4);
  lines.push("  V1-4* : " + audit.totals.V1_4_star);
  lines.push("  V5    : " + audit.totals.V5);
  lines.push("  V6    : " + audit.totals.V6);
  lines.push("  V7    : " + audit.totals.V7);
  lines.push("  V8    : " + audit.totals.V8);
  lines.push("  Reconocidos solo por normalizador: " + audit.totals.recognized_only_by_normalizer);
  lines.push("  Unknown: " + audit.totals.unknown);
  lines.push("");
  if (audit.unknown_indexes && audit.unknown_indexes.length > 0) {
    lines.push("Muestras desconocidas: " + path.relative(ROOT, OUT_UNKNOWN));
    lines.push("");
    lines.push("Detalle:");
    audit.unknown_indexes.forEach(function(i) {
      lines.push("✖ index " + i + ": UNKNOWN (tag:unknown)");
    });
  } else {
    lines.push("No hay muestras desconocidas.");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------
// Proceso principal
// ---------------------------------------------------------------
async function main() {
  try {
    await ensureDir(DATA_DIR);

    var historico = await readJsonSafe(HISTORICO_JSON, null);
    if (!historico) {
      logWarn("No se encontró data/historico.json. Nada que normalizar.", "writer_v133");
      return;
    }

    if (!Array.isArray(historico)) {
      logWarn("El archivo historico.json no es un arreglo. Intentando envolverlo...", "writer_v133");
      historico = [historico];
    }

    var total = historico.length;
    logInfo("Cargando " + total + " muestras desde " + path.relative(ROOT, HISTORICO_JSON), "writer_v133");

    // Detecta etiquetas por muestra
    var detectedTags = historico.map(function(entry) {
      try {
        var s = entry && entry.sample ? entry.sample : entry;
        return detectSampleVersion(s);
      } catch (e) {
        return "unknown";
      }
    });

    // Normaliza por muestra (a objeto v1.3.3 cada una)
    var normalizedList = historico.map(function(entry) {
      var s = entry && entry.sample ? entry.sample : entry;
      var norm = normalizeToV133(s);
      if (!isValidV133(norm)) {
        // fallback: marcamos unknown
        norm = {
          version: "v1.3.3",
          meta: { generado: nowIsoUtc(), fuente_version: "UNKNOWN", modo: "live" },
          items: []
        };
      }
      return norm;
    });

    // Genera merged único para front
    var merged = mergeNormalized(normalizedList);
    await writeJson(OUT_MERGED, merged);
    logInfo("Escrito " + path.relative(ROOT, OUT_MERGED) + " con " + merged.items.length + " items.", "writer_v133");

    // Construye muestras "unknown" para inspección
    var unknownSamples = [];
    for (var i = 0; i < historico.length; i++) {
      var tag = detectedTags[i] || "unknown";
      var n = normalizedList[i];
      if (tag === "UNKNOWN" || isEmptyNormalized(n)) {
        unknownSamples.push({
          index: i,
          tag: tag,
          original: historico[i]
        });
      }
    }
    await writeJson(OUT_UNKNOWN, unknownSamples);
    logInfo("Escrito " + path.relative(ROOT, OUT_UNKNOWN) + " (" + unknownSamples.length + " muestras).", "writer_v133");

    // Reporte de auditoría
    var audit = buildAuditReport(historico, normalizedList, detectedTags);
    await writeJson(OUT_AUDIT, audit);
    logInfo("Escrito " + path.relative(ROOT, OUT_AUDIT) + ".", "writer_v133");

    // Salida amigable en consola (mismo formato que vienes viendo)
    var pretty = formatConsoleAudit(audit);
    console.log(pretty);

  } catch (err) {
    logError("Fallo procesando writer_historico_v133_full", "writer_v133", err);
    process.exitCode = 1;
  }
}

main();
