// scripts/helpers/schema_v133.js
// Ultra-LowFare · Normalizador/Auditor de histórico v1.3.3
// Detecta variantes de estructura en data/historico.json y normaliza a un payload estándar.

import {
  isObject,
  coerceArray,
  nowIso,
} from "./helper.js";

// ------------------------------
// Etiquetas de variantes
// ------------------------------
export const TAGS = {
  UNKNOWN: "unknown",
  V14: "V1-4",
  V14_STAR: "V1-4*",
  V5: "V5",
  V6: "V6",
  V7: "V7",
  V8: "V8",
};

// ------------------------------
// Detección de variante por muestra
// ------------------------------
export function detectHistoricoVariant(sample) {
  // V8: [{ meta, resultados: [...] }, { meta, resultados: [...] }, ...]  (array de bloques)
  if (Array.isArray(sample)) {
    // Chequeo rápido de V8: cada item con meta y resultados(array)
    const looksV8 = sample.every(
      (blk) => isObject(blk) && isObject(blk.meta) && Array.isArray(blk.resultados)
    );
    if (looksV8) return TAGS.V8;
    return TAGS.UNKNOWN;
  }

  // A partir de aquí esperamos un objeto { meta, resumen }
  if (!isObject(sample)) return TAGS.UNKNOWN;
  const hasMeta = isObject(sample.meta);
  const hasResumen = Array.isArray(sample.resumen);
  if (!hasMeta || !hasResumen) return TAGS.UNKNOWN;

  // Heurísticas por campos característicos
  // V5: dashboard completo con titulo, zona_horaria, frecuencia_horas, detalles por ruta
  if (
    typeof sample.meta.titulo === "string" &&
    (sample.meta.zona_horaria || sample.detalles)
  ) {
    return TAGS.V5;
  }

  // V6: resumen con { ruta, salida, retorno, umbral, precio, cumple }
  if (
    sample.resumen.length > 0 &&
    isObject(sample.resumen[0]) &&
    "salida" in sample.resumen[0] &&
    "retorno" in sample.resumen[0] &&
    "umbral" in sample.resumen[0]
  ) {
    return TAGS.V6;
  }

  // V7: meta { origen, moneda } y resumen con { fecha, destino, aerolinea, precio, ... }
  if (
    (sample.meta.origen || sample.meta.moneda) &&
    sample.resumen.length > 0 &&
    isObject(sample.resumen[0]) &&
    "destino" in sample.resumen[0] &&
    "aerolinea" in sample.resumen[0]
  ) {
    return TAGS.V7;
  }

  // V1-4* (una variante previa que ya mapeamos): suele tener meta.generado y resumen simple por ruta
  if (
    "generado" in sample.meta &&
    sample.resumen.length > 0 &&
    isObject(sample.resumen[0]) &&
    "ruta" in sample.resumen[0]
  ) {
    // Más específico si tiene campos modernos o no
    const r0 = sample.resumen[0];
    const isModernish = "umbral_usd" in r0 || "umbral" in r0 || "precio_mas_bajo_usd" in r0;
    return isModernish ? TAGS.V14_STAR : TAGS.V14;
  }

  return TAGS.UNKNOWN;
}

