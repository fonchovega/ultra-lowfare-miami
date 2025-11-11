// ============================================================
// FAREBOT v1.3.2 (modo LIVE permanente)
// ============================================================
// Motor principal para ejecutar búsquedas reales de tarifas
// entre LIM y MIA/FLL/MCO, guardar data.json y actualizar histórico.

// 🔒 Bloqueo permanente del modo LIVE
process.env.FAREBOT_MODE = "live";
console.log("[LIVE LOCK] FareBot bloqueado en modo LIVE permanente.");

import fs from "fs";
import path from "path";
import { chromium } from "playwright";

// ===============================
// CONFIGURACIÓN BASE
// ===============================
const DATA_PATH = "./data/data.json";
const HIST_PATH = "./data/historico.json";
const SNAPSHOT_DIR = "./data/snapshots";
const BASE_URLS = [
  { code: "MIA", url: "https://www.google.com/travel/flights?q=flights+from+LIM+to+MIA" },
  { code: "FLL", url: "https://www.google.com/travel/flights?q=flights+from+LIM+to+FLL" },
  { code: "MCO", url: "https://www.google.com/travel/flights?q=flights+from+LIM+to+MCO" }
];

// ===============================
// FUNCIONES UTILITARIAS
// ===============================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===============================
// CAPTURA DE TARIFAS CON PLAYWRIGHT
// ===============================
async function scrapeGoogleFlights(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { timeout: 90000, waitUntil: "domcontentloaded" });

  // Esperar que aparezcan precios
  await page.waitForSelector("div[role='grid'] span[jsname]", { timeout: 30000 }).catch(() => {});

  const results = await page.$$eval("div[role='grid'] div[aria-label*='S/']", elements =>
    elements.slice(0, 5).map(el => el.innerText.trim())
  );

  await browser.close();
  return results.length ? results : ["sin datos"];
}

// ===============================
// PROCESO PRINCIPAL
// ===============================
async function main() {
  console.log("===============================================");
  console.log("🚀 Iniciando FareBot v1.3.2 (modo LIVE)");
  console.log("===============================================");

  ensureDir("./data");
  ensureDir(SNAPSHOT_DIR);

  const results = {};
  for (const { code, url } of BASE_URLS) {
    console.log(`🔍 Buscando vuelos LIM → ${code} ...`);
    const fares = await scrapeGoogleFlights(url);
    results[code] = {
      timestamp: new Date().toISOString(),
      fares
    };
    console.log(`✅ ${code}: ${fares.join(", ")}`);
  }

  // Guardar snapshot actual
  const snapshotFile = path.join(SNAPSHOT_DIR, `snapshot_${Date.now()}.json`);
  writeJson(snapshotFile, results);
  console.log(`💾 Snapshot guardado: ${snapshotFile}`);

  // Actualizar data.json
  writeJson(DATA_PATH, results);
  console.log("📦 data.json actualizado");

  // Actualizar histórico
  const historico = readJsonSafe(HIST_PATH, []);
  historico.push({ timestamp: new Date().toISOString(), data: results });
  writeJson(HIST_PATH, historico);
  console.log(`🕓 Histórico actualizado (${historico.length} registros totales)`);

  console.log("✅ FareBot ejecutado correctamente en modo LIVE.");
  console.log("===============================================");
}

main().catch(err => {
  console.error("❌ Error al ejecutar FareBot:", err);
  process.exit(1);
});
