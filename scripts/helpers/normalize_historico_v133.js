// scripts/helpers/normalize_historico_v133.js
// v1.3.3 — Normalizador unificado de historico.json para todas las variantes detectadas.
// Salida canónica por bloque:
// {
//   meta: { generado: ISOString },
//   resultados: [
//     {
//       ruta: "LIM → MIA",
//       fecha: ISOString | null,
//       precio_encontrado: number | null,
//       limite: number | null,
//       cumple: "Cumple" | "No cumple" | "Parcial" | "Informativo" | "Desconocido",
//       fuente: string | null,
//       detalles: { ... }  // opcional, libre
//     }, ...
//   ]
// }

import { parseISO, toISOUTC } from "./time_utils_v133.js"; // opcional si ya tienes util; si no existe no pasa nada
// NOTA: si no tienes time_utils_v133.js, las funciones abajo son seguras.

function toISOorNull(v) {
  try {
    if (!v) return null;
    // soporta "2025-10-18 21:00 CST", "2025-10-21T15:00:00Z", etc.
    const z = (v + "").trim();
    if (/\d{4}-\d{2}-\d{2}T/.test(z)) return new Date(z).toISOString();
    // “YYYY-MM-DD HH:mm ZZZ”
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(z)) {
      // Quita zona y deja UTC best-effort
      const d = new Date(z.replace(/\s+CST|CDT|EST|EDT|PST|PDT|UTC/gi, "Z"));
      if (!isNaN(d)) return d.toISOString();
    }
    const d = new Date(z);
    return isNaN(d) ? null : d.toISOString();
  } catch { return null; }
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const n = String(v).replace(/[^0-9.-]+/g, "");
  const f = parseFloat(n);
  return isFinite(f) ? f : null;
}

function standardCumple({ precio, limite, literal }) {
  // prioridad: literal si viene (“Cumple”, “No cumple”, “Parcial”, etc.)
  if (literal) {
    const t = String(literal).toLowerCase();
    if (t.includes("cumple")) return literal.includes("❌") ? "No cumple" : "Cumple";
    if (t.includes("parcial")) return "Parcial";
    if (t.includes("informativo")) return "Informativo";
  }
  if (precio == null || limite == null) return "Desconocido";
  return precio <= limite ? "Cumple" : "No cumple";
}

// ---------- Detectores de forma ----------
function isV5_dashboardSnapshot(obj) {
  return obj && obj.meta && obj.meta.titulo && Array.isArray(obj.resumen) && obj.detalles;
}

function isV6_resumenConFechas(obj) {
  return obj && obj.meta && Array.isArray(obj.resumen) &&
    obj.resumen.every(r => "salida" in r || "retorno" in r || "umbral" in r || "precio" in r);
}

function isV7_tablaPlanoDestino(obj) {
  return obj && obj.meta && Array.isArray(obj.resumen) &&
    obj.resumen.every(r => ("destino" in r) && ("precio" in r));
}

function isV8_arrayBloquesAnidados(entry) {
  // el "entry" completo es un Array con varios {meta, resultados}
  return Array.isArray(entry) && entry.length > 0 && entry.every(
    b => b && b.meta && Array.isArray(b.resultados)
  );
}

// V1–V4 se consideran “objeto con meta + resultados[]”, “objeto con meta + historico[]/historico_detallado”,
// u otras variantes ya cubiertas por el normalizador anterior. Si no entra en V5–V8,
// trataremos de mapear genéricamente si hay 'resultados'.

function hasResultadosArray(obj) {
  return obj && obj.meta && Array.isArray(obj.resultados);
}

// ---------- Normalizadores por forma ----------
function normV5(obj) {
  const generado = toISOorNull(obj.meta?.generado) || null;

  const results = [];
  // 1) Tomamos el “resumen” como la señal principal (una por ruta)
  for (const r of obj.resumen || []) {
    const ruta = r.ruta?.replace(/\s+/g, " ").trim() || null;
    const limite = numOrNull(r.umbral);
    const precio = numOrNull(r.precio_mas_bajo_usd);
    const cumple = standardCumple({ precio, limite, literal: r.resultado });

    results.push({
      ruta,
      fecha: toISOorNull(r.ultima_ejecucion) || generado,
      precio_encontrado: precio,
      limite,
      cumple,
      fuente: "resumen",
      detalles: {}
    });
  }

  // 2) Intentamos extraer “mejor precio” desde evaluaciones por ruta si aporta algo adicional
  const detalles = obj.detalles || {};
  for (const rutaKey of Object.keys(detalles)) {
    const det = detalles[rutaKey];
    if (Array.isArray(det?.evaluaciones)) {
      // elegimos el número mínimo detectado en evaluaciones
      const preciosEval = det.evaluaciones
        .map(ev => numOrNull(ev.resultado))
        .filter(v => v != null);
      const minEval = preciosEval.length ? Math.min(...preciosEval) : null;

      const rutaStd = rutaKey.replace(/\s+/g, " ").trim();
      const ya = results.find(x => x.ruta === rutaStd);
      if (ya && minEval != null && (ya.precio_encontrado == null || minEval < ya.precio_encontrado)) {
        ya.precio_encontrado = minEval;
        ya.fuente = "resumen+evaluaciones";
      }
    }
  }

  return { meta: { generado }, resultados: results };
}

