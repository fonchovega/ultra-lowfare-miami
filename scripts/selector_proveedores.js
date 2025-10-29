// selector_proveedores.js — elige hasta N metabuscadores y M aerolíneas según origen/destino
import fs from "fs";

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function isoDate(d) { return (d || "").slice(0, 10); }

export function buildDeepLink(template, ctx) {
  return template
    .replaceAll("{FROM}", ctx.from)
    .replaceAll("{TO}", ctx.to)
    .replaceAll("{DEP}", isoDate(ctx.dep))
    .replaceAll("{RET}", isoDate(ctx.ret))
    .replaceAll("{ADT}", String(ctx.adt ?? 1));
}

export function selectProviders({ configPath = "./config.json", sourcesPath = "./data/sources.json", route }) {
  const cfg = loadJSON(configPath) || {};
  const src = loadJSON(sourcesPath) || {};
  const metaCap = cfg?.v131?.meta_cap ?? 8;
  const airCap  = cfg?.v131?.airline_cap ?? 10;

  const originCountry = guessCountry(route.from);   // p.ej. LIM -> PE
  const destCountry   = guessCountry(route.to);     // MIA -> US
  const opts = {
    prefer_low_fees: !!cfg?.v131?.prefer_low_fees,
    prefer_refundable: !!cfg?.v131?.prefer_refundable
  };

  const meta = (src.metabuscadores || []).map(m => ({
    kind: "meta",
    id: m.id, name: m.name, template: m.deeplink,
    matchesOrigin: (m.countries_origin || []).includes(originCountry)
  }));

  const airlines = (src.airlines || []).map(a => ({
    kind: "airline",
    id: a.id, name: a.name, template: a.deeplink,
    matchesOrigin: (a.countries_origin || []).includes(originCountry)
  }));

  // Scoring
  const { scoreProvider } = requireScore();
  meta.forEach(p => p.score = scoreProvider(p, opts));
  airlines.forEach(p => p.score = scoreProvider(p, opts));

  // Rank & cap
  const chosenMeta = meta.sort((a,b)=>b.score-a.score).slice(0, metaCap);
  const chosenAir  = airlines.sort((a,b)=>b.score-a.score).slice(0, airCap);

  // Deep links
  chosenMeta.forEach(p => p.link = buildDeepLink(p.template, route));
  chosenAir.forEach(p => p.link = buildDeepLink(p.template, route));

  return { chosenMeta, chosenAir, originCountry, destCountry };
}

function requireScore() {
  // soporta import ES en runtime simple
  const mod = await import("./scoring.js");
  return mod;
}

// Mapeo mínimo IATA -> país (extensible)
function guessCountry(iata) {
  const map = {
    "LIM": "PE",
    "MIA": "US", "FLL": "US", "MCO": "US",
    "ORD": "US", "MSN": "US", "MKE": "US",
    "SJU": "US"
  };
  return map[iata] || "US";
}
