// app.js — Ultra-LowFare FrontDesk v1.3.4
// SPA mínima para visualizar historico_normalizado.json

const PATH_JSON = "./data/historico_normalizado.json";

// ------------------------------
// Utilidades
// ------------------------------
function safeNum(n) {
  return typeof n === "number" ? n : null;
}

function by(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ------------------------------
// Carga de histórico normalizado
// ------------------------------
async function loadNormalized() {
  const res = await fetch(PATH_JSON, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer " + PATH_JSON);

  const data = await res.json();
  if (!Array.isArray(data) || !data.length)
    throw new Error("historico_normalizado.json vacío o no es array.");

  return data;
}

// ------------------------------
// Normalizador para pintar
// ------------------------------
function normalizeRow(r) {
  return {
    ruta: r.ruta || null,
    precio: safeNum(r.precio),
    fecha: r.fecha || null,
    aerolinea: r.aerolinea || null,
    source: r.source || null,
    origen: r.origen || null,
    destino: r.destino || null,
    cumple: r.cumple || null,
    estado: r.estado || null
  };
}

// ------------------------------
// Render de tabla
// ------------------------------
function renderTable(rows) {
  const table = document.getElementById("results");
  table.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.ruta ?? ""}</td>
      <td>${r.precio ?? ""}</td>
      <td>${r.fecha ?? ""}</td>
      <td>${r.aerolinea ?? ""}</td>
      <td>${r.source ?? ""}</td>
      <td>${r.origen ?? ""}</td>
      <td>${r.destino ?? ""}</td>
      <td>${r.cumple ?? ""}</td>
      <td>${r.estado ?? ""}</td>
    `;

    table.appendChild(tr);
  }
}

// ------------------------------
// Inicialización
// ------------------------------
async function main() {
  try {
    const data = await loadNormalized();
    const rows = data.map(normalizeRow);

    // Ordenar por precio ascendente
    rows.sort((a, b) => by(a.precio ?? Infinity, b.precio ?? Infinity));

    renderTable(rows);
  } catch (err) {
    console.error("[FrontDesk ERROR]", err);
    document.getElementById("error").innerText = err.message;
  }
}

main();
