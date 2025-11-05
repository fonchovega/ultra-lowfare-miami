// ===================================================================
// scripts/helpers/schema_v133.js
// Ultra-LowFare v1.3.3 — Normalizador y validadores de histórico
// Convierte múltiples formatos antiguos (V1-4, V5, V6, V7, V8, mock)
// a un esquema unificado v1.3.3 para consumo del front y reporter.
// ===================================================================

import { readJsonSafe, cleanString, nowIsoUtc, logInfo, logWarn, logError } from "./helper.js";

// -------------------------------------------------------------------
// Esquema unificado v1.3.3 (descripción informal)
// -------------------------------------------------------------------
// Objeto normalizado:
// {
//   version: "v1.3.3",
//   meta: {
//     generado: "ISO-UTC",
//     fuente_version: "V6" | "V5" | "V1-4" | "V7" | "V8" | "MOCK" | "UNKNOWN",
//     modo: "live" | "mock" | "mixed",
//     origen: "LIM",             // si se conoce
//     rutas_definidas: ["LIM⇄MIA","LIM⇄FLL","LIM⇄MCO"], // si existían
//     zona_horaria: "CST" | "UTC" | etc. (opcional)
//   },
//   items: [
//     {
//       route: "LIM→MIA",               // o "LIM⇄MIA" si aplica el par
//       salida: "YYYY-MM-DD" ó "ISO",   // si se conoce
//       retorno: "YYYY-MM-DD" ó "ISO",  // si se conoce
//       destino: "MIA" | "FLL" | "MCO", // cuando venga separado
//       airline: "Avianca",             // si viene
//       provider: "Expedia" | "Copa" | "Google Flights" | "Script interno",
//       price_usd: 429,
//       threshold_usd: 360,
//       meets: true | false | "Parcial", // normalizar a booleano cuando sea posible
//       hand_bag: true | false | null,
//       bag_policy_note: "Classic incluye / XS no",
//       stops: 0 | 1 | 2 | null,
//       duration: "7h 45m" | null,
//       is_live: true | false,
//       link: "https://...",
//       source_type: "metabuscador" | "aerolinea" | "interno" | "tendencia" | "politica",
//       note: "texto libre",
//       raw: { ...entryOriginal... }     // para auditoría
//     },
//     ...
//   ]
// }

export const SCHEMA_V133 = {
  version: "v1.3.3",
  fields: [
    "version",
    "meta",
    "items"
  ]
};

// -------------------------------------------------------------------
// Utilidades
// -------------------------------------------------------------------

function parseMoneyToNumber(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return x;
  if (typeof x !== "string") return null;
  var s = x.replace(/[^0-9.,-]/g, "");
  // estandar: usa punto como decimal
  s = s.replace(/,/g, "");
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function normalizeBoolFromText(x) {
  if (typeof x === "boolean") return x;
  if (!x) return null;
  var t = String(x).toLowerCase();
  if (t.indexOf("si") >= 0 || t.indexOf("sí") >= 0 || t.indexOf("true") >= 0) return true;
  if (t.indexOf("no") >= 0 || t.indexOf("false") >= 0) return false;
  return null;
}

function routeFromPair(a, b, sep) {
  var s = typeof sep === "string" ? sep : "→";
  return (a || "").trim() + s + (b || "").trim();
}

function boolFromCumple(x) {
  // admite "Cumple", "No cumple", "✅", "❌", true/false
  if (typeof x === "boolean") return x;
  if (!x) return null;
  var t = String(x).toLowerCase();
  if (t.indexOf("cumple") >= 0) return t.indexOf("no") >= 0 ? false : true;
  if (t.indexOf("✅") >= 0) return true;
  if (t.indexOf("❌") >= 0) return false;
  return null;
}

function tagSourceTypeByProviderName(name) {
  var t = (name || "").toLowerCase();
  if (!t) return "interno";
  if (t.indexOf("expedia") >= 0 || t.indexOf("google flights") >= 0 || t.indexOf("kayak") >= 0 || t.indexOf("orbitz") >= 0 || t.indexOf("hopper") >= 0) {
    return "metabuscador";
  }
  // heurística simple para aerolíneas:
  if (t.indexOf("avianca") >= 0 || t.indexOf("copa") >= 0 || t.indexOf("delta") >= 0 || t.indexOf("american") >= 0 || t.indexOf("spirit") >= 0 || t.indexOf("latam") >= 0) {
    return "aerolinea";
  }
  if (t.indexOf("tendencia") >= 0) return "tendencia";
  if (t.indexOf("pol\u00edtica") >= 0 || t.indexOf("politica") >= 0) return "politica";
  return "interno";
}

function extractDestFromRoute(route) {
  if (!route) return null;
  var r = route.replace(/\s+/g, " ").trim();
  var parts = r.split(" ");
  // formatos observados: "LIM → MIA" ó "LIM ⇄ MIA"
  var arrow = r.indexOf("→") >= 0 ? "→" : (r.indexOf("⇄") >= 0 ? "⇄" : null);
  if (!arrow) return null;
  var sp = r.split(arrow);
  if (sp.length === 2) return cleanString(sp[1]);
  return null;
}

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x === null || x === undefined) return [];
  return [x];
}

