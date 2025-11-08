/*
  app_frontweb_v133.js
  SPA mínima para visualizar historico_normalizado.json:
  - KPIs (entries, rutas, min, promedio)
  - Resumen por ruta (min/prom/max/último)
  - Serie temporal simple con Canvas
*/

const PATH_JSON = "../data/historico_normalizado.json";

// Utilidades
function safeNum(x) { return typeof x === "number" ? x : null; }
function fmtUSD(n) { return (n == null ? "—" : ("$" + n.toFixed(0))); }
function by(a, b) { if (a < b) return -1; if (a > b) return 1; return 0; }

async function loadNormalizado() {
  const res = await fetch(PATH_JSON, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer " + PATH_JSON + " (" + res.status + ")");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("historico_normalizado.json vacío o no es un arreglo.");
  }
  return data;
}

function normalizeRow(r) {
  const ruta = r.ruta || "";
  const precio = safeNum(r.precio);
  const fecha = r.fecha || r.date || null;
  const aerolinea = r.aerolinea || r.airline || null;
  const fuente = r.fuente || r.source || null;
  const origen = r.origen || r.origin || (ruta.indexOf("-") > -1 ? ruta.split("-")[0].trim() : null);
  const destino = r.destino || r.destination || (ruta.indexOf("-") > -1 ? ruta.split("-")[1].trim() : null);
  const ts = r.timestamp || r.ts || (fecha ? Date.parse(fecha) : null);
  const cumple = r.cumple || r.estado || null;

  return {
    ruta: ruta || (origen && destino ? (origen + "-" + destino) : ""),
    origen: origen,
    destino: destino,
    precio: precio,
    fecha: fecha,
    aerolinea: aerolinea,
    fuente: fuente,
    timestamp: (typeof ts === "number" ? ts : (ts ? Date.parse(ts) : null)),
    cumple: cumple
  };
}

function resumenPorRuta(rows) {
  const acc = {};
  rows.forEach(function (r) {
    const key = r.ruta || (r.origen && r.destino ? (r.origen + "-" + r.destino) : "N/A");
    if (!acc[key]) acc[key] = { precios: [], ult: null };
    if (typeof r.precio === "number") acc[key].precios.push(r.precio);
    if (r.timestamp) {
      if (!acc[key].ult || r.timestamp > acc[key].ult.timestamp) {
        acc[key].ult = { precio: r.precio, timestamp: r.timestamp };
      }
    }
  });

  const out = [];
  Object.keys(acc).sort(by).forEach(function (ruta) {
    const p = acc[ruta].precios;
    if (p.length === 0) {
      out.push({ ruta: ruta, minimo: null, promedio: null, maximo: null, ultimo: acc[ruta].ult ? acc[ruta].ult.precio : null });
    } else {
      const min = Math.min.apply(null, p);
      const max = Math.max.apply(null, p);
      const avg = Math.round((p.reduce(function (a, b) { return a + b; }, 0) / p.length) * 100) / 100;
      out.push({ ruta: ruta, minimo: min, promedio: avg, maximo: max, ultimo: acc[ruta].ult ? acc[ruta].ult.precio : null });
    }
  });
  return out;
}

function serieTemporal(rows, ruta) {
  const ds = rows.filter(function (r) { return r.ruta === ruta; })
                 .sort(function (a, b) {
                   const ax = (a.fecha || a.timestamp || 0);
                   const bx = (b.fecha || b.timestamp || 0);
                   return ax < bx ? -1 : (ax > bx ? 1 : 0);
                 });
  return ds.map(function (r) {
    return { x: (r.timestamp || (r.fecha ? Date.parse(r.fecha) : null)), y: r.precio };
  }).filter(function (p) { return typeof p.y === "number" && p.x != null; });
}

// Render
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function renderKPIs(rows) {
  setText("kpi-rows", rows.length.toString());
  const rutas = Array.from(new Set(rows.map(function (r) { return r.ruta; }))).filter(Boolean);
  setText("kpi-rutas", rutas.length.toString());

  const precios = rows.map(function (r) { return r.precio; }).filter(function (n) { return typeof n === "number"; });
  const min = precios.length ? Math.min.apply(null, precios) : null;
  const avg = precios.length ? (precios.reduce(function (a, b) { return a + b; }, 0) / precios.length) : null;

  setText("kpi-min", fmtUSD(min == null ? null : min));
  setText("kpi-avg", (avg == null ? "—" : ("$" + avg.toFixed(0))));
}