function normV6(obj) {
  const generado = toISOorNull(obj.meta?.generado) || null;
  const results = (obj.resumen || []).map(r => {
    const ruta = r.ruta?.replace(/\s+/g, " ").trim() || null;
    const limite = numOrNull(r.umbral);
    const precio = numOrNull(r.precio);
    const cumple = standardCumple({ precio, limite, literal: r.cumple });
    const fecha = toISOorNull(r.ultima_ejecucion) || generado;
    return {
      ruta,
      fecha,
      precio_encontrado: precio,
      limite,
      cumple,
      fuente: "resumen",
      detalles: { salida: r.salida || null, retorno: r.retorno || null }
    };
  });
  return { meta: { generado }, resultados: results };
}

function normV7(obj) {
  const generado = toISOorNull(obj.meta?.generado) || null;
  const results = (obj.resumen || []).map(r => {
    const ruta = `LIM → ${r.destino}`.trim();
    const precio = numOrNull(r.precio);
    return {
      ruta,
      fecha: generado,
      precio_encontrado: precio,
      limite: null,
      cumple: standardCumple({ precio, limite: null }),
      fuente: r.aerolinea ? `tabla:${r.aerolinea}` : "tabla",
      detalles: {
        aerolinea: r.aerolinea ?? null,
        escala: r.escala ?? null,
        equipaje: r.equipaje ?? null,
        duracion_vuelo: r.duracion_vuelo ?? null
      }
    };
  });
  return { meta: { generado }, resultados: results };
}

function normV8(entryArr) {
  // entryArr es un array de bloques; devolvemos cada bloque normalizado 1:1
  return entryArr.map(b => {
    const generado = toISOorNull(b.meta?.generado) || null;
    const results = (b.resultados || []).map(x => {
      const ruta = (x.ruta || "").replace(/\s+/g, " ").trim().replace(/^→/,"").replace(/^-/,"");
      const precio = numOrNull(x.precio_encontrado ?? x.precio);
      const limite = numOrNull(x.limite ?? x.umbral);
      const cumple = standardCumple({ precio, limite, literal: x.cumple });
      return {
        ruta,
        fecha: toISOorNull(x.fecha) || generado,
        precio_encontrado: precio,
        limite,
        cumple,
        fuente: x.fuente ?? null,
        detalles: x.detalles ?? {}
      };
    });
    return { meta: { generado }, resultados: results };
  });
}

function normResultadosGeneric(obj) {
  const generado = toISOorNull(obj.meta?.generado) || null;
  const results = (obj.resultados || []).map(x => {
    const ruta = (x.ruta || "").replace(/\s+/g, " ").trim();
    const precio = numOrNull(x.precio_encontrado ?? x.precio);
    const limite = numOrNull(x.limite ?? x.umbral);
    const cumple = standardCumple({ precio, limite, literal: x.cumple });
    return {
      ruta,
      fecha: toISOorNull(x.fecha) || generado,
      precio_encontrado: precio,
      limite,
      cumple,
      fuente: x.fuente ?? null,
      detalles: x.detalles ?? {}
    };
  });
  return { meta: { generado }, resultados: results };
}

// ---------- API pública ----------
/**
 * Normaliza una ENTRADA del historico. La entrada puede ser:
 *  - Objeto (cualquier variante)  -> devuelve [bloque]
 *  - Array de bloques (V8)        -> devuelve [bloque1, bloque2, ...]
 */
export function normalizeHistoricoEntryV133(entry) {
  try {
    if (isV8_arrayBloquesAnidados(entry)) {
      return normV8(entry);
    }
    if (isV5_dashboardSnapshot(entry)) {
      return [normV5(entry)];
    }
    if (isV6_resumenConFechas(entry)) {
      return [normV6(entry)];
    }
    if (isV7_tablaPlanoDestino(entry)) {
      return [normV7(entry)];
    }
    if (hasResultadosArray(entry)) {
      return [normResultadosGeneric(entry)];
    }
    // fallback: no reconocida, la dejamos marcada
    return [{
      meta: { generado: toISOorNull(entry?.meta?.generado) || null, _shape: "unknown" },
      resultados: []
    }];
  } catch (e) {
    return [{
      meta: { generado: null, _shape: "error", _error: String(e?.message || e) },
      resultados: []
    }];
  }
}

/**
 * Normaliza un historico COMPLETO (que puede ser un array heterogéneo).
 * Retorna un array de bloques canónicos.
 */
export function normalizeHistoricoFileV133(historico) {
  const out = [];
  if (Array.isArray(historico)) {
    for (const entry of historico) {
      const norm = normalizeHistoricoEntryV133(entry);
      out.push(...norm);
    }
  } else if (historico && typeof historico === "object") {
    out.push(...normalizeHistoricoEntryV133(historico));
  }
  return out;
}
