// ============================================================
// notify_price_drops.js — Alerta automática de caídas de tarifas
// ============================================================
// Compatible con:
//   /scripts/alert.js
//   /scripts/helpers/helper.js
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { enviarAlerta } from "./alert.js";
import { readJsonSafe, writeJson, log } from "./helpers/helper.js";

// ------------------------------------------------------------
// Configuración de rutas y constantes
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.resolve(__dirname, "../data/data.json");
const HIST_PATH = path.resolve(__dirname, "../data/historico.json");
const ALERT_LOG = path.resolve(__dirname, "../logs/alertas.json");

// Umbrales por corredor
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
    log("🔍 Analizando dataset de tarifas...");
    const data = readJsonSafe(DATA_PATH, []);
    const historico = readJsonSafe(HIST_PATH, []);

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

    if (!alertas.length) {
      log("✅ No se detectaron bajadas de precio significativas.");
      return;
    }

    log(`🚨 Se detectaron ${alertas.length} bajadas de precio.`);
    for (const alerta of alertas) {
      const msg = `Ruta ${alerta.ruta} (${alerta.airline}) bajó a $${alerta.precio} (umbral ${alerta.umbral})`;
      enviarAlerta(msg);
    }

    // Guardar alerta en log
    const registro = { timestamp: new Date().toISOString(), alertas };
    writeJson(ALERT_LOG, registro);
    log("💾 Registro de alertas actualizado correctamente.");
  } catch (err) {
    log(`❌ Error en notify_price_drops.js: ${err.message}`);
    process.exit(1);
  }
}

// ------------------------------------------------------------
// Ejecución directa o importable
// ------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;
