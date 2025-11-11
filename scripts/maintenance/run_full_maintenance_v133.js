/**
 * Ultra-LowFare Maintenance v1.3.3
 * Ejecuta verificación, normalización y sincronización completa
 * Autor: fonchovega
 */

import { execSync } from "child_process";
import fs from "fs";

console.log("🚀 Iniciando mantenimiento completo v1.3.3...");

const steps = [
  { label: "Auditoría de histórico", cmd: "node scripts/helpers/auditor_v133.js" },
  { label: "Healthcheck", cmd: "node scripts/helpers/healthcheck_v133.js" },
  { label: "Normalización de shapes", cmd: "node scripts/audit_historico_shapes_v133.js" },
  { label: "Reparación de unknowns", cmd: "node scripts/helpers/fix_unknowns_v133.js --apply" },
  { label: "Sincronización Git (pull + commit + push)", cmd: "bash scripts/git_sync.sh" }
];

for (const step of steps) {
  try {
    console.log(`\n🧩 ${step.label}...`);
    execSync(step.cmd, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ Error en paso: ${step.label}`);
    console.error(err.message);
    process.exit(1);
  }
}

console.log("\n✅ Mantenimiento completo finalizado con éxito.");

// Registro de mantenimiento
const logDir = "./logs";
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFile = `${logDir}/maintenance_${timestamp}.log`;
fs.writeFileSync(logFile, `Mantenimiento ejecutado: ${new Date().toLocaleString()}\nOK\n`);

console.log(`📝 Log guardado en ${logFile}`);
