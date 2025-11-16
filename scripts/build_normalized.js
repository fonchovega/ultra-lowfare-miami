import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------------
// Rutas base
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const DATA_DIR = path.join(ROOT_DIR, "data");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const SRC_PATH = path.join(DATA_DIR, "historico.json");
const OUT_DATA_PATH = path.join(DATA_DIR, "historico_normalizado.json");
const OUT_PUBLIC_DIR = path.join(PUBLIC_DIR, "data");
const OUT_PUBLIC_PATH = path.join(OUT_PUBLIC_DIR, "historico_normalizado.json");

// -------------------------
// Helpers simples
// -------------------------
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn("Archivo no encontrado: " + filePath);
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return [];
    }
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data;
    }
    console.warn("El JSON no es un array en: " + filePath);
    return [];
  } catch (err) {
    console.error("Error leyendo JSON desde " + filePath, err);
    return [];
  }
}

// -------------------------
// Normalización mínima
// -------------------------
function buildNormalized(source) {
  // De momento: normalización "mínima":
  // garantizar que cada entrada tenga meta, resumen y (si existe) detalles.
  return source.map(function (item, index) {
    const meta = item && item.meta ? item.meta : {};
    const resumen = item && item.resumen ? item.resumen : [];
    const detalles = item && item.detalles ? item.detalles : null;

    return {
      index: index,
      meta: meta,
      resumen: resumen,
      detalles: detalles
    };
  });
}

// -------------------------
// Flujo principal
// -------------------------
function main() {
  console.log("📥 Leyendo base: " + SRC_PATH);
  const historico = safeReadJson(SRC_PATH);
  console.log("   Registros leídos: " + historico.length);

  const normalizado = buildNormalized(historico);
  console.log("📦 Registros normalizados: " + normalizado.length);

  // Escribir en /data
  ensureDir(DATA_DIR);
  fs.writeFileSync(
    OUT_DATA_PATH,
    JSON.stringify(normalizado, null, 2),
    "utf8"
  );
  console.log("✅ Archivo escrito: " + OUT_DATA_PATH);

  // Escribir copia para el front en /public/data
  ensureDir(OUT_PUBLIC_DIR);
  fs.writeFileSync(
    OUT_PUBLIC_PATH,
    JSON.stringify(normalizado, null, 2),
    "utf8"
  );
  console.log("✅ Archivo escrito: " + OUT_PUBLIC_PATH);

  console.log("🎯 build_normalized.js finalizado.");
}

main();
