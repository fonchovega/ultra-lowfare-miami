// scripts/helpers/helper.js
// Ultra-LowFare · Helper base v1.3.3
// Utilidades de FS, paths, fechas y logging. Sin dependencias externas.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------- Rutas/Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Resuelve rutas relativas al repo raíz (subiendo desde /scripts/helpers)
export function resolveRepoPath(...segments) {
  // /scripts/helpers -> repo root = ../..
  const repoRoot = path.resolve(__dirname, "..", "..");
  return path.resolve(repoRoot, ...segments);
}

// Asegura existencia de carpeta
export function ensureDir(dirPath) {
  if (!dirPath) return;
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// ---------- Lectura/Escritura segura ----------
export function readFileSafe(filePath, fallback = "") {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

export function writeFileSafe(filePath, content = "") {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

export function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJsonSafe(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// Añade un item a un JSON array en disco (crea si no existe)
// cap: recorta a las últimas "cap" entradas (FIFO)
export function appendJsonArray(filePath, item, cap = null) {
  let arr = readJsonSafe(filePath, []);
  if (!Array.isArray(arr)) arr = [];
  arr.push(item);
  if (typeof cap === "number" && cap > 0 && arr.length > cap) {
    arr = arr.slice(-cap);
  }
  writeJsonSafe(filePath, arr);
  return arr.length;
}

// Lee JSON que puede ser array o "array de arrays" y lo aplana (solo 1 nivel)
export function readJsonFlatten(filePath, fallback = []) {
  const data = readJsonSafe(filePath, fallback);
  if (Array.isArray(data)) {
    // Si es [[...], [...]] lo aplano
    if (data.length > 0 && Array.isArray(data[0])) {
      return data.flat();
    }
    return data;
  }
  return fallback;
}

// ---------- Archivos utilitarios ----------
export function listFilesRecursive(startDir, filterFn = null) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out.push(full);
    }
  }
  walk(startDir);
  return filterFn ? out.filter(filterFn) : out;
}

export function listJsonFiles(dir) {
  return listFilesRecursive(dir, (p) => p.toLowerCase().endsWith(".json"));
}

// ---------- Fechas/Horas ----------
export function nowIso() {
  return new Date().toISOString();
}

// Retorna string con hora local CST (America/Chicago)
export function nowCstString() {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    // "MM/DD/YYYY, HH:MM:SS"
    const s = fmt.format(new Date());
    // Lo convierto a "YYYY-MM-DD HH:MM:SS CST"
    const [mdy, hms] = s.split(",").map((t) => t.trim());
    const [m, d, y] = mdy.split("/");
    return `${y}-${m}-${d} ${hms} CST`;
  } catch {
    return `${new Date().toISOString()} CST`;
  }
}

// ---------- Logging ----------
export function logInfo(msg, ctx = "") {
  const prefix = `[INFO] ${new Date().toISOString()}`;
  console.log(ctx ? `${prefix} [${ctx}] ${msg}` : `${prefix} ${msg}`);
}

export function logWarn(msg, ctx = "") {
  const prefix = `[WARN] ${new Date().toISOString()}`;
  console.warn(ctx ? `${prefix} [${ctx}] ${msg}` : `${prefix} ${msg}`);
}

export function logError(msg, ctx = "", err = null) {
  const prefix = `[ERROR] ${new Date().toISOString()}`;
  if (err) {
    console.error(ctx ? `${prefix} [${ctx}] ${msg}`, err);
  } else {
    console.error(ctx ? `${prefix} [${ctx}] ${msg}` : `${prefix} ${msg}`);
  }
}

// ---------- Constantes por defecto ----------
export const DEFAULT_PATHS = {
  dataDir:        resolveRepoPath("data"),
  dataSnapshot:   resolveRepoPath("data", "data.json"),
  historicoFile:  resolveRepoPath("data", "historico.json"),
  historicoAudit: resolveRepoPath("data", "historico_unknown_samples.json"),
};

// ---------- Helpers de validación ligera ----------
export function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function coerceArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

// ---------- Carga/guarda típicas de este proyecto ----------
export function loadHistorico() {
  return readJsonSafe(DEFAULT_PATHS.historicoFile, []);
}

export function saveHistorico(arr) {
  if (!Array.isArray(arr)) arr = coerceArray(arr);
  writeJsonSafe(DEFAULT_PATHS.historicoFile, arr);
}

export function loadSnapshot() {
  return readJsonSafe(DEFAULT_PATHS.dataSnapshot, null);
}

export function saveSnapshot(obj) {
  writeJsonSafe(DEFAULT_PATHS.dataSnapshot, obj ?? {});
}

// ---------- Export meta ----------
export const __helper_version = "1.3.3";
export const __helper_dir = __dirname;
