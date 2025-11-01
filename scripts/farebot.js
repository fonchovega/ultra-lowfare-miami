// ============================================================
// scripts/farebot.js
// Modo MOCK simple: genera precios simulados para 3 rutas,
// guarda el snapshot actual en /data/data.json y acumula
// el histórico en /data/historico.json (con tope de entradas).
// ============================================================

import fs from "fs";
import path from "path";

// Rutas de salida (coherentes con el proyecto)
const DATA_DIR   = "./data";
const DATA_PATH  = "./data/data.json";        // snapshot actual
const HIST_PATH  = "./data/historico.json";   // acumulado

// --------------------------
// Helpers mínimos
// --------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// --------------------------
// Función principal (MOCK)
// --------------------------
async function main() {
  console.log("🔎 Iniciando búsqueda de tarifas (MOCK)…");

  // Parámetros de ejemplo
  const routes = [
    { origin: "LIM", destination: "MIA", price_limit: 360 },
    { origin: "LIM", destination: "FLL", price_limit: 360 },
    { origin: "LIM", destination: "MCO", price_limit: 400 },
  ];

  const results = [];

  for (const route of routes) {
    try {
      console.log(`🔍 Buscando ${route.origin} → ${route.destination} (tope $${route.price_limit})`);

      // --- Simulación de precio encontrado (mock) ---
      const simulatedPrice = Math.floor(Math.random() * 550) + 250; // 250..799

      const cumple = simulatedPrice <= route.price_limit;
      const timestamp = new Date().toISOString();

      const record = {
        ruta: `${route.origin} → ${route.destination}`,
        fecha: timestamp,
        precio_encontrado: simulatedPrice,
        cumple: cumple ? "✅ Sí cumple" : "❌ No cumple",
        limite: route.price_limit,
        fuente: "simulación interna (mock)",
        detalles: {
          equipaje: "carry-on only",
          escalas_max: 1,
        },
      };

      results.push(record);
      console.log(`📌 ${route.origin}→${route.destination}: $${simulatedPrice} → ${cumple ? "Cumple" : "No cumple"}`);
    } catch (err) {
      console.error(`❗ Error buscando ${route.origin}-${route.destination}:`, err);
    }
  }

  // Construir snapshot actual
  const snapshot = {
    meta: { generado: new Date().toISOString(), modo: "mock" },
    resultados: results,
  };

  // Guardar snapshot actual
  writeJson(DATA_PATH, snapshot);
  console.log("💾 Snapshot guardado en data/data.json");

  // Actualizar histórico acumulado con tope
  let historico = readJsonSafe(HIST_PATH, []);
  if (!Array.isArray(historico)) {
    console.warn("⚠️ historico.json no era un array; se reinicia.");
    historico = [];
  }

  historico.push(snapshot);

  // Limitar historial (ajustable)
  const MAX_RECORDS = 600;
  if (historico.length > MAX_RECORDS) {
    historico = historico.slice(-MAX_RECORDS);
    console.log(`✂️ Histórico recortado a las últimas ${MAX_RECORDS} ejecuciones.`);
  }

  writeJson(HIST_PATH, historico);
  console.log(`📚 Histórico actualizado (${historico.length} snapshots) en data/historico.json`);

  console.log("✅ Búsqueda finalizada correctamente (MOCK).");
}

main().catch((e) => {
  console.error("❌ Error inesperado en farebot.js:", e);
  process.exit(1);
});
