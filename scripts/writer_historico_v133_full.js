// ==========================================================
// writer_historico_v133_full.js
// Crea /data/historico.json 100% consistente usando schema_v133
// Versión estable para ULTRA-LOWFARE v1.3.3
// ==========================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// CORREGIDO: nueva ruta del schema (dentro de helpers/)
import schema from "./helpers/schema_v133.js";

import healthcheck from "./helpers/healthcheck_v133.js";
import { validarEstructura, limpiarCampos } from "./helpers/auditor_v133.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas absolutas
const DATA_DIR = path.join(__dirname, "../data");
const HISTORICO_FILE = path.join(DATA_DIR, "historico.json");
const HISTORICO_NORMALIZADO = path.join(DATA_DIR, "historico_normalizado.json");
const HISTORICO_FIXED = path.join(DATA_DIR, "historico_fixed.json");

// ==========================================================
// 1. Cargar dataset principal
// ==========================================================

function cargarJSON(ruta) {
  if (!fs.existsSync(ruta)) {
    console.warn(`⚠️ Archivo no encontrado, creando vacío: ${ruta}`);
    return [];
  }
  try {
    const raw = fs.readFileSync(ruta, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`❌ Error leyendo ${ruta}:`, error);
    return [];
  }
}

const historico = cargarJSON(HISTORICO_FILE);
const normalizado = cargarJSON(HISTORICO_NORMALIZADO);
const fixed = cargarJSON(HISTORICO_FIXED);

// ==========================================================
// 2. Unificar datasets
// ==========================================================

console.log("🔄 Unificando bases (historico + normalizado + fixed)...");

let unificado = [...historico, ...normalizado, ...fixed];

// ==========================================================
// 3. Limpiar duplicados
// ==========================================================

console.log("🧹 Eliminando duplicados...");

const clave = (item) =>
  `${item.ruta}_${item.fecha}_${item.precio_encontrado}_${item.fuente}`;

const seen = new Set();
unificado = unificado.filter((item) => {
  const k = clave(item);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// ==========================================================
// 4. Validación y normalización según schema_v133
// ==========================================================

console.log("🧪 Validando estructura según schema_v133...");

let corregidos = [];
let validos = [];

for (const registro of unificado) {
  const fix = validarEstructura(registro, schema);

  if (!fix.ok) {
    corregidos.push(fix.data);
  } else {
    validos.push(registro);
  }
}

// Post-procesamiento general
corregidos = corregidos.map((x) => limpiarCampos(x, schema));

// ==========================================================
// 5. Merge final limpio
// ==========================================================

let final = [...validos, ...corregidos];

// Ordenar por fecha descendente
final.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

// ==========================================================
// 6. Escribir archivo final
// ==========================================================

console.log(`💾 Guardando histórico final → ${HISTORICO_FILE}`);

try {
  fs.writeFileSync(HISTORICO_FILE, JSON.stringify(final, null, 2), "utf8");
  console.log("✅ historico.json actualizado exitosamente.");
} catch (error) {
  console.error("❌ Error escribiendo historico.json:", error);
}

// ==========================================================
// 7. Healthcheck
// ==========================================================

console.log("🩺 Ejecutando healthcheck_v133...");
try {
  healthcheck(final);
  console.log("🏥 Healthcheck OK.");
} catch (error) {
  console.error("❌ Healthcheck detectó problemas:", error);
}

// ==========================================================
// FIN DEL SCRIPT
// ==========================================================
