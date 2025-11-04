// ============================================================
// scripts/farebot_v132.js
// ============================================================
// FareBot v1.3.2 — Wrapper/Launcher del motor principal
// - Detección automática de modo (live / mock / adaptative)
// - Verifica si Playwright está disponible
// - Ejecuta el motor real (farebot.js)
// - Registra fuente activa, versión y timestamp
// ============================================================

import { log, nowIsoUtc } from "./helpers/helper.js";

// ------------------------------------------------------------
// Configuración inicial de entorno
// ------------------------------------------------------------
if (!process.env.FAREBOT_MODE) process.env.FAREBOT_MODE = "adaptative"; // live | mock | adaptative
process.env.FAREBOT_VERSION = "1.3.2";

// ------------------------------------------------------------
// Verificación del modo activo y disponibilidad de Playwright
// ------------------------------------------------------------
async function detectLiveCapability() {
  let playwrightOk = false;
  try {
    await import("playwright");
    playwrightOk = true;
  } catch (_) {
    playwrightOk = false;
  }

  const requestedMode = (process.env.FAREBOT_MODE || "adaptative").toLowerCase();
  let effectiveMode;

  if (requestedMode === "mock") {
    effectiveMode = "mock (forzado por entorno)";
  } else if (requestedMode === "live") {
    effectiveMode = playwrightOk
      ? "live (playwright disponible)"
      : "mock (fallback: playwright no disponible)";
  } else {
    effectiveMode = playwrightOk
      ? "adaptative → live (playwright activo)"
      : "adaptative → mock (fallback)";
  }

  log(
    [
      "▶️  FareBot v" + process.env.FAREBOT_VERSION,
      `[modo solicitado: ${requestedMode}]`,
      `[modo efectivo: ${effectiveMode}]`,
      `@ ${nowIsoUtc()}`
    ].join(" ")
  );

  // Registro de fuente de scraping (auditoría)
  log(`📡 Fuente de scraping: ${requestedMode === "live" && playwrightOk ? "LIVE" : "MOCK"}`);
}

// ------------------------------------------------------------
// Ejecución del motor principal
// ------------------------------------------------------------
async function runFarebot() {
  await detectLiveCapability();

  try {
    const mod = await import("./farebot.js");

    if (typeof mod?.main === "function") {
      await mod.main();
    }

    log("✅ FareBot v1.3.2 finalizado sin errores.");
    process.exitCode = 0;
  } catch (err) {
    log(`❌ Error en FareBot v1.3.2: ${err?.stack || err}`);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------
// Ejecución directa (workflow o manual)
// ------------------------------------------------------------
await runFarebot();
