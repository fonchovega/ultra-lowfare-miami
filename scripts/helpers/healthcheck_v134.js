// healthcheck_v134.js — Standalone CLI script
// --------------------------------------------
// Valida el archivo data/historico.json y reporta:
// - Campos obligatorios faltantes
// - Shapes desconocidos
// - Estructuras inválidas dentro de resumen
// - Estadísticas útiles para diagnóstico
//

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const HIST = path.join(ROOT, "data", "historico.json");

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("❌ ERROR leyendo JSON:", filePath);
    console.error(err);
    process.exit(1);
  }
}

function hasKeys(obj, keys) {
  return keys.every(k => Object.prototype.hasOwnProperty.call(obj, k));
}

function runHealthcheck() {
  console.log("\n=== 💉 HealthCheck v134 ===");

  const data = loadJSON(HIST);

  if (!Array.isArray(data)) {
    console.error("❌ ERROR: historico.json no es un array.");
    process.exit(1);
  }

  const stats = {
    total: data.length,
    withMeta: 0,
    withResumen: 0,
    withDetalles: 0,
    unknownShape: 0,
    resumeIssues: 0,
    entriesWithIssues: 0,
  };

  const problems = [];

  data.forEach((entry, idx) => {
    const hasMeta = entry && typeof entry.meta === "object";
    const hasResumen = entry && Array.isArray(entry.resumen);
    const hasDetalles = entry && typeof entry.detalles === "object";

    if (hasMeta) stats.withMeta++;
    if (hasResumen) stats.withResumen++;
    if (hasDetalles) stats.withDetalles++;

    // Detectar shapes desconocidos (sin resumen)
    if (!hasResumen) {
      stats.unknownShape++;
      problems.push(`[#${idx}] Entrada sin 'resumen' (shape desconocido)`);
      return;
    }

    // Validación interna de cada resumen
    entry.resumen.forEach((r, j) => {
      if (!r || typeof r !== "object") {
        stats.resumeIssues++;
        problems.push(`[#${idx}][${j}] 'resumen' no es objeto`);
        return;
      }

      const okRoute = hasKeys(r, ["ruta", "destino"]);
      const okPrice = hasKeys(r, ["precio", "precio_encontrado", "precio_mas_bajo_usd"]);
      const okLimit = hasKeys(r, ["umbral", "limite", "umbral_usd"]);
      const okFlag = hasKeys(r, ["cumple", "resultado"]);

      if (!okRoute)
        problems.push(`[#${idx}][${j}] falta campo ruta/destino`);
      if (!okPrice)
        problems.push(`[#${idx}][${j}] falta campo de precio`);
      if (!okLimit)
        problems.push(`[#${idx}][${j}] falta campo umbral`);
      if (!okFlag)
        problems.push(`[#${idx}][${j}] falta indicador cumple/resultado`);

      if (!okRoute || !okPrice || !okLimit || !okFlag) {
        stats.entriesWithIssues++;
      }
    });
  });

  console.log(`\n📊 ESTADÍSTICAS`);
  console.log(`- Total entradas:           ${stats.total}`);
  console.log(`- Con meta:                 ${stats.withMeta}`);
  console.log(`- Con resumen:              ${stats.withResumen}`);
  console.log(`- Con detalles:             ${stats.withDetalles}`);
  console.log(`- Shapes desconocidos:      ${stats.unknownShape}`);
  console.log(`- Problemas en resumen:     ${stats.resumeIssues}`);
  console.log(`- Entradas con issues:      ${stats.entriesWithIssues}`);

  if (problems.length > 0) {
    console.log("\n⚠️  DETALLES (primeros 1000):");
    problems.slice(0, 1000).forEach((p) => console.log(" - " + p));
    console.log(`\n❌ Healthcheck encontró ${problems.length} problemas.`);
    process.exit(1);
  }

  console.log("\n✅ Healthcheck OK — Sin problemas detectados.");
  process.exit(0);
}

// Ejecutar directamente
runHealthcheck();
