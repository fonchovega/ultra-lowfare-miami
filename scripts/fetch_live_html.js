// ============================================================
// fetch_live_html.js — Precio "live" vía navegador (Playwright)
// - Retorna: { price, currency, provider, providerDetected?, live, urlUsed, source_method }
// - Soporta: selector alterno, screenshots en fallos, pausa responsable
// Requisitos:
//   npm i -D @playwright/test
//   npx playwright install --with-deps chromium
// ============================================================

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PROVIDERS_MAP = path.resolve(__dirname, "../data/html_providers.json");

// -------- Utils --------
function readJsonSafe(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; }
}
function ensureDirOf(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}
function extractPriceNumber(txt) {
  if (!txt) return null;
  const cleaned = txt.replace(/\s/g, "");
  const m = cleaned.match(/(\d{1,3}([.,]\d{3})*([.,]\d{2})?|\d+)/);
  if (!m) return null;
  let n = m[0].replace(/,/g, "").replace(/\.(?=\d{3}\b)/g, "");
  n = n.replace(",", ".");
  const val = Number(n);
  return Number.isFinite(val) ? val : null;
}
function applyTemplate(tpl, route) {
  const toISO = (d) => new Date(d).toISOString().slice(0,10); // YYYY-MM-DD
  return tpl
    .replaceAll("{FROM}", encodeURIComponent(route.from))
    .replaceAll("{TO}", encodeURIComponent(route.to))
    .replaceAll("{DEP}", encodeURIComponent(toISO(route.dep)))
    .replaceAll("{RET}", encodeURIComponent(toISO(route.ret)))
    .replaceAll("{ADT}", String(route.adt ?? 1));
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// -------- Core --------
/**
 * Lee precio desde la web del proveedor (metabuscador/aerolínea) usando Playwright.
 * @param {Object} p
 * @param {string} p.providerId           - Clave del proveedor en html_providers.json
 * @param {Object} p.route                - { from, to, dep, ret, adt }
 * @param {Object} [p.opts]
 * @param {number} [p.opts.timeoutMs=25000]
 * @param {number} [p.opts.minDelayMs=1200] - Pausa responsable mínima antes de leer el DOM
 * @param {number} [p.opts.maxDelayMs=2800] - Pausa responsable máxima antes de leer el DOM
 * @returns {Promise<{ price:number|null, currency:string, provider:string, providerDetected?:string|null, live:boolean, urlUsed?:string, source_method:"html" }>}
 */
export async function fetchLiveHTML({ providerId, route, opts = {} }) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 25000;
  const minDelayMs = Number.isFinite(opts.minDelayMs) ? opts.minDelayMs : 1200;
  const maxDelayMs = Number.isFinite(opts.maxDelayMs) ? opts.maxDelayMs : 2800;

  const map = readJsonSafe(PROVIDERS_MAP, {});
  const conf = map[providerId];
  if (!conf) {
    console.warn(`⚠️ Provider ${providerId} no definido en html_providers.json`);
    return { price: null, currency: "USD", provider: providerId, live: false, source_method: "html" };
  }

  const url = applyTemplate(conf.urlTemplate, route);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36",
    locale: "en-US"
  });
  const page = await ctx.newPage();

  try {
    await page.goto(url, { timeout: timeoutMs, waitUntil: "domcontentloaded" });

    // Espera al contenedor de resultados (waitFor principal)
    await page.waitForSelector(conf.waitFor, { timeout: timeoutMs });

    // Pausa responsable para evitar lecturas “en caliente” del DOM
    const jitter = minDelayMs + Math.random() * Math.max(0, (maxDelayMs - minDelayMs));
    await sleep(jitter);

    // Intento 1: selector principal
    let priceText = await page.textContent(conf.priceSelector).catch(() => null);

    // Intento 2: selector alterno (si se define)
    if (!priceText && conf.priceSelectorAlt) {
      priceText = await page.textContent(conf.priceSelectorAlt).catch(() => null);
    }

    const price = extractPriceNumber(priceText || "");

    // Detección del proveedor (aerolínea/operador) visible en el card
    let providerDetected = null;
    if (conf.providerSelector) {
      const provTxt = await page.textContent(conf.providerSelector).catch(() => null);
      providerDetected = (provTxt || "").trim() || null;
    } else if (conf.providerSelectorAlt) {
      const provTxtAlt = await page.textContent(conf.providerSelectorAlt).catch(() => null);
      providerDetected = (provTxtAlt || "").trim() || null;
    }

    await browser.close();
    return {
      price: price ?? null,
      currency: conf.currency ?? "USD",
      provider: providerId,
      providerDetected,
      live: true,
      urlUsed: url,
      source_method: "html"
    };
  } catch (e) {
    // Screenshot de depuración
    try {
      ensureDirOf("outputs/fetch_html_error.png");
      const filename = `outputs/fail_${route.from}-${route.to}_${Date.now()}.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.warn(`🖼️ Screenshot guardado: ${filename}`);
    } catch {}

    try { await browser.close(); } catch {}
    console.warn(`ℹ️ HTML fetch falló para ${providerId}: ${e?.message || e}`);

    return {
      price: null,
      currency: conf?.currency ?? "USD",
      provider: providerId,
      live: false,
      urlUsed: url,
      source_method: "html"
    };
  }
}

export default fetchLiveHTML;
