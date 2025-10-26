// scripts/local_runner.js
// Versión local del flujo automatizado de FareBot (sin GitHub Actions)

import cron from "node-cron";
import { exec } from "child_process";
import fs from "fs";

const GUARD = "scripts/guard_run.js";
const FAREBOT = "scripts/farebot.js";
const LOG_FILE = "./logs/local_runner.log";

// ✅ Función auxiliar para registrar logs
function log(msg) {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

// ✅ Función para ejecutar un script Node y capturar su salida
function runScript(script) {
  return new Promise((resolve) => {
    exec(`node ${script}`, (error, stdout, stderr) => {
      if (error) {
        log(`❌ Error ejecutando ${script}: ${error.message}`);
        resolve(false);
        return;
      }
      log(`📜 ${script} stdout:\n${stdout}`);
      if (stderr) log(`⚠️ stderr:\n${stderr}`);
      resolve(stdout.includes("✅ Sí") || stdout.includes("should=true"));
    });
  });
}

// 🕓 Cargar configuración
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const runsPerDay = Number(config.auto_runs_per_day ?? 8);
const everyHours = Number(config.run_every_hours ?? 24 / runsPerDay);
const cronExpr = `0 */${everyHours} * * *`; // cada X horas al minuto 0

log("🚀 Local Runner iniciado");
log(`🕒 Cadencia: cada ${everyHours} horas (${runsPerDay} corridas por día)`);

// 🧩 Programar tarea
cron.schedule(cronExpr, async () => {
  log("⏱️ Ejecución programada iniciada...");
  const shouldRun = await runScript(GUARD);

  if (shouldRun) {
    log("✅ Guard aprobó ejecución — iniciando FareBot...");
    await runScript(FAREBOT);
  } else {
    log("⏭️ Guard bloqueó ejecución (fuera de intervalo configurado)");
  }
});

log("🕹️ Cron job activo. Presiona Ctrl+C para detener.");
