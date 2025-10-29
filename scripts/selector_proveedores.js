// selector_proveedores.js
// Ultra-LowFare v1.3.1 — selección dinámica de metabuscadores y aerolíneas

import path from "path";
import { fileURLToPath } from "url";
import { buildDeepLink } from "./fx-helpers.js";

// Utilidades base
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cap de selección
const metaCap = 8;   // Máx. 8 metabuscadores
const airCap  = 10;  // Máx. 10 aerolíneas

// Función principal: selección dinámica de proveedores
export async function selectProviders(src, opts = {}) {
  const originCountry = guessCountry(opts.origin || "LIM");
  const destCountry   = guessCountry(opts.dest || "MIA");

  // Metabuscadores
  const meta = (src.metasearch || []).map(a => ({
    kind: "meta",
    id: a.id,
    name: a.name,
    template: a.deeplink,
    matchesOrigin: (a.countries_origin || []).includes(originCountry)
  }));

  // Aerolíneas
  const airlines = (src.airlines || []).map(a => ({
    kind: "airline",
    id: a.id,
    name: a.name,
    template: a.deeplink,
    matchesOrigin: (a.countries_origin || []).includes(originCountry)
  }));

  // Scoring dinámico
  const scoring = await requireScore();
  meta.forEach(p => (p.score = scoring(p, opts)));
  airlines.forEach(p => (p.score = scoring(p, opts)));

  // Ordenar y limitar
  const chosenMeta = meta.sort((a, b) => b.score - a.score).slice(0, metaCap);
  const chosenAir  = airlines.sort((a, b) => b.score - a.score).slice(0, airCap);

  // Deep links
  chosenMeta.forEach(p => (p.link = buildDeepLink(p.template, opts.route)));
  chosenAir.forEach(p  => (p.link = buildDeepLink(p.template, opts.route)));

  return { chosenMeta, chosenAir, originCountry, destCountry };
}

// Cargar módulo de scoring dinámicamente (ESM-safe)
async function requireScore() {
  const { default: scoring } = await import("./scoring.js");
  return scoring;
}

// Mapear códigos IATA a país
function guessCountry(iata) {
  const map = {
    LIM: "PE",
    MIA: "US", FLL: "US", MCO: "US",
    ORD: "US", MSN: "US", MKE: "US",
    SJU: "US"
  };
  return map[iata] || "US";
}
