// scripts/farebot_v132.js
// ------------------------------------------------------------
// Wrapper v1.3.2 (adaptativo) para mantener compatibilidad.
// ------------------------------------------------------------

import { log, nowIsoUtc } from "./helpers/helper.js";

if (!process.env.FAREBOT_MODE) process.env.FAREBOT_MODE = "adaptative";
process.env.FAREBOT_VERSION = "1.3.2";

log(`▶️  Iniciando FareBot v${process.env.FAREBOT_VERSION} [${process.env.FAREBOT_MODE}] @ ${nowIsoUtc()}`);

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
