/*
  dashboard_v133.js
  Capa de datos para FrontWeb v1.3.3 (solo historico_normalizado).
  Exporta funciones utilitarias para que el front pinte tablas/gráficos.
*/

import { loadHistoricoNormalizado } from "../helpers/reader_normalizado_v133.js";

// Carga todo el dataset normalizado
export function fetchDataset() {
  const rows = loadHistoricoNormalizado();
  // Asegura campos mínimos para el front
  return rows.map(function (r) {
    // Normalización defensiva de campos típicos
    const ruta = r.ruta || "";
    const precio = typeof r.precio === "number" ? r.precio : null;
    const fecha = r.fecha || r.date || null;
    const aerolinea = r.aerolinea || r.airline || null;
    const fuente = r.fuente || r.source || null;
    const origen = r.origen || r.origin || (ruta.indexOf("-") > -1 ? ruta.split("-")[0] : null);
    const destino = r.destino || r.destination || (ruta.indexOf("-") > -1 ? ruta.split("-")[1] : null);
    const ts = r.timestamp || r.ts || null;
    const cumple = r.cumple || r.estado || null;

    return {
      ruta: ruta,
      origen: origen,
      destino: destino,
      precio: precio,
      fecha: fecha,
      aerolinea: aerolinea,
      fuente: fuente,
      timestamp: ts,
      cumple: cumple
    };
  });
}

// Resumen por ruta: mínimo, máximo, promedio y último precio
export function resumenPorRuta() {
  const ds = fetchDataset();
  const buckets = {};
  ds.forEach(function (row) {
    const key = row.ruta || (row.origen && row.destino ? row.origen + "-" + row.destino : "N/A");
    if (!buckets[key]) {
      buckets[key] = { precios: [], ult: null };
    }
    if (typeof row.precio === "number") {
      buckets[key].precios.push(row.precio);
    }
    // Para "último", nos quedamos con el más reciente por timestamp si existe
    if (row.timestamp) {
      if (!buckets[key].ult || row.timestamp > buckets[key].ult.timestamp) {
        buckets[key].ult = { precio: row.precio, timestamp: row.timestamp };
      }
    }
  });

  const out = [];
  Object.keys(buckets).forEach(function (ruta) {
    const p = buckets[ruta].precios;
    if (p.length === 0) {
      out.push({
        ruta: ruta,
        minimo: null,
        maximo: null,
        promedio: null,
        ultimo: buckets[ruta].ult ? buckets[ruta].ult.precio : null
      });
    } else {
      const min = Math.min.apply(null, p);
      const max = Math.max.apply(null, p);
      const sum = p.reduce(function (a, b) { return a + b; }, 0);
      const avg = Math.round((sum / p.length) * 100) / 100;
      out.push({
        ruta: ruta,
        minimo: min,
        maximo: max,
        promedio: avg,
        ultimo: buckets[ruta].ult ? buckets[ruta].ult.precio : null
      });
    }
  });

  // Ordena por ruta para estabilidad
  out.sort(function (a, b) {
    if (a.ruta < b.ruta) return -1;
    if (a.ruta > b.ruta) return 1;
    return 0;
    });
  return out;
}

// Serie temporal simple por ruta (para gráficas)
export function serieTemporal(ruta) {
  const ds = fetchDataset().filter(function (r) { return r.ruta === ruta; });
  // Ordena por fecha si existe, si no por timestamp
  ds.sort(function (a, b) {
    const ax = (a.fecha || a.timestamp || "");
    const bx = (b.fecha || b.timestamp || "");
    if (ax < bx) return -1;
    if (ax > bx) return 1;
    return 0;
  });
  return ds.map(function (r) {
    return {
      x: r.fecha || r.timestamp,
      y: r.precio
    };
  }).filter(function (p) {
    return typeof p.y === "number";
  });
}
