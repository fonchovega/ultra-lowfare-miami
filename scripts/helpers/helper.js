// scripts/helpers/helper.js
// Utilidades genéricas ES Module — sin template literals (sin backticks)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------------------------------------
// Rutas base (por si algún script necesita __dirname)
// -------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------
// FS helpers básicos
// -------------------------------------------------
export function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    logError("ensureDir() fallo creando directorio: " + String(dirPath), err, "FS");
    return false;
  }
}

export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_e) {
    return false;
  }
}

export function readText(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    logError("readText() no pudo leer: " + String(filePath), err, "FS");
    return fallback;
  }
}

export function writeText(filePath, text) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, String(text), "utf8");
    return true;
  } catch (err) {
    logError("writeText() no pudo escribir: " + String(filePath), err, "FS");
    return false;
  }
}

export function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    logWarn("readJsonSafe() devolviendo fallback para: " + String(filePath), "FS");
    return fallback;
  }
}

export function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    logError("writeJson() no pudo escribir: " + String(filePath), err, "FS");
    return false;
  }
}

/**
 * Asegura que filePath contenga un arreglo JSON.
 * Empuja 'entry' al final y recorta con máximo 'maxLen' si se provee.
 * Retorna el arreglo resultante.
 */
export function appendJsonArray(filePath, entry, maxLen) {
  let arr = readJsonSafe(filePath, []);
  if (!Array.isArray(arr)) {
    logWarn("appendJsonArray() detecto que no era array; reiniciando: " + String(filePath), "FS");
    arr = [];
  }
  arr.push(entry);
  if (typeof maxLen === "number" && maxLen > 0 && arr.length > maxLen) {
    arr = arr.slice(-maxLen);
  }
  writeJson(filePath, arr);
  return arr;
}

// -------------------------------------------------
// JSON / tipos
// -------------------------------------------------
export function safeParseJson(str, fallback) {
  try {
    return JSON.parse(String(str));
  } catch (_e) {
    return fallback;
  }
}

export function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function isArray(v) {
  return Array.isArray(v);
}

export function pick(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

// -------------------------------------------------
// Tiempo / fechas
// -------------------------------------------------
export function nowIso() {
  // ISO con milisegundos Z
  return new Date().toISOString();
}

export function toISO(d) {
  try {
    if (d instanceof Date) return d.toISOString();
    const dd = new Date(d);
    if (!isNaN(dd.getTime())) return dd.toISOString();
    return null;
  } catch (_e) {
    return null;
  }
}

export function fromISO(s) {
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch (_e) {
    return null;
  }
}

export function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// -------------------------------------------------
// Números
// -------------------------------------------------
export function clamp(num, min, max) {
  const n = Number(num);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function round2(n) {
  const x = Number(n);
  if (isNaN(x)) return 0;
  return Math.round(x * 100) / 100;
}

// -------------------------------------------------
// Logs sin template strings (evita backticks)
// -------------------------------------------------
function stamp() {
  return new Date().toISOString();
}

export function log(msg, ctx) {
  const prefix = "[" + stamp() + "] [INFO]";
  if (ctx) {
    console.log(prefix + " [" + String(ctx) + "] " + String(msg));
  } else {
    console.log(prefix + " " + String(msg));
  }
}

export function logWarn(msg, ctx) {
  const prefix = "[" + stamp() + "] [WARN]";
  if (ctx) {
    console.warn(prefix + " [" + String(ctx) + "] " + String(msg));
  } else {
    console.warn(prefix + " " + String(msg));
  }
}

export function logError(msg, err, ctx) {
  const prefix = "[" + stamp() + "] [ERROR]";
  if (ctx) {
    if (err) {
      console.error(prefix + " [" + String(ctx) + "] " + String(msg), err);
    } else {
      console.error(prefix + " [" + String(ctx) + "] " + String(msg));
    }
  } else {
    if (err) {
      console.error(prefix + " " + String(msg), err);
    } else {
      console.error(prefix + " " + String(msg));
    }
  }
}

// -------------------------------------------------
// Detección de origen (mock vs live) robusto
// -------------------------------------------------
/**
 * Intenta inferir si un registro proviene de mock o live
 * Acepta:
 *  - snapshot.meta.modo === "mock" | "live"
 *  - item.fuente contiene "mock" o "simulación"
 *  - banderas opcionales en opts
 */
export function detectSourceKind(entry, opts) {
  try {
    if (!entry) return "unknown";

    // Caso snapshot: { meta: { modo }, resultados: [...] }
    if (entry.meta && typeof entry.meta === "object") {
      if (entry.meta.modo === "mock") return "mock";
      if (entry.meta.modo === "live") return "live";
    }

    // Caso item plano con 'fuente'
    if (entry.fuente && typeof entry.fuente === "string") {
      const f = entry.fuente.toLowerCase();
      if (f.indexOf("mock") >= 0 || f.indexOf("simulación") >= 0 || f.indexOf("simulacion") >= 0) return "mock";
      if (f.indexOf("web") >= 0 || f.indexOf("live") >= 0) return "live";
    }

    // Hints externos
    if (opts && typeof opts === "object") {
      if (opts.forceKind === "mock") return "mock";
      if (opts.forceKind === "live") return "live";
    }

    return "unknown";
  } catch (_e) {
    return "unknown";
  }
}

// -------------------------------------------------
// Export utilidades de ruta si alguien las necesita
// -------------------------------------------------
export const _paths = { __filename, __dirname };
export default {
  ensureDir,
  fileExists,
  readText,
  writeText,
  readJsonSafe,
  writeJson,
  appendJsonArray,
  safeParseJson,
  isObject,
  isArray,
  pick,
  nowIso,
  toISO,
  fromISO,
  sleep,
  clamp,
  round2,
  log,
  logWarn,
  logError,
  detectSourceKind,
  _paths
};