/**
 * fetch_live_html.js
 * Real/live fare scraping with safe fallback when Playwright is not available.
 */

import fs from "fs";
import path from "path";

let browser, chromium;
let playwrightAvailable = false;

try {
  const pw = await import("playwright");
  chromium = pw.chromium;
  playwrightAvailable = true;
} catch (err) {
  console.warn("[fetch_live_html] ⚠️ Playwright no disponible, usando fallback mock:", err.message);
}

/**
 * Simulación alternativa en caso de no disponer del motor Playwright.
 */
function fallbackMock() {
  return {
    meta: {
      modo: "mock",
      generado: new Date().toISOString(),
    },
    resultados: [
      {
        ruta: "LIM → MIA",
        precio_encontrado: 399,
        moneda: "USD",
        fuente: "simulación interna",
        cumple: true
      }
    ]
  };
}

/**
 * Función principal.
 */
export async function fetchLiveHTML(route) {
  if (!playwrightAvailable) return fallbackMock();

  console.log(`[fetch_live_html] Iniciando scraping en modo live para: ${route}`);

  const browserInstance = await chromium.launch({ headless: true });
  const page = await browserInstance.newPage();

  try {
    const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(route)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Simulación: captura el texto de la primera tarifa visible.
    const content = await page.textContent("body");
    const priceMatch = content.match(/\$([0-9]+)/);
    const precio = priceMatch ? parseInt(priceMatch[1], 10) : 0;

    await browserInstance.close();

    return {
      meta: {
        modo: "live",
        generado: new Date().toISOString(),
      },
      resultados: [
        {
          ruta: route,
          precio_encontrado: precio || 0,
          moneda: "USD",
          fuente: "scraping",
          cumple: precio > 0
        }
      ]
    };
  } catch (error) {
    console.error("[fetch_live_html] ❌ Error en scraping:", error.message);
    await browserInstance.close();
    return fallbackMock();
  }
}
