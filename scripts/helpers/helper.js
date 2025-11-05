// ===================================================================
// scripts/helpers/helper.js
// Utilidades generales usadas por todos los módulos de Ultra-LowFare
// ===================================================================

import fs from "fs/promises";
import path from "path";

// ---------------------------------------------------------------
// Formato fecha y hora ISO UTC
// ---------------------------------------------------------------
export function nowIsoUtc() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------
// Limpieza de texto
// ---------------------------------------------------------------
export function cleanString(str) {
  if (typeof str !== "string") return str;
  return str.trim().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------
// Logs unificados (sin backticks)
// ---------------------------------------------------------------
function prefixMsg(level) {
  return "[" + level.toUpperCase() + "]";
}

export function logInfo(msg, ctx) {
  const prefix = prefixMsg("info");
  if (ctx) console.log(prefix + " [" + ctx + "] " + msg);
  else console.log(prefix + " " + msg);
}

export function logWarn(msg, ctx) {
  const prefix = prefixMsg("warn");
  if (ctx) console.warn(prefix + " [" + ctx + "] " + msg);
  else console.warn(prefix + " " + msg);
}

export function logError(msg, ctx, err) {
  const prefix = prefixMsg("error");
  if (ctx) console.error(prefix + " [" + ctx + "] " + msg, err);
  else console.error(prefix + " " + msg, err);
}

// ---------------------------------------------------------------
// Lectura y escritura de JSON segura
// ---------------------------------------------------------------
export async function readJsonSafe(filepath, defaultValue) {
  try {
    const data = await fs.readFile(filepath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    logWarn("No se pudo leer " + filepath + " (" + e.message + ")", "readJsonSafe");
    return defaultValue;
  }
}

export async function writeJson(filepath, data) {
  try {
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(filepath, json, "utf-8");
    logInfo("Archivo guardado: " + filepath, "writeJson");
  } catch (e) {
    logError("No se pudo escribir JSON en " + filepath, "writeJson", e);
  }
}

// ---------------------------------------------------------------
// Crear carpeta si no existe
// ---------------------------------------------------------------
export async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e) {
    logError("No se pudo crear directorio: " + dirPath, "ensureDir", e);
  }
}

// ---------------------------------------------------------------
// Otras utilidades menores
// ---------------------------------------------------------------
export function readJsonSync(filePath, defaultValue) {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return defaultValue;
  }
}

export function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------
// Fin del módulo
// ---------------------------------------------------------------
