// scripts/farebot_v132.js
// ============================================================
// FareBot v1.3.2 — motor de captura (modo LIVE)
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// Utilitarios de lectura/escritura
// -----------------------------
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(p, data) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// -----------------------------
// Config / rutas objetivo
// -----------------------------
const DATA_DIR = path.resolve(__dirname, "..", "data");
const SNAP_DIR = path.join(DATA_DIR, "snapshots");
const DATA_JSON = path.join(DATA_DIR, "data.json");
const HIST_JSON = path.join(DATA_DIR, "historico.json");

const ROUTES = [
  { from: "LIM", to: "MIA" },
  { from: "LIM", to: "FLL" },
  { from: "LIM", to: "MCO" },
];

// Genera URL simple de Google Flights (flex, mes abierto)
function gflightsUrl(from, to) {
  // Búsqueda base, ida (se puede ajustar a fechas específicas si lo necesitas)
  return `https://www.google.com/travel/flights?hl=es-419#flt=${from}.${to}`;
}

// -----------------------------
// CAPTURA DE TARIFAS CON PLAYWRIGHT (corregida)
// -----------------------------
async function scrapeGoogleFlights(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Carga robusta
  await page.goto(url, { timeout: 90000, waitUntil: "domcontentloaded" });

  // Esperar a que aparezcan bloques con precios (Google cambia mucho los selectores)
  // Estrategia: esperar un nodo genérico y luego filtrar por texto (S/ o $)
  await page
    .waitForSelector("div[role='grid'] span[jsname]", { timeout: 90000 })
    .catch(() => {});

  // Extraer textos de celdas y filtrar por patrones de precio comunes
  const results = await page.$$eval("div[role='grid'] div[aria-label]", (els) =>
    els
      .map((el) => el.innerText.trim())
      .filter((txt) => /S\/|\$/.test(txt))
      .slice(0, 5)
  );

  await browser.close();
  return results.length ? results : ["sin datos"];
}

// -----------------------------
// Normalización mínima de precios desde textos
// -----------------------------
function parseFirstPrice(texts) {
  // Busca primer número con símbolo S/ o $
  for (const t of texts) {
    const m =
      t.match(/S\/\s*([\d.,]+)/) ||
      t.match(/\$\s*([\d.,]+)/) ||
      t.match(/USD\s*([\d.,]+)/i);
    if (m) {
      const n = Number(String(m[1]).replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

// -----------------------------
// PROCESO PRINCIPAL
// -----------------------------
async function main() {
  console.log("[LIVE LOCK] FareBot bloqueado en modo LIVE permanente.\n");
  console.log("===============================================");
  console.log("🚀 Iniciando FareBot v1.3.2 (modo LIVE)");
  console.log("===============================================\n");

  ensureDir(DATA_DIR);
  ensureDir(SNAP_DIR);

  const nowIso = new Date().toISOString();

  const resultados = [];
  for (const r of ROUTES) {
    const label = `${r.from} → ${r.to}`;
    console.log(`🔎 Buscando vuelos ${label} ...`);
    try {
      const url = gflightsUrl(r.from, r.to);
      const texts = await scrapeGoogleFlights(url);
      const precio = parseFirstPrice(texts);

      if (!precio) {
        console.log(`✅ ${r.to}: sin datos`);
        resultados.push({
          ruta: `${r.from}-${r.to}`,
          precio: null,
          textos: texts.slice(0, 3),
          estado: "sin_datos",
          ts: nowIso,
        });
      } else {
        console.log(`✅ ${r.to}: S/ ${precio}`);
        resultados.push({
          ruta: `${r.from}-${r.to}`,
          precio,
          textos: texts.slice(0, 3),
          estado: "ok",
          ts: nowIso,
        });
      }
    } catch (err) {
      console.log(`⚠️  ${label}: error - ${err.message}`);
      resultados.push({
        ruta: `${r.from}-${r.to}`,
        precio: null,
        textos: [],
        estado: "error",
        error: String(err && err.message ? err.message : err),
        ts: nowIso,
      });
    }
  }

  // Guardar snapshot crudo
  const snapPath = path.join(SNAP_DIR, `snapshot_${Date.now()}.json`);
  writeJson(snapPath, { meta: { generado: nowIso }, resultados });
  console.log(`💾 Snapshot guardado: ${path.relative(process.cwd(), snapPath)}\n`);

  // Actualizar data.json (estructura simple y estable)
  const dataJson = {
    meta: {
      generado: nowIso,
      origen: "live",
    },
    resultados,
  };
  writeJson(DATA_JSON, dataJson);
  console.log("📦 data.json actualizado");

  // Actualizar historico.json (append)
  const hist = readJson(HIST_JSON, { meta: { version: 1 }, registros: [] });
  hist.registros.push({
    ts: nowIso,
    rutas: resultados.map((r) => ({
      ruta: r.ruta,
      precio: r.precio,
      estado: r.estado,
    })),
  });
  writeJson(HIST_JSON, hist);
  console.log(`🕒 Histórico actualizado (${hist.registros.length} registros totales)\n`);

  console.log("✅ FareBot ejecutado correctamente en modo LIVE.");
  console.log("===============================================");
}

// Ejecutar si se llama directo
if (import.meta.url === `file://${__filename}`) {
  main().catch((err) => {
    console.error("❌ Error fatal en FareBot:", err);
    process.exit(1);
  });
}

export { main };
