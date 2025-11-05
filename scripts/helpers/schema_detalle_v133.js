// scripts/helpers/schema_detalle_v133.js
// Ultra-LowFare · Extensión de schema con detalle expandido v1.3.3
// Agrega soporte a payload enriquecido para futuras APIs o frontweb (multiusuario)

import { isObject, coerceArray, nowIso } from "./helper.js";

/**
 * Estructura ampliada estándar para registro detallado
 * {
 *   stamp_iso,
 *   ruta,
 *   origen,
 *   destino,
 *   precio_usd,
 *   cumple,
 *   umbral_usd,
 *   fuente,
 *   fuente_tipo: "metabuscador" | "aerolinea" | "interno" | "simulacion" | "desconocido",
 *   link_oficial,
 *   extra: {
 *     equipaje: "carry-on only",
 *     escalas: 1,
 *     aerolinea: "Avianca",
 *     duracion_vuelo: "8h 05m",
 *     metodo_busqueda: "live|mock",
 *     origen_consulta: "farebot_v133",
 *     tag_origen: "V8|V6|V5|legacy",
 *     notas: "...",
 *     timestamp_registro: "ISO"
 *   }
 * }
 */

export function enrichRecord(basic) {
  if (!isObject(basic)) return null;
  const enriched = {
    ...basic,
    fuente_tipo: detectFuenteTipo(basic.fuente),
    link_oficial: basic.extra?.link || null,
    extra: {
      ...basic.extra,
      timestamp_registro: nowIso(),
      origen_consulta: "farebot_v133",
    },
  };
  return enriched;
}

export function enrichAll(records) {
  return coerceArray(records)
    .map((r) => enrichRecord(r))
    .filter((r) => r != null);
}

// Heurística básica para clasificar tipo de fuente
export function detectFuenteTipo(str) {
  if (!str) return "desconocido";
  const s = String(str).toLowerCase();
  if (s.includes("google flights") || s.includes("kayak") || s.includes("expedia") || s.includes("orbitz")) return "metabuscador";
  if (s.includes("avianca") || s.includes("copa") || s.includes("latam") || s.includes("spirit") || s.includes("american") || s.includes("delta")) return "aerolinea";
  if (s.includes("mock") || s.includes("simul")) return "simulacion";
  if (s.includes("interno") || s.includes("script")) return "interno";
  return "desconocido";
}

// Combina normalizados + enriquecidos en un único dataset plano (para frontweb)
export function buildDetailedDataset(normalizedArray) {
  const enriched = enrichAll(normalizedArray);
  return enriched.map((r, i) => ({
    id: i + 1,
    stamp_iso: r.stamp_iso,
    ruta: r.ruta,
    origen: r.origen,
    destino: r.destino,
    precio_usd: r.precio_usd,
    cumple: r.cumple,
    umbral_usd: r.umbral_usd,
    fuente: r.fuente,
    fuente_tipo: r.fuente_tipo,
    link_oficial: r.link_oficial,
    equipaje: r.extra?.equipaje ?? null,
    escalas: r.extra?.escalas ?? null,
    aerolinea: r.extra?.aerolinea ?? null,
    duracion_vuelo: r.extra?.duracion_vuelo ?? null,
    metodo_busqueda: r.extra?.metodo_busqueda ?? null,
    tag_origen: r.extra?.tag ?? null,
  }));
}
