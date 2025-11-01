// ============================================================
// helper.js — utilidades comunes para Ultra-LowFare v1.3.2
// ============================================================

import fs from "fs";
import path from "path";

// ------------------------------------------------------------
// 🧩 Manejo de directorios y archivos JSON
// ------------------------------------------------------------
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ------------------------------------------------------------
// 🧩 Manejo seguro de texto plano
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// 🧩 Registro técnico estandarizado
// ------------------------------------------------------------
export function log(msg, tag = "INFO") {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${tag}] ${msg}`);
}

// ------------------------------------------------------------
// 🔗 buildDeepLink — genera enlaces dinámicos a partir de plantilla
// ------------------------------------------------------------
export function buildDeepLink(template, route = {}) {
  if (!template) return null;
  try {
    let link = template;
    if (route.from) link = link.replace("{from}", route.from);
    if (route.to) link = link.replace("{to}", route.to);
    if (route.dep) link = link.replace("{dep}", route.dep);
    if (route.ret) link = link.replace("{ret}", route.ret);
    return link;
  } catch {
    return null;
  }
}
