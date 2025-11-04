// ============================================================
// farebot_v132.js — Ultra-LowFare Engine v1.3.2 (Stable Fix)
// ============================================================

import path from "path";
import { fileURLToPath } from "url";
import { readJsonSafe, writeJson, ensureDir, nowIsoUtc, log } from "./helper.js"; // ✅ Ruta corregida
import { fetchLivePrices } from "./fetch_live_html.js";
import { dedupe } from "./dedupe.js";
import { alertIfDrop } from "./alert.js";

// ------------------------------------------------------------------
// Configuración base
// ------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "../data/data.json");
const HIST_PATH = path.join(__dirname, "../data/historico.json");

// ------------------------------------------------------------------
// Ejecutor principal
// ------------------------------------------------------------------

async function runFarebot() {
  log("🚀 Iniciando Farebot v1.3.2 (fix-import-helper)");

  const data = readJsonSafe(DATA_PATH, null);
  if (!data) {
    log("⚠️ No se encontró data.json. Abortando.");
    return;
  }

  const rutas = data.meta?.rutasKey?.split("|") || [];
  const resultados = [];

  for (const ruta of rutas) {
    try {
      log(`✈️ Buscando precios para ${ruta}...`);
      const res = await fetchLivePrices(ruta);
      resultados.push({
        ruta,
        mejor_precio: res.bestPrice,
        fecha: nowIsoUtc(),
        fuente: "live",
      });
      log(`✅ ${ruta} → Mejor precio: ${res.bestPrice}`);
    } catch (err) {
      log(`❌ Error al buscar ${ruta}: ${err.message}`);
    }
  }

  const resumen = {
    mejor_precio: Math.min(...resultados.map(r => r.mejor_precio)),
    cumple_umbral: resultados.some(r => r.mejor_precio <= (data.resumen?.umbral || 400)),
    iteraciones: (data.resumen?.iteraciones || 0) + 1,
  };

  const nuevoData = {
    meta: {
      generado: nowIsoUtc(),
      proyecto: data.meta?.proyecto || "A",
      rutasKey: data.meta?.rutasKey,
      v: "1.3.2",
      mode: "live",
    },
    resumen,
    resultados,
  };

  writeJson(DATA_PATH, nuevoData);
  log("💾 data.json actualizado correctamente.");

  // Actualizar histórico
  const historico = readJsonSafe(HIST_PATH, []);
  historico.push({
    meta: { generado: nowIsoUtc() },
    resumen: {
      ruta: data.meta?.rutasKey,
      fecha: nowIsoUtc(),
      mejor_precio: resumen.mejor_precio,
      fuente: "live",
      cumple: resumen.cumple_umbral ? "✅ Cumple" : "❌ No cumple",
    },
  });
  writeJson(HIST_PATH, historico);
  log("📜 Histórico actualizado correctamente.");

  // Evaluar alertas
  await alertIfDrop(resumen.mejor_precio);

  log("🏁 Ejecución completada con éxito.");
}

runFarebot().catch(err => {
  console.error("💥 Error crítico:", err);
  process.exit(1);
});
