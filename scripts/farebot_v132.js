// scripts/farebot_v132.js
// Ultra-LowFare — Motor FareBot v1.3.2 (modo LIVE sin git interno)
// - Captura precios (placeholder robusto con Playwright)
// - Actualiza data/data.json, data/historico.json
// - Garantiza existencia de arreglos antes de hacer .push()
// - También genera data/historico_normalizado.json (alias simple) para el FrontWeb

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// Configuración
// -----------------------------
const DATA_DIR = path.resolve(__dirname, "../data");
const SNAP_DIR = path.join(DATA_DIR, "snapshots");
const DATA_JSON = path.join(DATA_DIR, "data.json");
const HIST_JSON = path.join(DATA_DIR, "historico.json");
const HIST_NORM = path.join(DATA_DIR, "historico_normalizado.json");

const ROUTES = [
  { origen: "LIM", destino: "MIA", tope: 5300 },
  { origen: "LIM", destino: "FLL", tope: 5300 },
  { origen: "LIM", destino: "MCO", tope: 5400 },
];

const nowIso = () => new Date().toISOString();

// Utilidad segura para leer JSON
function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || !raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Utilidad segura para escribir JSON (bonito)
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// -----------------------------
// Captura de tarifas (placeholder)
// -----------------------------
// Nota: Google Flights cambia constantemente su DOM. Este scraper
// devuelve lista vacía o “sin datos” si no reconoce precios.
// Mantiene estabilidad del pipeline (sin lanzar excepciones).
async function scrapeGoogleFlights(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { timeout: 90000, waitUntil: "domcontentloaded" });

    // Espera superficial por grillas (si fallara, continua sin romper)
    await page
      .waitForSelector("div[role='grid'] span[jsname]", { timeout: 30000 })
      .catch(() => {});

    const results = await page
      .$$eval("div[role='grid'] div[aria-label*='$']", (elements) =>
        elements.slice(0, 5).map((el) => el.innerText.trim())
      )
      .catch(() => []);

    await browser.close();
    return results.length ? results : ["sin datos"];
  } catch (err) {
    await browser.close();
    return ["sin datos"];
  }
}

// -----------------------------
// Proceso principal
// -----------------------------
async function main() {
  console.log("[LIVE LOCK] FareBot bloqueado en modo LIVE permanente.");
  console.log("===============================================");
  console.log("🚀 Iniciando FareBot v1.3.2 (modo LIVE)");
  console.log("===============================================");

  // Carga bases (tolerante a archivos vacíos)
  const baseData = readJsonSafe(DATA_JSON, {
    meta: { generado: nowIso(), modo: "live" },
    resultados: [],
  });

  // Asegura arrays
  if (!Array.isArray(baseData.resultados)) baseData.resultados = [];

  const historico = readJsonSafe(HIST_JSON, {
    meta: { generado: nowIso() },
    registros: [],
  });
  if (!Array.isArray(historico.registros)) historico.registros = [];

  // Construye snapshot
  const snapshot = {
    generado: nowIso(),
    modo: "live",
    rutas: [],
  };

  // Ejecuta scraping por ruta (placeholder de URL)
  for (const r of ROUTES) {
    const tag = `${r.origen} → ${r.destino}`;
    console.log(`🔎 Buscando vuelos ${r.origen} → ${r.destino} ...`);

    // URL simbólica (ajústala si deseas una real)
    const url = `https://www.google.com/travel/flights?hl=es-419#${r.origen}-${r.destino}`;
    const preciosRaw = await scrapeGoogleFlights(url);

    // Normalización simple: extrae números si hay, si no "sin datos"
    const preciosNum = preciosRaw
      .map((t) => {
        const m = String(t).replace(/\./g, "").match(/(\d{2,})/);
        return m ? Number(m[1]) : null;
      })
      .filter((n) => Number.isFinite(n));

    // Métricas
    const min = preciosNum.length ? Math.min(...preciosNum) : null;
    const max = preciosNum.length ? Math.max(...preciosNum) : null;
    const prom = preciosNum.length
      ? Math.round(preciosNum.reduce((a, b) => a + b, 0) / preciosNum.length)
      : null;
    const ultimo = preciosNum.length ? preciosNum[0] : null;

    if (!preciosNum.length) {
      console.log(`✅ ${r.destino}: sin datos`);
    }

    const registro = {
      ts: nowIso(),
      ruta: `${r.origen}-${r.destino}`,
      min,
      max,
      prom,
      ultimo,
      tope: r.tope,
      fuente: "google_flights",
    };

    snapshot.rutas.push(registro);

    // Actualiza data.json (estado “actual”)
    // Reemplaza si ya existe esa ruta; si no, agrega
    const idx = baseData.resultados.findIndex(
      (x) => x.ruta === registro.ruta
    );
    if (idx >= 0) baseData.resultados[idx] = registro;
    else baseData.resultados.push(registro);

    // Actualiza historico.json (append)
    historico.registros.push(registro);
  }

  // Guarda snapshot
  const snapName = `snapshot_${Date.now()}.json`;
  const snapPath = path.join(SNAP_DIR, snapName);
  writeJson(snapPath, snapshot);
  console.log(`💾 Snapshot guardado: ${path.relative(DATA_DIR, snapPath)}`);

  // Guarda data.json + historico.json
  baseData.meta = { generado: nowIso(), modo: "live" };
  writeJson(DATA_JSON, baseData);
  console.log("📦 data.json actualizado");

  historico.meta = { generado: nowIso() };
  writeJson(HIST_JSON, historico);
  console.log(
    `🕒 Histórico actualizado (${historico.registros.length} registros totales)`
  );

  // Alias sencillo para el FrontWeb
  writeJson(HIST_NORM, historico);
  console.log("🔁 historico_normalizado.json actualizado (alias)");

  console.log("✅ FareBot ejecutado correctamente en modo LIVE.");
  console.log("===============================================");
}

main().catch((err) => {
  console.error("❌ Error fatal en FareBot:", err?.message || err);
  process.exit(1);
});
