// ============================================================
// alert.js — Módulo de notificaciones de tarifas
// ============================================================
// Este módulo se encarga de generar y enviar mensajes de alerta
// cuando se detectan variaciones significativas en las tarifas.
// Compatible con Node.js ESM (import/export) y utilizado por:
// - notify_price_drops.js
// - farebot_v132.js
// ============================================================

import { nowIsoUtc, log } from "./helpers/helper.js";

/**
 * Genera un título formateado con fecha/hora ISO.
 * @returns {string} título de la alerta.
 */
export function generarTituloAlerta() {
  return `**Alerta de tarifas - ${nowIsoUtc()}**`;
}

/**
 * Envía una alerta (en consola, email o log).
 * Por ahora solo imprime en consola y deja registro.
 * @param {string} mensaje - Contenido de la alerta.
 * @param {boolean} [destacar=true] - Si se imprime con formato destacado.
 */
export function enviarAlerta(mensaje, destacar = true) {
  const titulo = generarTituloAlerta();
  const cuerpo = destacar ? `🚨 ${mensaje}` : mensaje;

  log(`${titulo}\n${cuerpo}`);
  console.log(`${titulo}\n${cuerpo}`);
}

/**
 * Ejemplo rápido de prueba local (node scripts/alert.js)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  enviarAlerta("Prueba de alerta automática desde alert.js ✅");
}
