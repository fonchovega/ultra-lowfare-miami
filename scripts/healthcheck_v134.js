import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const HIST_FILE = path.join(ROOT, "data", "historico.json");
const FIXED_FILE = path.join(ROOT, "data", "historico_fixed.json");
const NORMALIZED_FILE = path.join(ROOT, "data", "historico_normalizado.json");
const UNKNOWN_FILE = path.join(ROOT, "data", "historico_unknown_samples.json");

function loadIfExists(p, fallback = []) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback;
}

function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function runWriter() {
  console.log("== writer_historico_v134_full.js ==");

  const historico = loadIfExists(HIST_FILE, []);
  const fixed = [];
  const unknown = [];

  historico.forEach(entry => {
    // Valid entry?
    const base =
      entry &&
      typeof entry === "object" &&
      Array.isArray(entry.resumen);

    if (!base) {
      unknown.push(entry);
      return;
    }

    // Normalize routes + prices if needed
    const normalizedResumen = entry.resumen.map(r => {
      if (typeof r !== "object") return r;

      return {
        ruta: r.ruta ?? r.rute ?? "-",
        destino: r.destino ?? r.destination ?? "-",
        precio: Number(r.precio ?? r.precio_encontrado ?? r.precio_mas_bajo_usd ?? 0),
        umbral: Number(r.umbral ?? r.limite ?? r.umbral_usd ?? 0),
        cumple: r.cumple ?? r.resultado ?? false,
      };
    });

    fixed.push({
      meta: entry.meta ?? {},
      resumen: normalizedResumen,
      detalles: entry.detalles ?? {},
    });
  });

  saveJSON(FIXED_FILE, fixed);
  saveJSON(UNKNOWN_FILE, unknown);

  console.log("Guardado historico_fixed.json");
  console.log("Guardado historico_unknown_samples.json");
}

runWriter();
