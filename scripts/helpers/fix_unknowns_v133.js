import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HIST_PATH = path.resolve(__dirname, "../../data/historico.json");
const UNKNOWN_PATH = path.resolve(__dirname, "../../data/historico_unknown_samples.json");
const FIXED_PATH = path.resolve(__dirname, "../../data/historico_fixed.json");

// Normaliza los objetos unknown
function normalizeRecord(entry) {
  // Estructura mínima
  const fixed = {
    meta: entry.meta || {},
    resumen: entry.resumen || null,
    detalles: entry.detalles || null
  };

  // Casos sin resumen: intentar reconstruir uno básico
  if (!fixed.resumen && entry.data) {
    fixed.resumen = Array.isArray(entry.data) ? entry.data[0] : entry.data;
  }

  // En caso extremo: todo el objeto pasa a "resumen"
  if (!fixed.resumen) {
    fixed.resumen = { placeholder: true, original_type: typeof entry };
  }

  return fixed;
}

function main() {
  if (!fs.existsSync(HIST_PATH)) {
    console.error("❌ No existe data/historico.json");
    process.exit(1);
  }

  const historico = JSON.parse(fs.readFileSync(HIST_PATH, "utf8"));
  if (!Array.isArray(historico)) {
    console.error("❌ historico.json no es un arreglo válido");
    process.exit(1);
  }

  const unknowns = fs.existsSync(UNKNOWN_PATH)
    ? JSON.parse(fs.readFileSync(UNKNOWN_PATH, "utf8"))
    : [];

  if (unknowns.length === 0) {
    console.log("✅ No hay registros unknown para corregir.");
    return;
  }

  let fixedCount = 0;
  for (const unk of unknowns) {
    const idx = unk.index;
    const sample = unk.sample || unk.record;
    if (!sample) continue;
    const fixed = normalizeRecord(sample);
    historico[idx] = fixed;
    fixedCount++;
  }

  fs.writeFileSync(FIXED_PATH, JSON.stringify(historico, null, 2));
  console.log("✅ Corrección completada. Guardado en data/historico_fixed.json");
  console.log("Registros corregidos: " + fixedCount);
}

main();
