// ============================================================
// fetch_live_html.js — Precio "live" vía navegador (Playwright)
// Devuelve: { price, currency, provider, live, urlUsed, providerDetected? }
// ============================================================

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PROVIDERS_MAP = path.resolve(__dirname, "../data/html_providers.json");

function readJsonSafe(p, fb) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; } }

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
  const toISO = (d) => new Date(d).toISOString().slice(0,10);
  return tpl
    .replaceAll("{FROM}", encodeURIComponent(route.from))
    .replaceAll("{TO}", encodeURIComponent(route.to))
    .replaceAll("{DEP}", encodeURIComponent(toISO(route.dep)))
    .replaceAll("{RET}", encodeURIComponent(toISO(route.ret)))
    .replaceAll("{ADT}", String(route.adt ?? 1));
}

/**
 * @param {{providerId:string, route:{from:string,to:string,dep:string|Date,ret:string|Date,adt?:number}, opts?:{timeoutMs?:number}}} p
 */
export async function fetchLivePriceHTML({ providerId, route, opts = {} }) {
  const timeoutMs = opts.timeoutMs ?? 25000;
  const map = readJsonSafe(PROVIDERS_MAP, {});
  const conf = map[providerId];
  if (!conf) return { price: null, currency: "USD", provider: providerId, live: false };

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36",
    locale: "en-US"
  });
  const page = await ctx.newPage();

  const url = applyTemplate(conf.urlTemplate, route);

  try {
    await page.goto(url, { timeout: timeoutMs, waitUntil: "domcontentloaded" });
    await page.waitForSelector(conf.waitFor, { timeout: timeoutMs });

    const priceText = await page.textContent(conf.priceSelector);
    const price = extractPriceNumber(priceText);

    let providerDetected = null;
    if (conf.providerSelector) {
      const provTxt = await page.textContent(conf.providerSelector).catch(() => null);
      providerDetected = (provTxt || "").trim() || null;
    }

    await browser.close();
    return {
      price: price ?? null,
      currency: conf.currency ?? "USD",
      provider: providerId,
      providerDetected,
      live: true,
      urlUsed: url
    };
  } catch (e) {
    try { await browser.close(); } catch {}
    return { price: null, currency: conf?.currency ?? "USD", provider: providerId, live: false, urlUsed: url };
  }
}

export default fetchLivePriceHTML;
