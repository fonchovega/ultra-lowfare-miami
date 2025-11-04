// ============================================================
// helper.js — Utilidades comunes para FareBot / Historico / Sync
// ============================================================

import fs from "fs";
import path from "path";

// ------------------------------------------------------------
// Creación segura de directorios
// ------------------------------------------------------------
export const ensureDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.error(`⚠️ Error creando directorio ${dirPath}:`, err.message);
  }
};

// ------------------------------------------------------------
// Lectura segura de JSON
// ------------------------------------------------------------
export const readJsonSafe = (filePath, fallback = {}) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn(`⚠️ Error leyendo ${filePath}:`, err.message);
    return fallback;
  }
};

// ------------------------------------------------------------
// Escritura segura de JSON
// ------------------------------------------------------------
export const writeJson = (filePath, data) => {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`⚠️ Error escribiendo ${filePath}:`, err.message);
  }
};

// ------------------------------------------------------------
// Lectura / escritura de texto plano
// ------------------------------------------------------------
export const readFileSafe = (filePath, fallback = "") => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.warn(`⚠️ Error leyendo archivo ${filePath}:`, err.message);
    return fallback;
  }
};

export const writeFileSafe = (filePath, content = "") => {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
  } catch (err) {
    console.error(`⚠️ Error escribiendo archivo ${filePath}:`, err.message);
  }
};

// ------------------------------------------------------------
// Timestamps y logging
// ------------------------------------------------------------
export const nowIsoUtc = () => new Date().toISOString();

export const log = (msg, tag = "INFO") => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${tag}] ${msg}`);
};

// ------------------------------------------------------------
// Exportación por defecto (compatibilidad)
// ------------------------------------------------------------
export default {
  ensureDir,
  readJsonSafe,
  writeJson,
  readFileSafe,
  writeFileSafe,
  nowIsoUtc,
  log,
};