function renderTablaResumen(rows) {
  const tbody = document.querySelector("#tabla-resumen tbody");
  tbody.innerHTML = "";
  resumenPorRuta(rows).forEach(function (r) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + r.ruta + "</td>" +
      "<td class='num'>" + fmtUSD(r.minimo) + "</td>" +
      "<td class='num'>" + (r.promedio == null ? "—" : ("$" + r.promedio.toFixed(0))) + "</td>" +
      "<td class='num'>" + fmtUSD(r.maximo) + "</td>" +
      "<td class='num'>" + fmtUSD(r.ultimo) + "</td>";
    tbody.appendChild(tr);
  });
}

function renderSelectorRuta(rows) {
  const sel = document.getElementById("sel-ruta");
  const rutas = Array.from(new Set(rows.map(function (r) { return r.ruta; }))).filter(Boolean).sort(by);
  sel.innerHTML = "";
  rutas.forEach(function (r) {
    const opt = document.createElement("option");
    opt.value = r; opt.textContent = r;
    sel.appendChild(opt);
  });
}

function renderChart(series) {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!series.length) {
    ctx.fillStyle = "#9aa3b2";
    ctx.fillText("Sin datos para esta ruta.", 20, 24);
    return;
  }

  const xs = series.map(function (p) { return p.x; });
  const ys = series.map(function (p) { return p.y; });
  const xmin = Math.min.apply(null, xs);
  const xmax = Math.max.apply(null, xs);
  const ymin = Math.min.apply(null, ys);
  const ymax = Math.max.apply(null, ys);

  const pad = 30;
  const W = canvas.width, H = canvas.height;
  function xscale(x) {
    return pad + ((x - xmin) / Math.max(1, (xmax - xmin))) * (W - 2 * pad);
  }
  function yscale(y) {
    return H - pad - ((y - ymin) / Math.max(1, (ymax - ymin))) * (H - 2 * pad);
  }

  // ejes
  ctx.strokeStyle = "#252a34";
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();

  // línea
  ctx.strokeStyle = "#4ea3ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach(function (p, i) {
    const X = xscale(p.x), Y = yscale(p.y);
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  });
  ctx.stroke();

  // puntos
  ctx.fillStyle = "#e7ebf3";
  series.forEach(function (p) {
    const X = xscale(p.x), Y = yscale(p.y);
    ctx.beginPath(); ctx.arc(X, Y, 2.5, 0, Math.PI * 2); ctx.fill();
  });

  // etiquetas mín/max
  ctx.fillStyle = "#9aa3b2";
  ctx.font = "12px system-ui";
  ctx.fillText("$" + ymin.toFixed(0), 6, yscale(ymin) - 4);
  ctx.fillText("$" + ymax.toFixed(0), 6, yscale(ymax) - 4);
}

async function main() {
  const btnReload = document.getElementById("btn-reload");
  btnReload.addEventListener("click", function () { boot(); });

  await boot();
}

async function boot() {
  try {
    document.getElementById("meta-generado").textContent = "Cargando…";
    const raw = await loadNormalizado();
    const rows = raw.map(normalizeRow);

    // meta generado (si existe en la primera fila)
    var metaGen = (raw[0] && raw[0].meta && (raw[0].meta.generado || raw[0].meta.timestamp)) || null;
    document.getElementById("meta-generado").textContent = metaGen ? ("Generado: " + metaGen) : "Generado: (no disponible)";

    renderKPIs(rows);
    renderTablaResumen(rows);
    renderSelectorRuta(rows);

    const sel = document.getElementById("sel-ruta");
    function paint() {
      const ruta = sel.value;
      const serie = serieTemporal(rows, ruta);
      renderChart(serie);
    }
    sel.onchange = paint;
    if (sel.options.length) {
      sel.selectedIndex = 0;
      paint();
    } else {
      renderChart([]);
    }
  } catch (e) {
    console.error(e);
    document.getElementById("meta-generado").textContent = "Error: " + e.message;
  }
}

main();
