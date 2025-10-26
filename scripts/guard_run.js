// scripts/guard_run.js
// Controla si ejecutar automáticamente la búsqueda de FareBot según config.json
// Escribe también un registro de auditoría en logs/guard.log
// Compatible con GitHub Actions y ejecución local

import fs from "fs";
import path from "path";

const CFG_PATH = "./config.json";
const LOG_DIR = "./logs";
const LOG_FILE = path.join(LOG_DIR, "guard.log");

// ✅ Crea carpeta de logs si no existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ✅ Función para registrar salida en workflow y logs
function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

// ✅ Función para escribir en logs con timestamp
function logLine(line) {
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${stamp}] ${line}\n`);
  console.log(line);
}

// 🧩 Lógica principal
try {
  const raw = fs.readFileSync(CFG_PATH, "utf8");
  const cfg = JSON.parse(raw);

  const auto = cfg.auto_runs !== false; // Por defecto true
  const runsPerDay = Number.isFinite(Number(cfg.auto_runs_per_day))
    ? Number(cfg.auto_runs_per_day)
    : 8;
  const everyHours = Number.isFinite(Number(cfg.run_every_hours))
    ? Number(cfg.run_every_hours)
    : Math.max(1, Math.floor(24 / runsPerDay));
  const tz = cfg.timezone || "UTC";

  if (!auto) {
    const msg = "🚫 Auto-runs desactivado. Se omite ejecución automática.";
    logLine(msg);
    setOutput("should", "false");
    process.exit(0);
  }

  // 🕒 Determinar hora local
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const hour = Number(parts.hour);

  // ⚙️ Evaluar si ejecutar o no
  const shouldRun = hour % everyHours === 0;

  // 🧾 Registro informativo
  const summary = [
    `🕓 Hora local (${tz}): ${hour}:00`,
    `⚙️ Intervalo configurado: cada ${everyHours}h`,
    `📆 Ejecutar: ${shouldRun ? "✅ Sí" : "⏭️ No (fuera del intervalo configurado)"}`,
  ].join(" | ");

  logLine(summary);
  setOutput("should", shouldRun ? "true" : "false");
  logLine(`➡️ setOutput should=${shouldRun ? "true" : "false"}`);

  process.exit(0);

} catch (err) {
  const msg = `❌ Error leyendo config.json: ${err.message}`;
  logLine(msg);
  // En caso de error, permitir ejecución para no detener flujo
  setOutput("should", "true");
  process.exit(0);
}