// -------------------------------------------------------------------
// Detección de "versión" de muestra en histórico
// -------------------------------------------------------------------
export function detectSampleVersion(sample) {
  // V8: array de snapshots, cada snapshot { meta, resultados: [ ... ] } con campos "ruta", "precio_encontrado", "limite", "fuente"
  if (Array.isArray(sample)) {
    if (sample.length > 0 && sample[0] && typeof sample[0] === "object") {
      var it = sample[0];
      if (it.resultados && Array.isArray(it.resultados)) return "V8";
    }
    return "UNKNOWN";
  }

  if (sample && typeof sample === "object") {
    // V7: meta.origen, resumen con { destino, aerolinea, precio, escala, equipaje, duracion_vuelo }
    if (sample.meta && sample.meta.origen && Array.isArray(sample.resumen)) {
      var okV7 = sample.resumen.some(function(r) {
        return r.destino && r.precio !== undefined && (r.aerolinea || r.equipaje || r.duracion_vuelo);
      });
      if (okV7) return "V7";
    }

    // V6: meta.generado ISO y resumen con ruta, salida, retorno, umbral, precio, cumple
    if (sample.meta && sample.meta.generado && Array.isArray(sample.resumen)) {
      var looksV6 = sample.resumen.some(function(r) {
        return r.ruta && r.precio !== undefined && (r.salida || r.retorno || r.umbral !== undefined);
      });
      if (looksV6) return "V6";
    }

    // V5: meta con "titulo" o "zona_horaria" y "detalles" con evaluaciones
    if (sample.meta && (sample.meta.titulo || sample.meta.zona_horaria) && sample.detalles) {
      return "V5";
    }

    // V1-4 y V1-4*: meta + resumen pero estructura antigua sin campos fuertes
    if (sample.meta && Array.isArray(sample.resumen)) {
      return "V1-4";
    }

    return "UNKNOWN";
  }

  return "UNKNOWN";
}

// -------------------------------------------------------------------
// Normalizadores por versión
// -------------------------------------------------------------------

function normalizeFromV5(sample) {
  var items = [];
  var rutas = Object.keys(sample.detalles || {});
  rutas.forEach(function(routePair) {
    var det = sample.detalles[routePair] || {};
    var evals = asArray(det.evaluaciones);
    evals.forEach(function(ev) {
      var price = parseMoneyToNumber(ev.resultado || "");
      var st = (ev.tipo || "") + " " + (ev.fuente || "");
      items.push({
        route: routePair.replace(/\s+/g, " ").trim(),
        salida: null,
        retorno: null,
        destino: extractDestFromRoute(routePair),
        airline: null,
        provider: ev.fuente || "desconocido",
        price_usd: price,
        threshold_usd: sample.umbral || (det.umbral !== undefined ? det.umbral : null),
        meets: boolFromCumple(ev.estado),
        hand_bag: null,
        bag_policy_note: ev.tipo && ev.tipo.toLowerCase().indexOf("pol\u00edtica") >= 0 ? cleanString(ev.resultado || "") : null,
        stops: null,
        duration: null,
        is_live: true,
        link: null,
        source_type: tagSourceTypeByProviderName(ev.fuente),
        note: cleanString(ev.resultado || ""),
        raw: ev
      });
    });
  });

  var modo = "live";
  return {
    version: "v1.3.3",
    meta: {
      generado: sample.meta && sample.meta.generado ? sample.meta.generado : nowIsoUtc(),
      fuente_version: "V5",
      modo: modo,
      origen: null,
      rutas_definidas: sample.meta && sample.meta.rutas ? sample.meta.rutas : null,
      zona_horaria: sample.meta && sample.meta.zona_horaria ? sample.meta.zona_horaria : null
    },
    items: items
  };
}

