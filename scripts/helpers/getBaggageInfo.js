// ============================================================
// scripts/helpers/getBaggageInfo.js
// Devuelve política de equipaje de aerolíneas/metabuscadores
// ============================================================

import { readJsonSafe } from "../../helper.js";

const BAGGAGE_PATH = "./data/baggage_policies.json";

/**
 * Busca y devuelve la política de equipaje correspondiente
 * @param {string} providerId  - ID del proveedor (p.ej. 'aa', 'dl', 'sky', 'googleflights')
 * @param {string} regionCode  - Región estimada del vuelo ('latam_usa', 'domestic_us', 'south_america', 'any')
 * @returns {object}           - Política encontrada o valores genéricos
 */
export function getBaggageInfo(providerId, regionCode = "any") {
  const data = readJsonSafe(BAGGAGE_PATH, {});
  if (!data || (!data.airlines && !data.metasearch)) {
    return {
      source: "unknown",
      carry_on_included: "desconocido",
      personal_item_included: "desconocido",
      checked_bag_first_usd: "desconocido",
      notes: "No se encontró información de políticas de equipaje."
    };
  }

  // Buscar primero entre aerolíneas
  const air = (data.airlines || []).find(a => a.id.toLowerCase() === providerId.toLowerCase());
  if (air) {
    const region = air.regions?.[regionCode] || air.regions?.["any"];
    if (region) {
      return {
        source: air.name,
        ...region
      };
    }
  }

  // Buscar entre metabuscadores
  const meta = (data.metasearch || []).find(m => m.id.toLowerCase() === providerId.toLowerCase());
  if (meta) {
    return {
      source: meta.name,
      ...meta.policy
    };
  }

  // Si no se encuentra, usar defaults
  const def = data.defaults?.unknown_airline || {};
  return {
    source: "Desconocido",
    ...def
  };
}

/**
 * Retorna una etiqueta legible para mostrar en el front (resumen rápido)
 * @param {object} policy
 * @returns {string}
 */
export function baggageLabel(policy) {
  if (!policy || !policy.source) return "Política no disponible";
  const carry = policy.carry_on_included === true ? "✔ carry-on" : "✖ carry-on";
  const bag = policy.checked_bag_first_usd ? `$${policy.checked_bag_first_usd} primera maleta` : "maleta no definida";
  return `${policy.source}: ${carry}, ${bag}`;
}
