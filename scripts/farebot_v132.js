// ============================================================
// scripts/farebot_v132.js
// v1.3.2 — Modo LIVE por defecto (SOURCE_MODE = 'live')
// - Selección dinámica de proveedores
// - Precio LIVE vía Playwright (placeholder robusto)
// - Escritura de snapshot (data.json) + histórico (historico.json)
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { selectProviders } from "./selector_proveedores.js";
import { default as scoreProvider } from "./scoring.js";
import { buildDeepLink } from "./helper.js";

// ------------------------------------------------------------
// Paths básicos
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR  = path.join(__dirname, "..", "data");
const DATA_PATH = path.join(DATA_DIR, "data.json");        // snapshot actual
const HIST_PATH = path.join(DATA_DIR, "historico.json");   // acumulado

// ------------------------------------------------------------
// Helpers mínimos
// ------------------------------------------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ------------------------------------------------------------
// Config / entradas básicas (reusa Project A del config.json)
// ------------------------------------------------------------
const CFG_PATH = path.join(__dirname, "..", "config.json");
const cfg      = readJsonSafe(CFG_PATH, {});

const project = cfg?.projects?.[0];
if (!project) {
  console.error("❌ No hay proyecto configurado en config.json");
  process.exit(1);
}

const SOURCE_MODE = (process.env.SOURCE_MODE || "live").toLowerCase(); // v1.3.2 LIVE por defecto
const DRY_RUN     = String(process.env.DRY_RUN || "false") === "true";

// ------------------------------------------------------------
// Construir rutas a evaluar (ida+vuelta 1 o 2 fechas)
// ------------------------------------------------------------
const routes = [];
for (const to of project.destinations) {
  routes.push({
    from: project.origins[0],
    to,
    dep: project.depart,
    ret: project.return?.[0] || null,
    adt: project.pax?.adults ?? 1,
    budget: project.budget?.[to] ?? null
  });
  if (project.return?.[1]) {
    routes.push({
      from: project.origins[0],
      to,
      dep: project.depart,
      ret: project.return[1],
      adt: project.pax?.adults ?? 1,
      budget: project.budget?.[to] ?? null
    });
  }
}

// ------------------------------------------------------------
// Precio MOCK (respaldo rápido)
// ------------------------------------------------------------
function bestPriceMock() {
  return 389 + Math.floor(Math.random() * 21) - 10; // 379..399
}

// ------------------------------------------------------------
// Precio LIVE con Playwright (placeholder sólido)
// - Abre Chromium en modo headless
// - Visita el deep link del 1er proveedor (meta o aerolínea)
// - Extrae un número con regex de la página (temporal)
// ------------------------------------------------------------
async function bestPriceLive(deeplinks) {
  if (!deeplinks?.length) throw new Error("No hay deeplinks para consultar (LIVE).");

  // Importación dinámica para evitar requerir Playwright cuando no es LIVE
  const { chromium } = await import("@playwright/test");

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  let best = Number.POSITIVE_INFINITY;

  try {
    // Consultamos hasta 3 proveedores (o los que haya)
    const top = deeplinks.slice(0, 3);
    for (const url of top) {
      try {
        await page.goto(url, { timeout: 90_000, waitUntil: "domcontentloaded" });
        await sleep(3000); // margen para renders dinámicos

        const bodyText = await page.locator("body").innerText();

        // Heurística temporal: primer número de 2-4 dígitos como USD
        const m = bodyText.match(/\$?\s?(\d{2,4})(?:[.,]\d{2})?/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (Number.isFinite(val)) best = Math.min(best, val);
        }
      } catch (subErr) {
        console.warn("⚠️ Falló un proveedor LIVE:", subErr.message || subErr);
      }
    }
  } finally {
    await browser.close();
  }

  if (!Number.isFinite(best)) throw new Error("No se pudo extraer precio LIVE.");
  return best;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function main() {
  console.log(`🚀 FareBot v1.3.2 — SOURCE_MODE=${SOURCE_MODE.toUpperCase()} — DRY_RUN=${DRY_RUN}`);

  const allResults = [];

  for (const r of routes) {
    // selección adaptativa (usa scoring + deep links)
    const selection = await selectProviders({
      // fuentes (ya vienen en sources.json leído por selector si lo usas así),
      // aquí solo enviamos contenedor vacío por compat:
      metasearch: readJsonSafe(path.join(__dirname, "..", "sources.json"), {}).metasearch || [],
      airlines:   readJsonSafe(path.join(__dirname, "..", "sources.json"), {}).airlines   || []
    }, { origin: r.from, dest: r.to, route: r, prefer_low_fees: true });

    const metaLinks = (selection.chosenMeta || []).map(p => buildDeepLink(p.template, r));
    const airLinks  = (selection.chosenAir  || []).map(p => buildDeepLink(p.template, r));
    const deeplinks = [...metaLinks, ...airLinks].filter(Boolean);

    let price;
    if (SOURCE_MODE === "live") {
      try {
        price = await bestPriceLive(deeplinks);
      } catch (e) {
        console.warn("⚠️ LIVE no pudo extraer precio, fallback a MOCK:", e.message || e);
        price = bestPriceMock();
      }
    } else {
      price = bestPriceMock();
    }

    const record = {
      route: `${r.from}-${r.to}`,
      dep: r.dep,
      ret: r.ret,
      pax: r.adt,
      constraints: { carry_on_required: !!cfg.carry_on_required, max_stops: cfg.max_stops ?? 1 },
      providers: {
        meta: (selection.chosenMeta || []).map(m => ({ id: m.id, name: m.name, link: buildDeepLink(m.template, r), score: m.score })),
        airlines: (selection.chosenAir || []).map(a => ({ id: a.id, name: a.name, link: buildDeepLink(a.template, r), score: a.score }))
      },
      best_offer: {
        total_usd: price,
        under_budget: r.budget ? price <= r.budget : null,
        mode: SOURCE_MODE
      }
    };

    allResults.push(record);
    console.log(`🎯 ${record.route} -> $${price} (${SOURCE_MODE})  ${record.best_offer.under_budget ? "✅ dentro de umbral" : "—"}`);
  }

  const snapshot = {
    meta: {
      generado: new Date().toISOString(),
      proyecto: project.id,
      rutasKey: `A:${project.origins[0]}|${project.destinations.join(",")}`,
      v: "1.3.2",
      mode: SOURCE_MODE
    },
    resumen: {
      mejor_precio: Math.min(...allResults.map(x => x.best_offer.total_usd)),
      cumple_umbral: allResults.some(x => x.best_offer.under_budget === true),
      iteraciones: allResults.length
    },
    resultados: allResults
  };

  // Escritura condicionada por DRY_RUN
  if (DRY_RUN) {
    console.log("📝 [DRY_RUN] Snapshot (no se escribe a disco):");
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  // Snapshot y acumulado
  writeJson(DATA_PATH, snapshot);

  let historico = readJsonSafe(HIST_PATH, []);
  if (!Array.isArray(historico)) historico = [];
  historico.push(snapshot);

  const MAX_RECORDS = 800;            // ampliado en v1.3.2
  if (historico.length > MAX_RECORDS) {
    historico = historico.slice(-MAX_RECORDS);
    console.log(`✂️ Histórico recortado a las últimas ${MAX_RECORDS} ejecuciones.`);
  }
  writeJson(HIST_PATH, historico);

  console.log(`✅ data.json actualizado | 📚 histórico: ${historico.length} snapshots`);
}

main().catch((e) => {
  console.error("❌ Error inesperado en v1.3.2:", e);
  process.exit(1);
});
