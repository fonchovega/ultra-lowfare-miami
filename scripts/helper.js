// ============================================================
// helper.js — Utilidades comunes para FareBot / Historico / Sync
// ============================================================

import fs from "fs";
import path from "path";

export const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

export const readJsonSafe = (filePath, fallback = {}) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

export const writeJson = (filePath, data) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

export const readFileSafe = (filePath, fallback = "") => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
};

export const writeFileSafe = (filePath, content) => {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
  } catch (err) {
    console.error(`[ERROR] writeFileSafe fallo en ${filePath}: ${err.message}`);
  }
};

export const nowIsoUtc = () => new Date().toISOString();

export const log = (msg, tag = "INFO") => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${tag}] ${msg}`);
};