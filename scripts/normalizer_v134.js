import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const FIXED_FILE = path.join(ROOT, "data", "historico_fixed.json");
const NORMALIZED_FILE = path.join(ROOT, "data", "historico_normalizado.json");

function normalize() {
  console.log("== normalizer_v134 ==");

  const fixed = fs.existsSync(FIXED_FILE)
    ? JSON.parse(fs.readFileSync(FIXED_FILE, "utf8"))
    : [];

  const normalized = fixed.map(entry => {
    return {
      meta: entry.meta,
      resumen: entry.resumen.map(r => ({
        ruta: r.ruta,
        destino: r.destino,
        precio: r.precio,
        umbral: r.umbral,
        cumple: r.cumple,
      })),
      detalles: entry.detalles,
    };
  });

  fs.writeFileSync(NORMALIZED_FILE, JSON.stringify(normalized, null, 2));

  console.log("✔ historico_normalizado.json actualizado");
}

normalize();
