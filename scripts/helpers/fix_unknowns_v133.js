// scripts/helpers/fix_unknowns_v133.js
// Limpieza automática de Unknown en data/historico.json
// Uso:
//   node scripts/helpers/fix_unknowns_v133.js --dry     (solo muestra cambios)
//   node scripts/helpers/fix_unknowns_v133.js --apply   (aplica cambios en disco)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeHistoricoEntryV133 } from "./normalize_historico_v133.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "../../");
const F_HIST = path.join(ROOT, "data", "historico.json");
const F_UNK  = path.join(ROOT, "data", "historico_unknown_samples.json");
const MODE_APPLY = process.argv.includes("--apply");
const MODE_DRY   = process.argv.includes("--dry") || !MODE_APPLY;

function readJSON(fp) {
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}
function writeJSON(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), "utf8");
}
function ensureArray(x) {
  return Array.isArray(x) ? x : [x];
}
function isPlainObject(o) {
  return o && typeof o === "object" && !Array.isArray(o);
}

// Heurística: “dashboard shape” = { meta:{...}, resumen:[...] }
function isDashboardShape(entry) {
  return (
    isPlainObject(entry) &&
    isPlainObject(entry.meta) &&
    Array.isArray(entry.resumen)
  );
}

// Convierte un “dashboard shape” a bloques canónicos v1.3.3
function dashboardToCanonicalBlocks(entry) {
  const meta = entry.meta || {};
  const gen = String(meta.generado || meta.fecha || new Date().toISOString());
  const zona = String(meta.zona_horaria || meta.tz || "UTC");

  const blocks = [];
  for (const r of entry.resumen) {
    if (!r) continue;

    // RUTA
    let ruta = r.ruta || `${r.origen || ""} ⇄ ${r.destino || ""}`.trim();
    ruta = String(ruta || "N/A").replace(/\s+/g, " ").trim();

    // FECHA
    // Preferimos meta.generado si viene en local (CST, etc.). Guardamos ISO.
    let fechaIso;
    try {
      const tryDate = new Date(gen);
      fechaIso = Number.isFinite(+tryDate) ? tryDate.toISOString() : new Date().toISOString();
    } catch {
      fechaIso = new Date().toISOString();
    }

    // PRECIO & LIMITE
    const precio = Number(r.precio ?? r.precio_mas_bajo_usd ?? r.precio_min ?? r.minimo ?? NaN);
    const limite = Number(r.umbral ?? r.umbral_usd ?? NaN);

    // CUMPLE
    const cumpleTxt = String(r.cumple ?? r.resultado ?? "").toLowerCase();
    const cumple =
      cumpleTxt.includes("cumple") && !cumpleTxt.includes("no ")
        ? "Cumple"
        : "No cumple";

    // FUENTE y DETALLES (si están en un “detalles” por ruta)
    let fuente = r.fuente || meta.fuente || "dash";
    let detalles = {};
    if (entry.detalles && entry.detalles[ruta] && entry.detalles[ruta].evaluaciones) {
      const ev = entry.detalles[ruta].evaluaciones;
      detalles = { evaluaciones: ev };
      // si alguna evaluación trae fuente útil, la pegamos como referencia de salida
      const evFuente = ev.find(e => e && e.fuente);
      if (evFuente && evFuente.fuente) fuente = evFuente.fuente;
    }

    // Resultado canónico por ruta
    const block = {
      meta: { generado: fechaIso, zona_horaria: zona },
      resultados: [
        {
          ruta,
          fecha: fechaIso,
          precio_encontrado: Number.isFinite(precio) ? precio : undefined,
          limite: Number.isFinite(limite) ? limite : undefined,
          cumple,
          fuente,
          detalles,
        },
      ],
    };
    blocks.push(block);
  }
  return blocks;
}

// Intenta normalizar una entrada; si falla, aplica heurísticas
function normalizeOrGuess(entry) {
  try {
    const out = normalizeHistoricoEntryV133(entry);
    if (out && (Array.isArray(out) || isPlainObject(out))) return out;
  } catch (_) {
    // caemos a heurística
  }

  if (isDashboardShape(entry)) {
    const blocks = dashboardToCanonicalBlocks(entry);
    if (blocks.length) return blocks;
  }

  // sin suerte
  return null;
}

// MAIN
(function main() {
  const historico = readJSON(F_HIST);
  const unknownDump = fs.existsSync(F_UNK) ? readJSON(F_UNK) : [];

  let kept = [];
  let dropped = [];
  let converted = 0;
  let unchanged = 0;

  for (let i = 0; i < historico.length; i++) {
    const entry = historico[i];
    const normalized = normalizeOrGuess(entry);

    if (normalized) {
      // Si la normalización devolvió un array de bloques, los expandimos
      const blocks = ensureArray(normalized).filter(Boolean);
      kept.push(...blocks);
      converted += 1;
    } else {
      // Unknown persistente
      dropped.push({ index: i, sample: entry, reason: "Unrecognized shape" });
      if (!MODE_DRY) unknownDump.push({ index: i, sample: entry });
    }
  }

  // Reporte
  console.log("=== fix_unknowns_v133 ===");
  console.log(`Entradas totales:   ${historico.length}`);
  console.log(`Normalizadas/OK:    ${historico.length - dropped.length}`);
  console.log(`Convertidas (heur): ${converted}`);
  console.log(`Unknown restantes:  ${dropped.length}`);
  console.log(`Modo:               ${MODE_DRY ? "DRY-RUN" : "APPLY"}`);

  if (dropped.length) {
    console.log("\nUnknown (primeros 5):");
    for (const d of dropped.slice(0, 5)) {
      const keys = isPlainObject(d.sample) ? Object.keys(d.sample) : typeof d.sample;
      console.log(` - index ${d.index}: keys=${JSON.stringify(keys)}`);
    }
  }

  if (!MODE_DRY) {
    // Guardamos el nuevo historico (solo kept)
    writeJSON(F_HIST, kept);
    // Guardamos/actualizamos el dump de unknowns
    writeJSON(F_UNK, unknownDump);
    console.log(`\nGuardado:\n - ${F_HIST}\n - ${F_UNK}`);
  } else {
    console.log("\n(Sin cambios en disco. Usa --apply para aplicar.)");
  }
})();
