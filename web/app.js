(function () {
  "use strict";

  const DATA_PRIMARY = "../data/historico_normalizado.json";
  const DATA_FALLBACK = "../data/historico.json";

  let flatRows = [];
  let rutas = [];

  const elRuta = document.getElementById("filter-ruta");
  const elDays = document.getElementById("filter-days");
  const elSort = document.getElementById("sort-by");
  const elBtn = document.getElementById("btn-recargar");
  const elBody = document.getElementById("tbody");
  const elEmpty = document.getElementById("empty");

  function loadJson(url) {
    return fetch(url, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  function flatten(entry) {
    if (!entry.resumen) return [];
    const meta = entry.meta || {};
    return entry.resumen.map(r => ({
      ruta: r.ruta || "N/A",
      precio: parseFloat(String(r.precio).replace(/[^0-9.]/g, "")) || null,
      fecha: new Date(r.fecha || meta.generado || Date.now()),
      cumple: r.cumple || r.estado || ""
    }));
  }

  function hydrate(data) {
    flatRows = data.flatMap(flatten).filter(r => r.precio);
    rutas = [...new Set(flatRows.map(r => r.ruta))].sort();
    renderFilters();
    renderTable();
  }

  function renderFilters() {
    while (elRuta.options.length > 1) elRuta.remove(1);
    rutas.forEach(r => {
      const o = document.createElement("option");
      o.value = r; o.textContent = r; elRuta.appendChild(o);
    });
  }

  function computeStats(days) {
    const now = Date.now();
    const filtered = flatRows.filter(r => !days || (now - r.fecha.getTime()) / 86400000 <= days);
    const map = {};
    filtered.forEach(r => {
      if (!map[r.ruta]) map[r.ruta] = [];
      map[r.ruta].push(r);
    });

    return Object.entries(map).map(([ruta, arr]) => {
      arr.sort((a, b) => a.fecha - b.fecha);
      const ultimo = arr[arr.length - 1];
      const precios = arr.map(a => a.precio);
      const promedio = precios.reduce((s, v) => s + v, 0) / precios.length;
      const tendencia = precios.length >= 2
        ? precios[precios.length - 1] > precios[0] ? "up"
        : precios[precios.length - 1] < precios[0] ? "down" : "flat"
        : "flat";

      return { ruta, ultimo, minimo: Math.min(...precios), promedio, tendencia, muestras: arr };
    });
  }

  function renderTable() {
    const rutaSel = elRuta.value;
    const daysSel = parseInt(elDays.value);
    const stats = computeStats(daysSel);
    const data = rutaSel ? stats.filter(s => s.ruta === rutaSel) : stats;
    data.sort((a, b) => a.minimo - b.minimo);

    elBody.innerHTML = "";
    if (!data.length) return elEmpty.classList.remove("hidden");
    elEmpty.classList.add("hidden");

    data.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.ruta}</td>
        <td class="mono">US$ ${s.ultimo.precio.toFixed(0)}</td>
        <td class="mono">US$ ${s.minimo.toFixed(0)}</td>
        <td class="mono">US$ ${s.promedio.toFixed(0)}</td>
        <td class="mono ${s.tendencia === "up" ? "trend-up" : s.tendencia === "down" ? "trend-down" : "trend-flat"}">
          ${s.tendencia === "up" ? "↑" : s.tendencia === "down" ? "↓" : "→"}
        </td>
        <td class="small">${s.ultimo.fecha.toLocaleString()}</td>
        <td><button class="btn">Ver detalle</button></td>
      `;
      elBody.appendChild(tr);
    });
  }

  function init() {
    loadJson(DATA_PRIMARY)
      .catch(() => loadJson(DATA_FALLBACK))
      .then(hydrate)
      .catch(e => {
        elEmpty.textContent = "Error al cargar datos: " + e.message;
        elEmpty.classList.remove("hidden");
      });
  }

  elRuta.addEventListener("change", renderTable);
  elDays.addEventListener("change", renderTable);
  elSort.addEventListener("change", renderTable);
  elBtn.addEventListener("click", init);

  init();
})();
