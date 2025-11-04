// ============================================================
// scripts/farebot_v132.js — Live Adaptive Engine v1.3.2
// - Lee proyecto desde config.json (o usa defaults LIM→MIA/FLL/MCO)
// - Modo adaptativo: intenta LIVE (stub) y cae a MOCK seguro
// - Calcula costos terrestres (auto/tren) con ground_costs.json (si existe) o defaults
// - Persiste snapshot atómico y actualiza histórico con tope
// ============================================================

import fs from "fs";
import {
  readJsonSafe,
  writeJsonAtomic,
  appendJsonArrayCapped,
  nowIsoUtc,
  log,
} from "../scripts/helper.js";

// ----------------------------
// Rutas de datasets
// ----------------------------
const DATA_PATH = "./data/data.json";        // snapshot actual
const HIST_PATH = "./data/historico.json";   // histórico acumulado

// ----------------------------
// Config de proyecto
// ----------------------------
const CFG_PATH = "./config.json";

// Estructura esperada mínima en config.json:
// {
//   "mode": "live" | "mock",              // opcional; también admite env FAREBOT_MODE
//   "projects": [{
//      "id": "Project A",
//      "origins": ["LIM"],
//      "destinations": ["MIA","FLL","MCO"],
//      "depart": "2026-02-06",            // ISO (fecha)
//      "return": ["2026-02-21"],          // ISO(s)
//      "pax": { "adults": 1 },
//      "constraints": { "carry_on_only": true, "max_stops": 1 },
//      "budget": { "MIA": 360, "FLL": 360, "MCO": 400 }
//   }]
// }

// Defaults si no hay config.json
const DEFAULT_CFG = {
  mode: "mock",
  projects: [{
    id: "default",
    origins: ["LIM"],
    destinations: ["MIA", "FLL", "MCO"],
    depart: "2026-02-06",
    return: ["2026-02-21"],
    pax: { adults: 1 },
    constraints: { carry_on_only: true, max_stops: 1 },
    budget: { MIA: 360, FLL: 360, MCO: 400 }
  }]
};

// ----------------------------
// Costos terrestres
// ----------------------------
// Se intentan leer de data/ground_costs.json (exportado desde el front).
const GROUNDS = (() => {
  const g = readJsonSafe("./data/ground_costs.json", null);
  if (g && g.routes) return g.routes;

  // Defaults internos (equivalentes a los del front)
  return {
    "MCO-MIA": {
      options: [{
        type: "auto",
        label: "Auto 1 día (Turnpike)",
        pricing_model: "per_vehicle",
        day_rate_usd: 35,
        tolls_usd: 20,
        fuel: { mpg: 30, usd_per_gal: 2.962 },
        miles: 232.2,
        max_pax: 4
      }]
    },
    "FLL-MIA": {
      miles: 28,
      options: [
        { type: "tren", label: "Brightline SMART", pricing_model: "per_person", fare_usd_per_person: 20 },
        { type: "auto", label: "Auto diario local", pricing_model: "per_vehicle",
          day_rate_usd: 35, tolls_usd: 4, fuel: { mpg: 28, usd_per_gal: 2.962 }, max_pax: 4 }
      ]
    }
  };
})();

// ----------------------------
// Utilidades locales
// ----------------------------
function calcFuelCost(miles, mpg, usdPerGal) {
  if (!miles || !mpg || !usdPerGal) return 0;
  return (miles / mpg) * usdPerGal;
}

function calcAuto(option, pax = 1) {
  const miles = option.miles ?? 0;
  const fuel = calcFuelCost(miles, option.fuel?.mpg ?? 30, option.fuel?.usd_per_gal ?? 3);
  const base = (option.day_rate_usd ?? 0) + (option.tolls_usd ?? 0) + fuel;
  const cap = Math.max(1, option.max_pax ?? 4);
  const vehicles = Math.ceil(Math.max(1, pax) / cap);
  return { type: "auto", label: option.label || "Auto", pricing_model: "per_vehicle", cost: Number((base * vehicles).toFixed(2)) };
}