// ------------------------------
// Normalización a formato estándar
// Salida: array de "observaciones" homogéneas
// Cada observación mínima:
// {
//   stamp_iso,
//   ruta: "LIM ⇄ MIA" | "LIM → MIA",
//   origen: "LIM",
//   destino: "MIA",
//   precio_usd,
//   cumple: true/false/null,
//   umbral_usd: number|null,
//   fuente: "mock|live|metabuscador|aerolinea|desconocido",
//   extra: { ... }   // bolsa con info adicional (equipaje, aerolinea, escalas, etc.)
// }
// ------------------------------
export function normalizeRecord(sample, tag = null) {
  const out = [];
  tag = tag || detectHistoricoVariant(sample);

  // Helper para ruta
  const parseRuta = (rutaStr) => {
    if (typeof rutaStr !== "string") return { origen: null, destino: null, ruta: null };
    const arrow = rutaStr.includes("⇄") ? "⇄" : (rutaStr.includes("→") ? "→" : null);
    if (!arrow) return { origen: null, destino: null, ruta: rutaStr.trim() };
    const [o, d] = rutaStr.split(arrow).map(s => s.trim());
    return { origen: o?.replace(/^LIM|MIA|FLL|MCO|SJU|ORD|MSN|MKE/i, (x)=>x), destino: d, ruta: rutaStr.trim() };
  };

  // Helper cumple
  const toBoolCumple = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.toLowerCase();
      if (s.includes("cumple") && !s.includes("no")) return true;
      if (s.includes("no cumple")) return false;
      if (s.includes("sí") || s.includes("si")) return true;
      if (s.includes("❌")) return false;
      if (s.includes("✅")) return true;
    }
    return null;
  };

  // V8: array de bloques [{meta, resultados:[...]}, ...]
  if (tag === TAGS.V8 && Array.isArray(sample)) {
    for (const blk of sample) {
      const stamp = blk?.meta?.generado || nowIso();
      for (const r of coerceArray(blk?.resultados)) {
        const pr = parseRuta(String(r.ruta || "").trim());
        out.push({
          stamp_iso: r.fecha || stamp,
          ruta: pr.ruta || `${pr.origen} → ${pr.destino}`,
          origen: pr.origen,
          destino: pr.destino,
          precio_usd: numOrNull(r.precio_encontrado),
          cumple: toBoolCumple(r.cumple),
          umbral_usd: numOrNull(r.limite),
          fuente: String(r.fuente || "desconocido"),
          extra: {
            detalles: r.detalles || {},
            tag: TAGS.V8,
          },
        });
      }
    }
    return out;
  }

  // V7: objeto { meta:{origen, moneda}, resumen:[{fecha, destino, aerolinea, precio, ...}] }
  if (tag === TAGS.V7 && isObject(sample)) {
    const origen = sample.meta?.origen || null;
    const stamp = sample.meta?.generado || nowIso();
    for (const r of sample.resumen) {
      out.push({
        stamp_iso: stamp,
        ruta: origen && r.destino ? `${origen} → ${r.destino}` : null,
        origen,
        destino: r.destino || null,
        precio_usd: numOrNull(r.precio),
        cumple: null,
        umbral_usd: null,
        fuente: "desconocido",
        extra: {
          fecha_cotizacion: r.fecha || null,
          aerolinea: r.aerolinea || null,
          escala: r.escala ?? null,
          equipaje: r.equipaje || null,
          duracion_vuelo: r.duracion_vuelo || null,
          moneda: sample.meta?.moneda || "USD",
          tag: TAGS.V7,
        },
      });
    }
    return out;
  }

  // V6: objeto { meta.generado, resumen:[{ ruta, salida, retorno, umbral, precio, cumple }] }
  if (tag === TAGS.V6 && isObject(sample)) {
    const stamp = sample.meta?.generado || nowIso();
    for (const r of sample.resumen) {
      const pr = parseRuta(r.ruta);
      out.push({
        stamp_iso: stamp,
        ruta: pr.ruta || `${pr.origen} ⇄ ${pr.destino}`,
        origen: pr.origen,
        destino: pr.destino,
        precio_usd: numOrNull(r.precio),
        cumple: toBoolCumple(r.cumple),
        umbral_usd: numOrNull(r.umbral),
        fuente: "desconocido",
        extra: {
          salida: r.salida || null,
          retorno: r.retorno || null,
          tag: TAGS.V6,
        },
      });
    }
    return out;
  }

  // V5: dashboard rico con detalles; resumen por ruta con precio_mas_bajo_usd / umbral_usd
  if (tag === TAGS.V5 && isObject(sample)) {
    const stamp = sample.meta?.generado || nowIso();
    for (const r of sample.resumen) {
      const pr = parseRuta(r.ruta);
      out.push({
        stamp_iso: stamp,
        ruta: pr.ruta || `${pr.origen} ⇄ ${pr.destino}`,
        origen: pr.origen,
        destino: pr.destino,
        precio_usd: numOrNull(r.precio_mas_bajo_usd),
        cumple: toBoolCumple(r.resultado),
        umbral_usd: numOrNull(r.umbral_usd),
        fuente: "desconocido",
        extra: {
          detalles_ruta: extractDetallesRuta(sample.detalles, pr.ruta),
          contador_diario: sample.contador_diario || null,
          tag: TAGS.V5,
        },
      });
    }
    return out;
  }

  // V1-4 / V1-4*
  if ((tag === TAGS.V14 || tag === TAGS.V14_STAR) && isObject(sample)) {
    const stamp = sample.meta?.generado || nowIso();
    for (const r of sample.resumen) {
      const pr = parseRuta(r.ruta);
      out.push({
        stamp_iso: stamp,
        ruta: pr.ruta || `${pr.origen} ⇄ ${pr.destino}`,
        origen: pr.origen,
        destino: pr.destino,
        precio_usd: numOrNull(r.precio || r.precio_mas_bajo_usd),
        cumple: toBoolCumple(r.cumple || r.resultado),
        umbral_usd: numOrNull(r.umbral || r.umbral_usd),
        fuente: "desconocido",
        extra: {
          tag,
        },
      });
    }
    return out;
  }

  // UNKNOWN -> intentamos heurística mínima
  if (isObject(sample) && Array.isArray(sample.resumen)) {
    const stamp = sample.meta?.generado || nowIso();
    for (const r of sample.resumen) {
      const pr = parseRuta(r.ruta || r.destino || "");
      out.push({
        stamp_iso: stamp,
        ruta: pr.ruta,
        origen: pr.origen,
        destino: pr.destino || r.destino || null,
        precio_usd: numOrNull(r.precio || r.precio_mas_bajo_usd),
        cumple: toBoolCumple(r.cumple || r.resultado),
        umbral_usd: numOrNull(r.umbral || r.umbral_usd),
        fuente: "desconocido",
        extra: { tag: TAGS.UNKNOWN },
      });
    }
    return out;
  }

  // Si no se pudo, devolver sin datos para no romper pipeline
  return out;
}

