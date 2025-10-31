// ============================================================
// helper.js — Utilidades comunes para FareBot / Historico / Sync
// ============================================================

import fs from "fs";
import path from "path";

// ------------------------------------------------------------
// 📁 Asegura que un directorio exista (si no, lo crea)
// ------------------------------------------------------------
export const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

// ------------------------------------------------------------
// 📖 Lee un JSON de forma segura (devuelve fallback si falla)
// ------------------------------------------------------------
export const readJsonSafe = (filePath, fallback = {}) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

// ------------------------------------------------------------
// ✍️ Escribe datos JSON en disco (con formato legible)
// ------------------------------------------------------------
export const writeJson = (filePath, data) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

// ------------------------------------------------------------
// 🕒 Devuelve el timestamp actual en formato ISO (UTC)
// ------------------------------------------------------------
export const nowIsoUtc = () => new Date().toISOString();

// ------------------------------------------------------------
// 🪵 Logger formateado con fecha y etiqueta
// ------------------------------------------------------------
export const log = (msg, tag = "INFO") => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${tag}] ${msg}`);
};
