// ============================================================
// dedupe.js — Dedupe del histórico de snapshots para Ultra-LowFare
// ============================================================
// - Valida que el histórico sea un Array
// - Elimina duplicados por una clave estable (meta.generado | id | timestamp)
// - Mantiene el primer snapshot visto para cada clave
// - Devuelve métricas { antes, despues, removidos } y el arreglo deduplicado
// ============================================================

import { log } from "./helper.js";

/** Determina la clave estable de un snapshot para dedupe. */
function keyOf(snap) {
  // Prioridades de clave (ajústalas si tu modelo cambia)
  return (
    snap?.meta?.generado ??
    snap?.id ??
    snap?.timestamp ??
    // Fallback: una huella simple (costo O(n)). No perfecto,
    // pero suficiente como respaldo.
    JSON.stringify({
      origen: snap?.origen ?? snap?.source ?? null,
      ruta: snap?.ruta ?? snap?.path ?? null,
      ts: snap?.ts ?? snap?.fecha ?? null,
    })
  );
}

/** Valida que el histórico tenga formato correcto. */
function assertHistorico(h) {
  if (!Array.isArray(h)) {
    throw new Error("historico.json invalido: no es un Array");
  }
}

/**
 * Elimina duplicados del histórico.
 * @param {Array<any>} historico
 * @returns {{antes:number, despues:number, removidos:number, data:Array<any>}}
 */
export function dedupeHistorico(historico = []) {
  try {
    assertHistorico(historico);

    const antes = historico.length;
    const seen = new Set();
    const deduped = [];

    for (const snap of historico) {
      const k = keyOf(snap);
      if (!seen.has(k)) {
        seen.add(k);
        deduped.push(snap);
      }
    }

    const despues = deduped.length;
    const removidos = antes - despues;

    log(`🧹 Dedupe: antes=${antes} despues=${despues} removidos=${removidos}`);
    return { antes, despues, removidos, data: deduped };
  } catch (e) {
    // Importante: mensaje con template literal correcto
    throw new Error(`historico.json invalido: ${e.message}`);
  }
}

export default dedupeHistorico;