// ------------------------------
// Normalizar un arreglo completo (historico.json)
// ------------------------------
export function normalizeAll(historicoArray) {
  const normalized = [];
  const tags = [];
  coerceArray(historicoArray).forEach((sample) => {
    const tag = detectHistoricoVariant(sample);
    tags.push(tag);
    const items = normalizeRecord(sample, tag);
    normalized.push(...items);
  });
  return { normalized, tags };
}

// ------------------------------
// Resumen de conteos por tag
// ------------------------------
export function summarizeCounts(tags) {
  const counts = {
    [TAGS.V14]: 0,
    [TAGS.V14_STAR]: 0,
    [TAGS.V5]: 0,
    [TAGS.V6]: 0,
    [TAGS.V7]: 0,
    [TAGS.V8]: 0,
    [TAGS.UNKNOWN]: 0,
  };
  for (const t of tags) {
    if (counts.hasOwnProperty(t)) counts[t] += 1;
    else counts[TAGS.UNKNOWN] += 1;
  }
  return counts;
}

// ------------------------------
// Helpers internos
// ------------------------------
function numOrNull(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function extractDetallesRuta(detalles, rutaKey) {
  if (!detalles || !rutaKey) return null;
  // La llave puede venir "LIM ⇄ MIA" (exacta). Intento exacto y variantes con espacios.
  const exact = detalles[rutaKey];
  if (exact) return exact;
  // Prueba invertir flecha para robustez
  const inv = rutaKey.replace("⇄", "→");
  return detalles[inv] || null;
}
