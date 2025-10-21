// 🛫 FareBot – Victor Vega Edition (actualiza data.json y anexa al histórico)

import fs from "fs";
import fetch from "node-fetch";

const DATA_PATH = "./data.json";
const HIST_PATH = "./historico.json";

// --- Histórico: utilidades ---
function loadHistorico() {
  try {
    const raw = fs.readFileSync(HIST_PATH, "utf8");
    const j = JSON.parse(raw);
    j.meta ??= {};
    j.historial ??= [];
    return j;
  } catch {
    // si no existe o está corrupto, lo iniciamos vacío
    return { meta: { generado: new Date().toISOString() }, historial: [] };
  }
}

function buildHistoryItems(results, meta) {
  return results.map((r) => ({
    meta: { generado: meta.generado },
    ruta: r.ruta,
    salida: r.salida,
    retorno: r.retorno,
    precio: r.precio,
    umbral: r.umbral,
    cumple: r.precio <= r.umbral,
    fuente: r.fuente || "auto",
    stops: r.stops ?? 1,
  }));
}

function appendHistorico(results, meta) {
  const hist = loadHistorico();
  hist.meta.generado = meta.generado;
  const items = buildHistoryItems(results, meta);
  hist.historial.push(...items);
  fs.writeFileSync(HIST_PATH, JSON.stringify(hist, null, 2), "utf8");
}

// --- simulador de búsqueda (debes reemplazar por tu lógica real o API) ---
async function buscarVuelos(origen, destino, salida, retorno, umbral) {
  // Simulación de precios
  const precio = 350 + Math.floor(Math.random() * 120);
  return {
    ruta: ${origen}→${destino},
    salida,
    retorno,
    precio,
    umbral,
    cumple: precio <= umbral,
    stops: 1,
    fuente: "simulada",
  };
}

// --- flujo principal ---
async function runSim() {
  const meta = { generado: new Date().toISOString() };
  const origen = "LIM";
  const salida = "2026-02-15";
  const retorno = "2026-02-20";

  const destinos = [
    { code: "MIA", umbral: 360 },
    { code: "FLL", umbral: 360 },
    { code: "MCO", umbral: 400 },
  ];

  const results = [];
  for (const d of destinos) {
    results.push(await buscarVuelos(origen, d.code, salida, retorno, d.umbral));
  }

  const salidaJSON = { meta, resumen: results };
  fs.writeFileSync(DATA_PATH, JSON.stringify(salidaJSON, null, 2), "utf8");

  // 👇 Apéndice automático al histórico
  appendHistorico(results, meta);

  console.log("✅ data.json actualizado y histórico ampliado correctamente.");
}

runSim();