function calcTrain(option, pax = 1) {
  const unit = option.fare_usd_per_person ?? 0;
  return { type: "tren", label: option.label || "Tren", pricing_model: "per_person", cost: Number((unit * Math.max(1, pax)).toFixed(2)) };
}

function pickGroundCost(arr, pax) {
  // Selecciona el costo más bajo entre las opciones
  let best = null;
  for (const o of arr || []) {
    let out;
    if (o.type === "auto") out = calcAuto(o, pax);
    else if (o.type === "tren") out = calcTrain(o, pax);
    else continue;
    if (!best || out.cost < best.cost) best = out;
  }
  return best; // {type,label,pricing_model,cost} | null
}

function applyGroundForDest(routeStr, pax = 1) {
  // routeStr ej: "LIM-MCO"
  const dest = (routeStr.split("-")[1] || "").toUpperCase();

  if (dest === "MIA") {
    return { terrTipo: null, terrLabel: null, terrPricing: null, terrCost: 0 };
  }
  if (dest === "MCO") {
    const R = GROUNDS["MCO-MIA"];
    if (!R?.options?.length) return { terrTipo: null, terrLabel: null, terrPricing: null, terrCost: 0 };
    const best = pickGroundCost(R.options, pax);
    return best ? { terrTipo: best.type, terrLabel: best.label, terrPricing: best.pricing_model, terrCost: best.cost }
                : { terrTipo: null, terrLabel: null, terrPricing: null, terrCost: 0 };
  }
  if (dest === "FLL") {
    const R = GROUNDS["FLL-MIA"];
    if (!R?.options?.length) return { terrTipo: null, terrLabel: null, terrPricing: null, terrCost: 0 };
    const best = pickGroundCost(R.options, pax);
    return best ? { terrTipo: best.type, terrLabel: best.label, terrPricing: best.pricing_model, terrCost: best.cost }
                : { terrTipo: null, terrLabel: null, terrPricing: null, terrCost: 0 };
  }
  // Otros destinos: sin costo terrestre
  return { terrTipo: null, terrLabel: null, terrPricing: null, terrCost: 0 };
}

function buildRoutes(project) {
  // Construye combinaciones básicas a partir del proyecto (primer origin + cada destino + returns)
  const out = [];
  const origin = (project.origins && project.origins[0]) || "LIM";
  const dests = project.destinations || ["MIA", "FLL", "MCO"];
  const dep = project.depart || nowIsoUtc().slice(0, 10);
  const returns = Array.isArray(project.return) ? project.return : (project.return ? [project.return] : []);
  const pax = project.pax?.adults ?? 1;

  for (const to of dests) {
    if (returns.length === 0) {
      out.push({ from: origin, to, dep, ret: null, adt: pax, budget: project.budget?.[to] ?? null });
    } else {
      for (const r of returns) {
        out.push({ from: origin, to, dep, ret: r, adt: pax, budget: project.budget?.[to] ?? null });
      }
    }
  }
  return out;
}

// ----------------------------
// LIVE stub (extensible)
// ----------------------------
// Devuelve null cuando no implementado o no disponible; el caller caerá a MOCK seguro.
async function tryLiveFetch(route, project, constraints) {
  // Aquí se integrarían scrapers/APIs oficiales.
  // Como placeholder, retornamos null para forzar fallback mientras no haya integración.
  // Si en tu entorno ya tienes scrapers, puedes retornar:
  // { price: 312.00, provider: "aerolinea/meta XYZ", itinerary: "LIM-PTY-MIA 8h", mode: "live" }
  return null;
}

// MOCK estable para fallback
function mockPrice() {
  return 379 + Math.floor(Math.random() * 21) - 10; // 369..389
}

