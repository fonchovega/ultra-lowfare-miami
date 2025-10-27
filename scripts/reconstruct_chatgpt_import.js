// ==========================================================
// Script: reconstruct_chatgpt_import.js (v2 - compatible con estructura actual)
// Autor: Foncho & GPT-5
// Objetivo: Reconstruir chatgpt_import.json desde historico.json real
// ==========================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HIST_PATH = path.join(__dirname, "..", "data", "historico.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "chatgpt_import.json");

// Función para leer JSON con fallback
const readJsonSafe = (p, fallback = []) => {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    console.error("⚠️ Error leyendo", p, err.message);
    return fallback;
  }
};

console.log("🚀 Reconstruyendo chatgpt_import.json desde data/historico.json...");

// Leer histórico
const historico = readJsonSafe(HIST_PATH, []);
if (!Array.isArray(historico) || historico.length === 0) {
  console.log("❌ No se encontraron snapshots en historico.json");
  process.exit(0);
}

// Filtrar y mapear datos
const snapshots = historico.map((item) => ({
  fecha: item?.meta?.generado ?? null,
  ruta: item?.resumen?.ruta ?? null,
  precio_encontrado: item?.resumen?.precio_encontrado ?? null,
  cumple: item?.resumen?.cumple ?? null,
  limite: item?.resumen?.limite ?? null,
  fuente: item?.resumen?.fuente ?? null,
  equipaje: item?.resumen?.equipaje ?? null,
  escalas_max: item?.resumen?.escalas_max ?? null,
}));

// Generar resumen
const fechas = snapshots.map((s) => s.fecha).filter(Boolean).sort();
const primera = fechas[0];
const ultima = fechas[fechas.length - 1];

const payload = {
  meta: {
    fuente: "ChatGPT histórico consolidado",
    generado: new Date().toISOString(),
    total_snapshots: snapshots.length,
    ventana: {
      inicio: primera,
      fin: ultima,
    },
  },
  rutas: [...new Set(snapshots.map((s) => s.ruta).filter(Boolean))],
  data: snapshots,
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

console.log(`✅ chatgpt_import.json generado correctamente.`);
console.log(`📊 Total snapshots: ${snapshots.length}`);
console.log(`📁 Archivo: ${OUTPUT_PATH}`);
