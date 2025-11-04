// scripts/farebot_v132.js
// ============================================================
// FareBot v1.3.2 — Wrapper/Launcher (con trazas de modo activo)
// - No ejecuta scraping por sí mismo (eso vive en farebot.js).
// - Registra si el entorno está listo para LIVE (Playwright)
//   o si quedará en fallback MOCK, según FAREBOT_MODE.
// - Mantiene compatibilidad y facilita rollback.
// ============================================================

import { log, nowIsoUtc } from "./helpers/helper.js";

// -----------------------------
// Variables de entorno/version
// -----------------------------
if (!process.env.FAREBOT_MODE) process.env.FAREBOT_MODE = "adaptative"; // live|mock|adaptative
process.env.FAREBOT_VERSION = "1.3.2";

// -----------------------------
// Detección ligera de disponibilidad LIVE
// (sin lanzar navegador; solo presence check de la lib)
// -----------------------------
async function detectLiveCapability() {
  let playwrightOk = false;
  try {
    await import("playwright");
    playwrightOk = true;
  } catch (_) {
    playwrightOk = false;
  }

  const requestedMode = (process.env.FAREBOT_MODE || "adaptative").toLowerCase();

  // Determina el "modo efectivo" esperado según env + disponibilidad
  let effective;
  if (requestedMode === "mock") {
    effective = "mock (forzado por env)";
  } else if (requestedMode === "live") {
    effective = playwrightOk ? "live (ready)" : "mock (fallback: playwright no disponible)";
  } else {
    // adaptative
    effective = playwrightOk ? "adaptative → live (ready)" : "adaptative → mock (fallback)";
  }

  log(
    [
      "▶️  FareBot v" + process.env.FAREBOT_VERSION,
      `[env: ${requestedMode}]`,
      `[effective: ${effective}]`,
      `@ ${nowIsoUtc()}`,
    ].join(" ")
  );
}

// -----------------------------
// Lanzador del motor real
// -----------------------------
async function run() {
  await detectLiveCapability();

  try {
    // Import dinámico del motor para mantener compatibilidad.
    const mod = await import("./farebot.js");

    // Si el motor exporta main(), lo usamos; si no, el top-level ejecuta.
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

await run();
