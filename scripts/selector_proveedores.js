// ============================================================
// scripts/selector_proveedores.js
// Ultra-LowFare v1.3.1 — selección dinámica de metabuscadores y aerolíneas
// - Carga sources locales (sources.json / provider_aliases.json opcional)
// - Filtra por país origen/destino
// - Scoring dinámico (scoring.js)
// - Deep links sin depender de fx-helpers.js
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------- Paths base
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SOURCES_PATH  = path.join(__dirname, "..", "sources.json");
const ALIASES_PATH  = path.join(__dirname, "..", "provider_aliases.json"); // opcional

// ---------- Límites de selección
const META_CAP = 8;  // Máx. metabuscadores
const AIR_CAP  = 10; // Máx. aerolíneas

// ---------- Utilidades locales
function readJsonSafe(p, fb) {
  try {
    if (!fs.existsSync(p)) return fb;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fb;
  }
}

// Mapear códigos IATA a país (ampliable)
function guessCountry(iata) {
  const map = {
    LIM: "PE",
    MIA: "US", FLL: "US", MCO: "US",
    ORD: "US", MSN: "US", MKE: "US",
    SJU: "US"
  };
  return map[iata] || "US";
}

// Sustituye placeholders {from},{to},{dep},{ret},{adt} en plantillas de deeplink
function buildDeepLink(template, route) {
  if (!template || typeof template !== "string") return null;
  const rep = {
    "{from}": route?.from ?? "",
    "{to}":   route?.to ?? "",
    "{dep}":  route?.dep ?? "",
    "{ret}":  route?.ret ?? "",
    "{adt}":  String(route?.adt ?? 1),
  };
  let url = template;
  for (const [k, v] of Object.entries(rep)) url = url.replaceAll(k, encodeURIComponent(v));
  return url;
}

// Cargar módulo de scoring (ESM-safe)
async function requireScore() {
  try {
    const { default: scoring } = await import("./scoring.js");
    return typeof scoring === "function"
      ? scoring
      : () => 0;
  } catch {
    // Fallback neutro si no existe scoring.js
    return () => 0;
  }
}

// Normaliza una lista de proveedores desde sources + aliases
function normalizeProviders(list = [], kind, aliases = {}) {
  return list.map((p) => {
    const id = p.id || p.code || p.name;
    const alias = aliases[id] || {};
    return {
      kind,
      id,
      name: alias.name ?? p.name ?? id,
      deeplink: alias.deeplink ?? p.deeplink ?? "",
      countries_origin: alias.countries_origin ?? p.countries_origin ?? [],
      countries_dest:   alias.countries_dest   ?? p.countries_dest   ?? [],
      weight: alias.weight ?? p.weight ?? 0,
    };
  });
}

// ------------------------------------------------------------
// API principal: selectProviders({ route })
//   route: { from, to, dep, ret, adt }
// Retorna: { chosenMeta, chosenAir, originCountry, destCountry }
// ------------------------------------------------------------
export async function selectProviders({ route }) {
  // 1) Cargar fuentes
  const src     = readJsonSafe(SOURCES_PATH, { metasearch: [], airlines: [] });
  const aliases = readJsonSafe(ALIASES_PATH, {});

  // 2) Normalizar y fusionar aliases
  const metaAll = normalizeProviders(src.metasearch, "meta", aliases.metasearch || {});
  const airAll  = normalizeProviders(src.airlines,   "airline", aliases.airlines   || {});

  // 3) Contexto de país
  const originCountry = guessCountry(route?.from);
  const destCountry   = guessCountry(route?.to);

  // 4) Filtrado por cobertura geográfica
  const matchesGeo = (p) => {
    const okOrigin = !p.countries_origin?.length || p.countries_origin.includes(originCountry);
    const okDest   = !p.countries_dest?.length   || p.countries_dest.includes(destCountry);
    return okOrigin && okDest;
  };

  const metaFiltered = metaAll.filter(matchesGeo);
  const airFiltered  = airAll.filter(matchesGeo);

  // 5) Scoring dinámico
  const scoring = await requireScore();
  const scoreWrap = (p) => {
    // Puedes enriquecer con features: nonstop, carry on, reputación, etc.
    const base = scoring(p, { route, originCountry, destCountry }) || 0;
    return base + (p.weight || 0);
  };

  metaFiltered.forEach((p) => (p.score = scoreWrap(p)));
  airFiltered.forEach((p)  => (p.score = scoreWrap(p)));

  // 6) Ordenar, cortar y construir deeplinks
  const chosenMeta = metaFiltered
    .sort((a, b) => b.score - a.score)
    .slice(0, META_CAP)
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      link: buildDeepLink(p.deeplink, route),
    }));

  const chosenAir = airFiltered
    .sort((a, b) => b.score - a.score)
    .slice(0, AIR_CAP)
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      link: buildDeepLink(p.deeplink, route),
    }));

  return { chosenMeta, chosenAir, originCountry, destCountry };
}
