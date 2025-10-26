// scripts/local_runner.js
// Runner local: ejecuta FareBot y actualiza histórico usando la misma lógica del guard.
// Se ejecuta ahora y luego cada hora automáticamente.

import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const CFG_PATH = "./config.json";
const LOG_DIR = "./logs";
const LOG_FILE = path.join(LOG_DIR, "local_runner.log");

// ✅ Asegura que exista la carpeta de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ✅ Función para registrar logs con timestamp
function logLine(line) {
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, [${stamp}] ${line}\n);
  console.log(line);
}

// ✅ Leer configuración
function readCfg() {
  try {
    const raw = fs.readFileSync(CFG_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    logLine(❌ Error leyendo config.json: ${err.message});
    return {};
  }
}

// ✅ Determinar si debe ejecutarse en esta hora
function shouldRunNow(cfg) {
  if (cfg.auto_runs === false) {
    logLine("🚫 auto_runs = false → se omite ejecución automática.");
    return false;
  }

  const runsPerDay = Number.isFinite(Number(cfg.auto_runs_per_day))
    ? Number(cfg.auto_runs_per_day)
    : 8;
  const everyHours = Number.isFinite(Number(cfg.run_every_hours))
    ? Number(cfg.run_every_hours)
    : Math.max(1, Math.floor(24 / runsPerDay));
  const tz = cfg.timezone || "UTC";

  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const hour = Number(parts.hour);
  const ok = (hour % everyHours) === 0;

  logLine(🕓 Hora local (${tz}): ${hour}:00 | cada ${everyHours}h → shouldRun=${ok});
  return ok;
}

// ✅ Ejecuta FareBot y actualiza histórico si hay cambios
function runOnce() {
  try {
    const cfg = readCfg();
    if (!shouldRunNow(cfg)) {
      logLine("⏭️ Saltado por ventana horaria.");
      return;
    }

    logLine("🚀 Ejecutando FareBot...");
    execSync("node scripts/farebot.js", { stdio: "inherit" });

    // Verificar si hubo cambios en data.json
    const changed = execSync("git diff --quiet -- data.json || echo CHANGED")
      .toString()
      .includes("CHANGED");

    if (changed) {
      logLine("💾 data.json cambió → actualizando histórico...");
      execSync("node scripts/historico.js", { stdio: "inherit" });
      logLine("✅ Histórico actualizado.");
    } else {
      logLine("ℹ️ data.json no cambió → sin actualización de histórico.");
    }
  } catch (err) {
    logLine(❌ Error en runOnce: ${err.message});
  }
}

// ✅ Ejecutar inmediatamente y repetir cada hora
logLine("🟢 Iniciando local_runner...");
runOnce();
setInterval(runOnce, 60 * 60 * 1000);
