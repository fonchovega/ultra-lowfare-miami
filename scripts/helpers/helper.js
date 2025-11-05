// ===================================================================
// helper.js  — versión limpia (sin backticks / Node 20+ compatible)
// Proyecto: Ultra-LowFare v1.3.3
// Autor: Víctor A. Vega Huertas
// Descripción: Funciones utilitarias para lectura, escritura y logs.
// ===================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------------------------------------------------------
// Resolver rutas base
// -------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolvePath(relPath) {
  return path.resolve(__dirname, "..", relPath);
}

// -------------------------------------------------------------------
// Funciones de lectura / escritura JSON
// -------------------------------------------------------------------
export function readJsonSafe(filePath, defaultValue = null) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    logWarn("No se pudo leer o parsear el archivo: " + filePath, "readJsonSafe");
    return defaultValue;
  }
}

export function writeJson(filePath, data, pretty = true) {
  try {
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    fs.writeFileSync(filePath, json, "utf-8");
    logInfo("Archivo guardado correctamente en: " + filePath, "writeJson");
  } catch (err) {
    logError("Error al escribir archivo JSON: " + filePath, "writeJson", err);
  }
}

// -------------------------------------------------------------------
// Funciones auxiliares de fecha y hora
// -------------------------------------------------------------------
export function nowIsoUtc() {
  return new Date().toISOString();
}

export function formatDateTime(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + mi + ":" + ss;
}

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logInfo("Carpeta creada: " + dirPath, "ensureDir");
  }
}

// -------------------------------------------------------------------
// Utilidad para limpiar texto
// -------------------------------------------------------------------
export function cleanString(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------------------------------------------
// Funciones para archivos genéricos
// -------------------------------------------------------------------
export function listFilesRecursive(dir, extFilter = null) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(listFilesRecursive(fullPath, extFilter));
    } else {
      if (!extFilter || file.endsWith(extFilter)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

// -------------------------------------------------------------------
// Logging helpers (sin backticks, resistentes a WhatsApp)
// -------------------------------------------------------------------
export function logInfo(msg, ctx = null) {
  const prefix = "ℹ️ INFO:";
  if (ctx) console.log(prefix + " [" + ctx + "] " + msg);
  else console.log(prefix + " " + msg);
}

export function logWarn(msg, ctx = null) {
  const prefix = "⚠️ WARN:";
  if (ctx) console.warn(prefix + " [" + ctx + "] " + msg);
  else console.warn(prefix + " " + msg);
}

export function logError(msg, ctx = null, err = null) {
  const prefix = "❌ ERROR:";
  if (ctx && err)
    console.error(prefix + " [" + ctx + "] " + msg + "\n" + (err.stack || err));
  else if (ctx)
    console.error(prefix + " [" + ctx + "] " + msg);
  else if (err)
    console.error(prefix + " " + msg + "\n" + (err.stack || err));
  else
    console.error(prefix + " " + msg);
}

// -------------------------------------------------------------------
// Exportaciones principales
// -------------------------------------------------------------------
export default {
  resolvePath,
  readJsonSafe,
  writeJson,
  nowIsoUtc,
  formatDateTime,
  ensureDir,
  cleanString,
  listFilesRecursive,
  logInfo,
  logWarn,
  logError,
};