// ----------------------------
// MAIN
// ----------------------------
async function main() {
  const cfg = readJsonSafe(CFG_PATH, DEFAULT_CFG);
  const MODE = (process.env.FAREBOT_MODE || cfg.mode || "mock").toLowerCase(); // "live" | "mock"

  const project = (cfg.projects && cfg.projects[0]) || DEFAULT_CFG.projects[0];
  const routes = buildRoutes(project);
  const constraints = {
    carry_on_only: !!project.constraints?.carry_on_only,
    max_stops: project.constraints?.max_stops ?? 1
  };

  log(`Starting FareBot v1.3.2 — project="${project.id}" mode="${MODE}" routes=${routes.length}`);

  const results = [];

  for (const r of routes) {
    const key = `${r.from}-${r.to}`;
    const ts = nowIsoUtc();
    let found = null;

    if (MODE === "live") {
      try {
        found = await tryLiveFetch(r, project, constraints);
      } catch (e) {
        log(`LIVE fetch error for ${key}: ${e?.message || e}`, "ERROR");
      }
    }

    // Fallback a MOCK si no hay live
    let price, provider, itinerary, modeFlag;
    if (found && typeof found.price === "number") {
      price = found.price;
      provider = found.provider || "live/source";
      itinerary = found.itinerary || "—";
      modeFlag = "live";
    } else {
      price = mockPrice();
      provider = "simulación interna (mock)";
      itinerary = "—";
      modeFlag = "mock";
    }

    // Costo terrestre según destino
    const ground = applyGroundForDest(key, r.adt);
    const total = typeof price === "number" ? Number((price + (ground.terrCost || 0)).toFixed(2)) : null;

    results.push({
      // claves normalizadas que el front ya consume
      route: key,
      dep: r.dep,
      ret: r.ret,
      pax: r.adt,

      depart_date: r.dep,                 // para front v17
      depart_time: "—",                   // si no hay hora, se deja —
      provider: provider,
      aereo: price,                       // precio de vuelo
      itinerario: itinerary,

      // terrestres
      terrestre_tipo: ground.terrTipo,
      terrestre_label: ground.terrLabel,
      terrestre_pricing_model: ground.terrPricing,
      terrestre_cost_usd: ground.terrCost,

      // totales
      total_usd: total,

      // meta
      meta: {
        mode: modeFlag,                   // "live" o "mock"
        generated: ts,
        constraints
      },

      // criterios
      cumple_umbral: (typeof r.budget === "number" && typeof total === "number") ? (total <= r.budget) : null,
      budget_tope: r.budget ?? null
    });
  }

  // KPIs simples
  const mejorTotal = Math.min(...results.map(x => x.total_usd).filter(n => typeof n === "number"));
  const cumpleAlMenosUna = results.some(x => x.cumple_umbral === true);

  // Snapshot
  const snapshot = {
    meta: {
      generado: nowIsoUtc(),
      project: project.id,
      mode: MODE,
      v: "1.3.2"
    },
    resumen: {
      rutas: routes.length,
      mejor_total: isFinite(mejorTotal) ? mejorTotal : null,
      cumple_umbral: cumpleAlMenosUna
    },
    resultados: results
  };

  // Persistencia
  try {
    writeJsonAtomic(DATA_PATH, snapshot);
    log("Snapshot guardado en data/data.json (atómico)", "SAVE");
  } catch (err) {
    log(`Error guardando snapshot: ${err?.message || err}`, "ERROR");
  }

  try {
    appendJsonArrayCapped(HIST_PATH, snapshot, 600, true);
    log("Histórico actualizado en data/historico.json (tope=600)", "SAVE");
  } catch (err) {
    log(`Error actualizando histórico: ${err?.message || err}`, "ERROR");
  }

  log(`Finalizado FareBot v1.3.2 — resultados=${results.length}`, "DONE");
}

main().catch((e) => {
  log(`FATAL: ${e?.message || e}`, "FATAL");
  process.exit(1);
});
