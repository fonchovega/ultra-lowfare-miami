// ============================================================
// helper.js — utilidades comunes para Ultra-LowFare v1.3.2
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ------------------------------------------------------------
// Rutas y configuración base
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------
// Funciones utilitarias de lectura/escritura JSON
// ------------------------------------------------------------

export function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    log(`⚠️ Error leyendo JSON (${filePath}): ${err.message}`);
    return fallback;
  }
}

export function writeJson(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    log(`💾 Guardado JSON: ${filePath}`);
  } catch (err) {
    log(`❌ Error escribiendo JSON (${filePath}): ${err.message}`);
  }
}

export function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    log(`⚠️ No se pudo crear carpeta: ${dirPath} (${err.message})`);
  }
}

// ------------------------------------------------------------
// Logging y timestamp
// ------------------------------------------------------------
export function nowIsoUtc() {
  return new Date().toISOString();
}

export function log(msg) {
  const t = nowIsoUtc().replace("T", " ").split(".")[0];
  console.log(`[${t}] ${msg}`);
}

// ------------------------------------------------------------
// Función delay y control de flujo (usada en scraper y wrapper)
// ------------------------------------------------------------
export async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ------------------------------------------------------------
// Exportación por defecto
// ------------------------------------------------------------
export default {
  readJsonSafe,
  writeJson,
  ensureDir,
  nowIsoUtc,
  log,
  delay,
};