function normalizeFromV6(sample) {
  var items = [];
  asArray(sample.resumen).forEach(function(r) {
    var dest = null;
    var route = r.ruta || null;
    if (route) dest = extractDestFromRoute(route);
    items.push({
      route: route ? route.replace(/\s+/g, " ").trim() : null,
      salida: r.salida || null,
      retorno: r.retorno || null,
      destino: dest,
      airline: null,
      provider: "resumen",
      price_usd: r.precio !== undefined ? r.precio : null,
      threshold_usd: r.umbral !== undefined ? r.umbral : null,
      meets: boolFromCumple(r.cumple),
      hand_bag: null,
      bag_policy_note: null,
      stops: null,
      duration: null,
      is_live: true,
      link: null,
      source_type: "interno",
      note: null,
      raw: r
    });
  });

  return {
    version: "v1.3.3",
    meta: {
      generado: sample.meta && sample.meta.generado ? sample.meta.generado : nowIsoUtc(),
      fuente_version: "V6",
      modo: "live",
      origen: null,
      rutas_definidas: null,
      zona_horaria: null
    },
    items: items
  };
}

function normalizeFromV7(sample) {
  var items = [];
  asArray(sample.resumen).forEach(function(r) {
    var route = routeFromPair(sample.meta && sample.meta.origen ? sample.meta.origen : "LIM", r.destino || "");
    items.push({
      route: route,
      salida: r.fecha || null,
      retorno: null,
      destino: r.destino || null,
      airline: r.aerolinea || null,
      provider: r.aerolinea ? r.aerolinea : "resumen",
      price_usd: r.precio !== undefined ? r.precio : null,
      threshold_usd: null,
      meets: null,
      hand_bag: r.equipaje ? r.equipaje.toLowerCase().indexOf("mano") >= 0 : null,
      bag_policy_note: r.equipaje || null,
      stops: r.escala !== undefined ? r.escala : null,
      duration: r.duracion_vuelo || null,
      is_live: true,
      link: null,
      source_type: r.aerolinea ? "aerolinea" : "interno",
      note: null,
      raw: r
    });
  });

  return {
    version: "v1.3.3",
    meta: {
      generado: sample.meta && sample.meta.generado ? sample.meta.generado : nowIsoUtc(),
      fuente_version: "V7",
      modo: "live",
      origen: sample.meta && sample.meta.origen ? sample.meta.origen : null,
      rutas_definidas: null,
      zona_horaria: sample.meta && sample.meta.moneda ? "USD" : null
    },
    items: items
  };
}

function normalizeFromV8(sampleArray) {
  // sampleArray: lista de snapshots con { meta, resultados: [ ... ] }
  var all = [];
  sampleArray.forEach(function(snap) {
    var ts = snap.meta && snap.meta.generado ? snap.meta.generado : nowIsoUtc();
    asArray(snap.resultados).forEach(function(r) {
      var route = r.ruta ? r.ruta.replace(/\s+/g, " ").trim() : null;
      var provider = r.fuente || "simulacion interna";
      var isMock = provider.toLowerCase().indexOf("mock") >= 0 || (snap.meta && snap.meta.modo === "mock");
      all.push({
        route: route,
        salida: r.fecha || ts,
        retorno: null,
        destino: extractDestFromRoute(route),
        airline: null,
        provider: provider,
        price_usd: r.precio_encontrado !== undefined ? r.precio_encontrado : null,
        threshold_usd: r.limite !== undefined ? r.limite : null,
        meets: boolFromCumple(r.cumple),
        hand_bag: r.detalles && r.detalles.equipaje ? r.detalles.equipaje.toLowerCase().indexOf("carry-on") >= 0 : null,
        bag_policy_note: null,
        stops: r.detalles && r.detalles.escalas_max !== undefined ? r.detalles.escalas_max : null,
        duration: null,
        is_live: !isMock,
        link: null,
        source_type: tagSourceTypeByProviderName(provider),
        note: null,
        raw: r
      });
    });
  });

  var modo = "mixed";
  if (all.length > 0) {
    var liveCount = all.filter(function(x) { return x.is_live; }).length;
    if (liveCount === 0) modo = "mock";
    else if (liveCount === all.length) modo = "live";
  }

  return {
    version: "v1.3.3",
    meta: {
      generado: nowIsoUtc(),
      fuente_version: "V8",
      modo: modo,
      origen: null,
      rutas_definidas: null,
      zona_horaria: null
    },
    items: all
  };
}

