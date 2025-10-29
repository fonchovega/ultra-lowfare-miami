// run_logger.js — registra por corrida qué proveedores se usaron y parámetros clave
import fs from "fs";
const LOG_PATH = "./data/run_log.json";

export function logRun(entry) {
  const now = new Date().toISOString();
  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")); } catch {}
  arr.push({ when: now, ...entry });
  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(arr, null, 2), "utf8");
}
