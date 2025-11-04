// scripts/helpers/helper.js
// ============================================================
// Core utilidades base del sistema Ultra-LowFare
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// === Paths base ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ROOT apunta a la raíz del proyecto (2 niveles arriba)
export const ROOT = path.resolve(__dirname, "..", "..");
export const DATA_DIR = path.join(ROOT, "data");
export const LOG_DIR = path.join(ROOT, "logs");

// ============================================================
// Funciones de sistema de archivos
// ============================================================

/** Garantiza que exista un directorio, y si no, lo crea. */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

/** Lee un JSON y devuelve su contenido, o un valor por defecto si falla. */
export function readJson(filePath, fallback = null) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    log(`[readJson] Error leyendo ${filePath}: ${err.message}`);
    return fallback;
  }
}

/** Escribe datos JSON formateados en un archivo. */
export function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    log(`[writeJson] Error escribiendo ${filePath}: ${err.message}`);
  }
}

/** Resuelve rutas relativas desde la raíz del proyecto. */
export function resolvePath(...parts) {
  return path.join(ROOT, ...parts);
}

// ============================================================
// Utilidades de tiempo y logging
// ============================================================

/** Devuelve un timestamp ISO UTC. */
export function nowIsoUtc() {
  return new Date().toISOString();
}

/** Registra mensajes tanto en consola como en archivo. */
export function log(...args) {
  const msg = args.join(" ");
  console.log(msg);

  try {
    ensureDir(LOG_DIR);
    const logFile = path.join(LOG_DIR, `run_${nowIsoUtc().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, `[${nowIsoUtc()}] ${msg}\n`, "utf8");
  } catch {
    /* ignora errores de escritura */
  }
}

// ============================================================
// Funciones auxiliares generales
// ============================================================

/** Devuelve true si dos objetos JSON difieren. */
export function diffJson(before, after) {
  try {
    const b = JSON.stringify(before);
    const a = JSON.stringify(after);
    return { changed: b !== a };
  } catch (err) {
    log(`[diffJson] Error comparando objetos: ${err.message}`);
    return { changed: true };
  }
}

/** Retrasa la ejecución por cierto número de milisegundos. */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Convierte un valor posiblemente string a número válido. */
export function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ============================================================
// Exportación por defecto (compatibilidad antigua)
// ============================================================
export default {
  ROOT,
  DATA_DIR,
  LOG_DIR,
  ensureDir,
  readJson,
  writeJson,
  resolvePath,
  nowIsoUtc,
  log,
  diffJson,
  delay,
  toNumber,
};
