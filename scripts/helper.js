// ============================================================
// scripts/farebot.js (MOCK) — guarda snapshot atómico y histórico con tope
// ============================================================

import { writeJsonAtomic, appendJsonArrayCapped, nowIsoUtc, log } from "../helper.js";

// Destinos de datasets
const DATA_PATH = "./data/data.json";        // snapshot actual (atómico)
const HIST_PATH = "./data/historico.json";   // histórico (tope 600)

// --------------------------
// Función principal (MOCK)
// --------------------------
async function main() {
  log("Iniciando búsqueda de tarifas (MOCK)…");

  // Parámetros de ejemplo
  const routes = [
    { origin: "LIM", destination: "MIA", price_limit: 360 },
    { origin: "LIM", destination: "FLL", price_limit: 360 },
    { origin: "LIM", destination: "MCO", price_limit: 400 }
  ];

  const results = [];

  for (const route of routes) {
    try {
      log(`Buscando ${route.origin} → ${route.destination} (tope $${route.price_limit})`);
      // Simulación de precio
      const simulatedPrice = Math.floor(Math.random() * 550) + 250; // 250..799
      const cumple = simulatedPrice <= route.price_limit;
      const timestamp = nowIsoUtc();

      const record = {
        ruta: `${route.origin} → ${route.destination}`,
        route: `${route.origin}-${route.destination}`,
        fecha: timestamp,
        depart_date: timestamp.slice(0,10),
        depart_time: timestamp.slice(11,16),
        precio_encontrado: simulatedPrice,
        aereo: simulatedPrice,
        cumple: cumple ? "✅ Sí cumple" : "❌ No cumple",
        limite: route.price_limit,
        provider: "simulación interna",
        meta: { mode: "mock" },
        detalles: { equipaje: "carry-on only", escalas_max: 1 }
      };

      results.push(record);
      log(`${route.origin}→${route.destination}: $${simulatedPrice} → ${cumple ? "Cumple" : "No cumple"}`, "OK");
    } catch (err) {
      log(`Error buscando ${route.origin}-${route.destination}: ${err?.message||err}`, "ERROR");
    }
  }

  // Snapshot + histórico
  const snapshot = {
    meta: { generado: nowIsoUtc(), mode: "mock", project: "default" },
    resultados: results
  };

  try {
    writeJsonAtomic(DATA_PATH, snapshot);
    log("Snapshot guardado en data/data.json (atómico)", "SAVE");
  } catch (err) {
    log(`Error guardando snapshot: ${err?.message||err}`, "ERROR");
  }

  try {
    appendJsonArrayCapped(HIST_PATH, snapshot, 600, true);
    log("Histórico actualizado en data/historico.json (tope=600)", "SAVE");
  } catch (err) {
    log(`Error actualizando histórico: ${err?.message||err}`, "ERROR");
  }

  log("Búsqueda finalizada correctamente.", "DONE");
}

main().catch((e) => {
  log(`Error inesperado en farebot.js: ${e?.message||e}`, "FATAL");
  process.exit(1);
});
