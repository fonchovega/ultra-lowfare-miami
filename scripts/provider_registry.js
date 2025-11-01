// ============================================================
// provider_registry.js — Alta/actualización de proveedores dinámicos
// v1.3.1 (adaptativo)
// ============================================================

import fs from "fs";
import path from "path";

const SOURCES_PATH = "./data/sources.json";
const ALIASES_PATH = "./data/provider_aliases.json";

// ---------------- Utils ----------------
function readJsonSafe(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fb; }
}
function writeJson(p, data) {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

// ---------------- Normalización ----------------
/**
 * Convierte un nombre visible (ej. "Aerojet Airlines") a un ID estable (ej. "Aerojet"),
 * usando alias definidos en data/provider_aliases.json. Si no hay alias, genera un id derivado.
 */
export function normalizeProviderId(displayName) {
  const aliases = readJsonSafe(ALIASES_PATH, { airlines: {}, metas: {} });
  const name = String(displayName || "").trim();
  if (!name) return "Provider";

  // Busca en airlines y metas (case-insensitive)
  const pools = [aliases.airlines || {}, aliases.metas || {}];
  for (const pool of pools) {
    for (const [id, list] of Object.entries(pool)) {
      if (id.toLowerCase() === name.toLowerCase()) return id;
      if (Array.isArray(list) && list.some(a => String(a).toLowerCase() === name.toLowerCase())) return id;
    }
  }

  // Fallback: sanea el nombre para usarlo como id
  const sanitized = name
    .replace(/airlines?/ig, "")
    .replace(/metas?/ig, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/^\d+/, "");

  return sanitized || "Provider";
}

// ---------------- Núcleo de registro ----------------
function loadSources() {
  const src = readJsonSafe(SOURCES_PATH, {});
  // Asegura estructura base
  src.DEFAULT ||= { metabuscadores: [], aerolineas: [] };
  return src;
}

/**
 * Asegura que en DEFAULT exista un descriptor objeto para el id dado.
 * Si ya existe una cadena simple igual al id, lo deja; si no existe, agrega objeto.
 */
function ensureDefaultDescriptor(src, kind, id, name, link = "", tag = "") {
  const list = src.DEFAULT[kind] ||= [];
  const idx = list.findIndex(x => (typeof x === "string" ? x === id : x?.id === id));

  if (idx === -1) {
    const obj = { id, name: name || id };
    if (link) obj.link = link;
    if (tag)  obj.tag  = tag; // p.ej., "learned"
    list.push(obj);
  } else if (typeof list[idx] !== "string") {
    // Completa campos si faltan
    const cur = list[idx];
    if (!cur.name && name) cur.name = name;
    if (link && !cur.link) cur.link = link;
    if (tag && !cur.tag)   cur.tag  = tag;
  }
}

/**
 * Agrega el id al destino lógico (p.ej., "MIA_AREA" o "SJU") dentro de kind (aerolineas/metabuscadores).
 * Soporta que el array contenga strings o objetos con {id,...}
 */
function addToDestination(src, destKey, kind, id) {
  const group = src[destKey] ||= { metabuscadores: [], aerolineas: [] };
  const arr = group[kind] ||= [];

  const exists = arr.some(x => (typeof x === "string" ? x === id : x?.id === id));
  if (!exists) arr.push(id);
}

/**
 * Registra un proveedor si no existe:
 * - Normaliza nombre → id
 * - Asegura descriptor en DEFAULT
 * - Lo agrega al destino lógico (ej. "MIA_AREA", "SJU")
 *
 * @param {Object} p
 * @param {"aerolineas"|"metabuscadores"} p.kind
 * @param {string} p.destKey                Destino lógico (ej. "MIA_AREA", "SJU")
 * @param {string} p.displayName            Nombre visto (ej. "Aerojet Airlines")
 * @param {string} [p.link]                 URL base del proveedor (opcional)
 * @param {string} [p.nameOverride]         Nombre visible preferido (opcional)
 * @param {string} [p.tag="learned"]        Etiqueta (ej. "learned")
 * @returns {{id:string, destKey:string, updated:boolean}}
 */
export function registerProviderIfMissing({
  kind,
  destKey,
  displayName,
  link = "",
  nameOverride = "",
  tag = "learned"
}) {
  if (!["aerolineas", "metabuscadores"].includes(kind)) {
    throw new Error(`kind inválido: ${kind}`);
  }
  if (!destKey) throw new Error("destKey requerido");
  if (!displayName) throw new Error("displayName requerido");

  const id = normalizeProviderId(displayName);
  const src = loadSources();

  // 1) Asegura descriptor en DEFAULT (para que el selector pueda mapear id → objeto)
  ensureDefaultDescriptor(src, kind, id, nameOverride || displayName, link, tag);

  // 2) Agrega al destino lógico
  const before = JSON.stringify(src[destKey] || {});
  addToDestination(src, destKey, kind, id);
  const after = JSON.stringify(src[destKey] || {});
  const updated = before !== after;

  // 3) Persistir
  writeJson(SOURCES_PATH, src);

  return { id, destKey, updated };
}
