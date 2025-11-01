// ============================================================
// provider_registry.js — Alta/actualización de proveedores dinámicos
// ============================================================

import fs from "fs";

const SOURCES_PATH = "./data/sources.json";
const ALIASES_PATH = "./data/provider_aliases.json";

function readJsonSafe(p, fb) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; } }
function writeJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8"); }

export function normalizeProviderId(displayName) {
  const aliases = readJsonSafe(ALIASES_PATH, { airlines: {}, metas: {} });
  const name = String(displayName || "").trim();

  const pools = [aliases.airlines || {}, aliases.metas || {}];
  for (const pool of pools) {
    for (const [id, list] of Object.entries(pool)) {
      if (id.toLowerCase() === name.toLowerCase()) return id;
      if (Array.isArray(list) && list.some(a => String(a).toLowerCase() === name.toLowerCase())) return id;
    }
  }

  return name
    .replace(/airlines?/i, "")
    .replace(/metas?/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/^\d+/, "")
    || "Provider";
}

function loadSources() {
  const src = readJsonSafe(SOURCES_PATH, {});
  src.DEFAULT ||= { metabuscadores: [], aerolineas: [] };
  return src;
}

function ensureDefaultDescriptor(src, kind, id, name, link = "") {
  const list = src.DEFAULT[kind] ||= [];
  const found = list.find(x => (typeof x === "string" ? x === id : x.id === id));
  if (!found) list.push({ id, name: name || id, link: link || "" });
}

function addToDestination(src, destKey, kind, id) {
  const group = src[destKey] ||= { metabuscadores: [], aerolineas: [] };
  const arr = group[kind] ||= [];
  const already =
    arr.some(x => (typeof x === "string" ? x === id : x?.id === id)) ||
    (Array.isArray(arr) && arr.includes(id));
  if (!already) arr.push(id);
}

export function registerProviderIfMissing({ kind, destKey, displayName, link = "", nameOverride = "" }) {
  if (!["aerolineas", "metabuscadores"].includes(kind)) throw new Error(`kind inválido: ${kind}`);
  if (!destKey) throw new Error("destKey requerido");
  if (!displayName) throw new Error("displayName requerido");

  const id = normalizeProviderId(displayName);
  const src = loadSources();

  ensureDefaultDescriptor(src, kind, id, nameOverride || displayName, link);

  const before = JSON.stringify(src[destKey] || {});
  addToDestination(src, destKey, kind, id);
  const after = JSON.stringify(src[destKey] || {});
  const updated = before !== after;

  writeJson(SOURCES_PATH, src);
  return { id, destKey, updated };
}
