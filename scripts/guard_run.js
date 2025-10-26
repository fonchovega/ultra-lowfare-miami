// scripts/guard_run.js
// Controla si se ejecuta o se salta el ciclo automático, según config.json

import fs from "fs";

const CFG_PATH = "./config.json";

// Función auxiliar para pasar outputs al workflow (si se usa en GitHub Actions)
function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

try {
  // Leer configuración
  const raw = fs.readFileSync(CFG_PATH, "utf8");
  const cfg = JSON.parse(raw);

  const auto = cfg.auto_runs !== false; // por defecto true
  const runsPerDay = Number(cfg.auto_runs_per_day ?? 8);
  const everyHours = Number(cfg.run_every_hours ?? (24 / runsPerDay));
  const tz = cfg.timezone || "UTC";

  if (!auto) {
    console.log("🟡 auto_runs está desactivado. Se omite ejecución automática.");
    setOutput("should", "false");
    process.exit(0);
  }

  // Determinar hora local
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const hour = Number(parts.hour);

  const shouldRun = (hour % everyHours) === 0;

  console.log(`🕓 Hora local (${tz}): ${hour}:00`);
  console.log(`⚙️  Intervalo configurado: cada ${everyHours} h`);
  console.log(`📅 Resultado → shouldRun=${shouldRun}`);

  setOutput("should", shouldRun ? "true" : "false");
} catch (err) {
  console.error("❌ Error leyendo config.json:", err);
  // En caso de error, se permite ejecutar para no interrumpir el flujo.
  setOutput("should", "true");
}
