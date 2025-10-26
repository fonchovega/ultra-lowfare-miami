// scripts/farebot.js
import fs from "fs";

// Si más adelante conectamos APIs reales, descomenta esto:
// import axios from "axios";

const DATA_PATH = "./data/historico.json";

// --------------------------
// Función principal
// --------------------------
async function main() {
  console.log("🔎 Iniciando búsqueda de tarifas...");

  // Parámetros de ejemplo (mock)
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
      const simulatedPrice = Math.floor(Math.random() * 550) + 250;

      const cumple = simulatedPrice <= route.price_limit;
      const timestamp = new Date().toISOString();

      const record = {
        ruta:` ${route.origin} → ${route.destination}`,
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
// Guardar resultados en data.json
try {
  let existingData = [];

  if (fs.existsSync(DATA_PATH)) {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    // Asegurar que existingData sea un arreglo
    if (Array.isArray(parsed)) {
      existingData = parsed;
    } else {
      console.warn("⚠️ data.json no era un array, se reinicia.");
      existingData = [];
    }
  }

  // Agregar nueva corrida
  existingData.push({
    meta: { generado: new Date().toISOString() },
    resultados: results,
  });

// Limitar historial a 600 corridas (ajustable por escalabilidad luego)
    const MAX_RECORDS = 600;
    if (existingData.length > MAX_RECORDS) {
      existingData = existingData.slice(-MAX_RECORDS);
      console.log(`✂️ Data recortada a las últimas ${MAX_RECORDS} ejecuciones.`);
    }

    fs.writeFileSync(DATA_PATH, JSON.stringify(existingData, null, 2), "utf8");
    console.log("💾 Data guardada correctamente en data.json");
  } catch (err) {
    console.error("❗ Error guardando data.json:", err);
  }

  console.log("✅ Búsqueda finalizada correctamente.");
}

main();
