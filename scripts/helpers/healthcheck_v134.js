import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const HIST = path.join(ROOT, "data", "historico.json");

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function hasAny(obj, keys) {
  return keys.some(k => Object.prototype.hasOwnProperty.call(obj, k));
}

function summarize() {
  const data = loadJSON(HIST);

  if (!Array.isArray(data)) {
    console.error("ERROR: data/historico.json no es un array");
    process.exit(1);
  }

  const stats = {
    total: data.length,
    withMeta: 0,
    withResumen: 0,
    withDetalles: 0,
    unknownShape: 0,
    issues: 0,
  };

  const problems = [];

  data.forEach((entry, idx) => {
    const hasMeta = entry && typeof entry === "object" && entry.meta;
    const hasResumen = entry && Array.isArray(entry.resumen);
    const hasDetalles = entry && typeof entry.detalles === "object";

    if (hasMeta) stats.withMeta++;
    if (hasResumen) stats.withResumen++;
    if (hasDetalles) stats.withDetalles++;

    if (!hasResumen) {
      stats.unknownShape++;
      problems.push(`❌ Entrada ${idx} sin resumen`);
      return;
    }

    entry.resumen.forEach((r, j) => {
      const isObj = r && typeof r === "object";
      if (!isObj) {
        stats.issues++;
        problems.push(`❌ Entrada ${idx}[${j}] no es un objeto`);
        return;
      }

      const okRoute = hasAny(r, ["ruta", "destino"]);
      const okPrice = hasAny(r, ["precio", "precio_encontrado", "precio_mas_bajo_usd"]);
      const okLimit = hasAny(r, ["umbral", "limite", "umbral_usd"]);
      const okFlag = hasAny(r, ["cumple", "resultado"]);

      if (!okRoute) { stats.issues++; problems.push(`❌ ${idx}[${j}] sin 'ruta/destino'`); }
      if (!okPrice) { stats.issues++; problems.push(`❌ ${idx}[${j}] sin 'precio'`); }
      if (!okLimit) { stats.issues++; problems.push(`❌ ${idx}[${j}] sin 'umbral'`); }
      if (!okFlag) { stats.issues++; problems.push(`❌ ${idx}[${j}] sin 'resultado'`); }
    });
  });

  console.log("== healthcheck_v134 ==");
  console.log("Entradas:", stats.total);
  console.log("Con meta:", stats.withMeta);
  console.log("Con resumen:", stats.withResumen);
  console.log("Con detalles:", stats.withDetalles);
  console.log("Shape desconocido:", stats.unknownShape);
  console.log("Issues:", stats.issues);

  if (problems.length) {
    console.log("— Detalle —");
    problems.slice(0, 300).forEach(line => console.log(line));
  }

  process.exit(0);
}

summarize();
