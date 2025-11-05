// scripts/farebot_v132.js
// ============================================================
// FareBot v1.3.2 – Wrapper/Launcher del motor principal
// ------------------------------------------------------------
// - Detección automática de modo (live / mock / adaptative)
// - Verifica si Playwright está disponible
// - Ejecuta el motor real (farebot.js)
// - Registra fuente activa, versión y timestamp
// ============================================================

import { log, nowIso } from "./helpers/helper.js";
import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs";

// ============================================================
// Configuración inicial del entorno
// ============================================================

if (!process.env.FAREBOT_MODE) process.env.FAREBOT_MODE = "adaptative"; // live | mock | adaptative
process.env.FAREBOT_VERSION = "1.3.2";

// ============================================================
// Verificación del modo activo y disponibilidad de Playwright
// ============================================================

async function detectLiveCapability() {
  let playwrightOk = false;
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    await browser.close();
    playwrightOk = true;
    log(`🟢 Playwright disponible @ ${nowIso()}`);
  } catch (err) {
    log(`⚠️  Playwright no disponible @ ${nowIso()} → ${err.message}`);
  }
  return playwrightOk;
}

// ============================================================
// Ejecutor principal
// ============================================================

async function runFarebot() {
  const mode = process.env.FAREBOT_MODE;
  const root = path.resolve(".");
  const scriptPath = path.join(root, "scripts", "farebot.js");

  log(`🚀 Iniciando FareBot v${process.env.FAREBOT_VERSION} en modo [${mode}] @ ${nowIso()}`);

  let canRun = false;
  if (mode === "live" || mode === "adaptative") {
    canRun = await detectLiveCapability();
  }

  const finalMode = canRun ? "live" : "mock";
  log(`🧩 Modo efectivo: ${finalMode}`);

  if (finalMode === "mock") {
    log(`🟡 Ejecutando simulación interna…`);
    await import("./farebot.js"); // fallback simple
    return;
  }

  // ========================================================
  // Ejecución del motor real
  // ========================================================

  const proc = spawn("node", [scriptPath], {
    stdio: "inherit",
    env: { ...process.env, FAREBOT_MODE: finalMode },
  });

  proc.on("close", (code) => {
    log(`✅ FareBot finalizado con código ${code} @ ${nowIso()}`);
  });

  proc.on("error", (err) => {
    log(`❌ Error en ejecución de FareBot: ${err.message}`);
  });
}

// ============================================================
// Ejecución directa (si se llama desde Node)
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  runFarebot().catch((err) => {
    log(`💥 Error fatal en FareBot: ${err.message}`);
    process.exit(1);
  });
}