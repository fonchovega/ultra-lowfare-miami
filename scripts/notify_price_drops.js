// ============================================================
// notify_price_drops.js — Monitorea variaciones de precios
// ============================================================
// Ejecutado por el workflow GitHub Actions (`farebot.yml`)
// Toma los datos del último dataset y envía alertas
// si alguna tarifa baja del umbral definido por corredor.
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { enviarAlerta } from "./helpers/alert.js";
import { log } from "./helpers/helper.js";

// ------------------------------------------------------------
// Configuración base
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, "../data/data.json");

// Umbrales personalizados por corredor
// (puedes ajustarlos libremente en USD)
const UMBRALES = {
  "LIM-MIA": 420,
  "LIM-FLL": 400,
  "LIM-MCO": 430,
};

// ------------------------------------------------------------
// Función principal
// ------------------------------------------------------------
async function main() {
  try {
    log("🔍 Cargando dataset de tarifas...");
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      throw new Error("El archivo data.json no contiene un arreglo válido");
    }

    const alertas = [];

    for (const vuelo of data) {
      const ruta = `${vuelo.origen}-${vuelo.destino}`;
      const precio = parseFloat(vuelo.precio);

      if (UMBRALES[ruta] && precio < UMBRALES[ruta]) {
        alertas.push({
          ruta,
          precio,
          umbral: UMBRALES[ruta],
          airline: vuelo.aerolinea || "Desconocida",
          fecha: vuelo.fecha || new Date().toISOString(),
        });
      }
    }

    if (alertas.length === 0) {
      log("✅ No se detectaron bajadas de precio significativas.");
      return;
    }

    log(`🚨 Se detectaron ${alertas.length} bajadas de precio.`);
    for (const alerta of alertas) {
      const msg = `Ruta ${alerta.ruta} (${alerta.airline}) bajó a $${alerta.precio} USD (umbral ${alerta.umbral})`;
      enviarAlerta(msg);
    }
  } catch (err) {
    console.error("❌ Error en notify_price_drops:", err);
    process.exit(1);
  }
}

// ------------------------------------------------------------
// Ejecución directa (node scripts/notify_price_drops.js)
// ------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;
