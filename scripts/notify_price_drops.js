// ============================================================
// notify_price_drops.js — Alerta automática de caídas de tarifas
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendAlert } from "./alert.js"; // ✅ CORREGIDO: ruta directa al archivo alert.js
import { readJsonSafe, writeJson } from "./helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.resolve(__dirname, "../data/data.json");
const HIST_PATH = path.resolve(__dirname, "../data/historico.json");
const ALERT_LOG = path.resolve(__dirname, "../logs/alertas.json");

const ALERT_THRESHOLD = process.env.ALERT_THRESHOLD
  ? parseFloat(process.env.ALERT_THRESHOLD)
  : 400; // valor por defecto, puede ajustarse

console.log(`\n🚀 Ejecutando notify_price_drops.js con umbral: $${ALERT_THRESHOLD}\n`);

// ========================== FUNCIONES ==========================
function findNewLowFares(data, historico, threshold) {
  const nuevos = [];

  for (const entry of data) {
    const prev = historico.find(
      (h) => h.route === entry.route && h.airline === entry.airline
    );

    if (!prev || entry.price < prev.price) {
      if (entry.price <= threshold) {
        nuevos.push({
          ...entry,
          previousPrice: prev ? prev.price : null,
          drop: prev ? prev.price - entry.price : null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return nuevos;