function normalizeFromV14(sample) {
  // Estructuras antiguas con meta+resumen pero sin detalles claros (V1-4)
  // Intentamos mapear campos mínimos.
  var items = [];
  asArray(sample.resumen).forEach(function(row) {
    var route = row.ruta || null;
    var price = row.precio !== undefined ? row.precio : (row.precio_mas_bajo_usd !== undefined ? row.precio_mas_bajo_usd : null);
    var umbral = row.umbral !== undefined ? row.umbral : (row.umbral_usd !== undefined ? row.umbral_usd : null);
    var meets = row.cumple !== undefined ? row.cumple : row.resultado;
    items.push({
      route: route ? route.replace(/\s+/g, " ").trim() : null,
      salida: row.salida || row.ultima_ejecucion || null,
      retorno: row.retorno || null,
      destino: extractDestFromRoute(route),
      airline: row.aerolinea || null,
      provider: "resumen",
      price_usd: price,
      threshold_usd: umbral,
      meets: boolFromCumple(meets),
      hand_bag: null,
      bag_policy_note: null,
      stops: row.escala !== undefined ? row.escala : null,
      duration: row.duracion_vuelo || null,
      is_live: true,
      link: null,
      source_type: "interno",
      note: null,
      raw: row
    });
  });

  return {
    version: "v1.3.3",
    meta: {
      generado: sample.meta && sample.meta.generado ? sample.meta.generado : nowIsoUtc(),
      fuente_version: "V1-4",
      modo: "live",
      origen: sample.meta && sample.meta.origen ? sample.meta.origen : null,
      rutas_definidas: sample.meta && sample.meta.rutas ? sample.meta.rutas : null,
      zona_horaria: sample.meta && sample.meta.zona_horaria ? sample.meta.zona_horaria : null
    },
    items: items
  };
}

function normalizeUnknown(sample) {
  // Fallback: volcamos lo mínimo y lo marcamos como UNKNOWN
  return {
    version: "v1.3.3",
    meta: {
      generado: nowIsoUtc(),
      fuente_version: "UNKNOWN",
      modo: "live",
      origen: null,
      rutas_definidas: null,
      zona_horaria: null
    },
    items: []
  };
}

// -------------------------------------------------------------------
// API pública
// -------------------------------------------------------------------

export function normalizeToV133(sample) {
  try {
    var vtag = detectSampleVersion(sample);

    if (vtag === "V5") return normalizeFromV5(sample);
    if (vtag === "V6") return normalizeFromV6(sample);
    if (vtag === "V7") return normalizeFromV7(sample);
    if (vtag === "V8") return normalizeFromV8(sample);
    if (vtag === "V1-4") return normalizeFromV14(sample);

    // Si no detecta nada, intentamos heurística mínima:
    return normalizeUnknown(sample);
  } catch (err) {
    logError("Fallo normalizando muestra a v1.3.3", "normalizeToV133", err);
    return normalizeUnknown(sample);
  }
}

// Normaliza un arreglo de muestras (como el contenido completo de historico.json)
export function normalizeHistoricoArray(arr) {
  var out = [];
  var total = Array.isArray(arr) ? arr.length : 0;

  for (var i = 0; i < total; i++) {
    var it = arr[i];
    var norm = normalizeToV133(it);
    // Por coherencia: si viene seco, igual empujamos con meta válida
    if (!norm || !norm.items) {
      norm = normalizeUnknown(it);
    }
    out.push(norm);
  }
  return out;
}

export function isValidV133(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (obj.version !== "v1.3.3") return false;
  if (!obj.meta || typeof obj.meta !== "object") return false;
  if (!Array.isArray(obj.items)) return false;
  return true;
}

// Consolida múltiples normalizados (por ejemplo, todo el histórico) en uno solo
export function mergeNormalized(list) {
  var merged = {
    version: "v1.3.3",
    meta: {
      generado: nowIsoUtc(),
      fuente_version: "MERGED",
      modo: "mixed",
      origen: null,
      rutas_definidas: null,
      zona_horaria: null
    },
    items: []
  };

  var liveCount = 0;
  var total = 0;
  list.forEach(function(n) {
    if (!n || !Array.isArray(n.items)) return;
    n.items.forEach(function(x) {
      merged.items.push(x);
      total++;
      if (x.is_live) liveCount++;
    });
  });

  if (total === 0) merged.meta.modo = "live";
  else if (liveCount === 0) merged.meta.modo = "mock";
  else if (liveCount === total) merged.meta.modo = "live";
  else merged.meta.modo = "mixed";

  return merged;
}
