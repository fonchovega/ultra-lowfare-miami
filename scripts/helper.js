// ============================================================
// helper.js — Utilidades comunes (ESM) para FareBot / Front / Históricos
// ============================================================

import fs from "fs";
import path from "path";

// ---------------------------
// FS helpers
// ---------------------------
export const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

export const ensureFile = (filePath) => {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "", "utf8");
  return filePath;
};

export const readJsonSafe = (filePath, fallback = {}) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeJson = (filePath, data) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
};

export const writeJsonAtomic = (filePath, data) => {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return filePath;
};

export const readFileSafe = (filePath, fallback = "") => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
};

export const writeFileSafe = (filePath, content = "") => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
};

// ---------------------------
// Históricos con tope
// ---------------------------
export const appendJsonArrayCapped = (filePath, item, limit = 600, atomic = true) => {
  let arr = readJsonSafe(filePath, []);
  if (!Array.isArray(arr)) arr = [];
  arr.push(item);
  if (limit && arr.length > limit) arr = arr.slice(-limit);
  return atomic ? writeJsonAtomic(filePath, arr) : writeJson(filePath, arr);
};

// ---------------------------
// Utilidades varias
// ---------------------------
export const nowIsoUtc = () => new Date().toISOString();

export const log = (msg, tag = "INFO") => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${tag}] ${msg}`);
};

export const normPath = (p) => p.replace(/^\.?\/*/, "");

export const shortSha = () => {
  const sha = process.env.GITHUB_SHA || "";
  return sha ? sha.slice(0, 7) : "";
};

export const tryParseJson = (str) => {
  try { return JSON.parse(str); } catch { return null; }
};

export const writeIfChanged = (filePath, content) => {
  const prev = readFileSafe(filePath, null);
  if (prev === null || prev !== content) {
    writeFileSafe(filePath, content);
    return true;
  }
  return false;
};

export const writeJsonIfChanged = (filePath, obj) => {
  const next = JSON.stringify(obj, null, 2);
  return writeIfChanged(filePath, next);
};
