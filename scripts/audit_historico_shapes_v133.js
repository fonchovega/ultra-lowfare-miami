import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORICO_PATH = path.resolve(__dirname, "../data/historico.json");
const UNKNOWN_OUT = path.resolve(__dirname, "../data/historico_unknown_samples.json");

// Helpers seguros (sin backticks dentro de messages)
function readJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    console.error("Error leyendo JSON:", p, e.message);
    return null;
  }
}

function writeJson(p, obj) {
  try {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("Error escribiendo JSON:", p, e.message);
  }
}

// Detección de forma (heurística basada en tus muestras)
function detectShape(entry) {
  // V8: arreglo de bloques con { meta, resultados: [...] }
  if (Array.isArray(entry)) {
    const first = entry[0] || {};
    if (first && Array.isArray(first.resultados)) return "V8";
    return "unknown";
  }

  if (entry && typeof entry === "object") {
    const meta = entry.meta || null;
    const resumen = entry.resumen;

    // Sin resumen reconocido
    if (!meta) return "unknown";

    // Casos con resumen tipo arreglo
    if (Array.isArray(resumen)) {
      const r0 = resumen[0] || {};

      // V7: elementos con fecha y aerolinea
      if (("fecha" in r0) && ("aerolinea" in r0)) return "V7";

      // V6: elementos con salida/retorno/umbral/precio/cumple
      if (("salida" in r0) && ("retorno" in r0)) return "V6";

      // V5: dashboard con precio_mas_bajo_usd / umbral_usd y bloque de detalles/contador_diario
      const hasV5Keys = ("precio_mas_bajo_usd" in r0) || ("umbral_usd" in r0) || ("contador_diario" in entry) || ("detalles" in entry);
      if (hasV5Keys) return "V5";

      // V1-4 (genérico): tiene ruta y al menos uno de precio/cumple/umbral
      if (("ruta" in r0) && ("precio" in r0 || "cumple" in r0 || "umbral" in r0)) return "V1-4";

      // Si no encaja pero hay arreglo: consideramos V1-4*
      if ("ruta" in r0 || "precio" in r0 || "cumple" in r0 || "umbral" in r0) return "V1-4*";
      return "unknown";
    }

    // Casos con resumen objeto: etiquetar como V1-4* si parece resumir una sola ruta
    if (resumen && typeof resumen === "object") {
      const keys = Object.keys(resumen);
      const looksLikeSingle = keys.includes("ruta") || keys.includes("precio") || keys.includes("umbral") || keys.includes("cumple");
      if (looksLikeSingle) return "V1-4*";
      return "unknown";
    }

    // Si hay meta pero no resumen entendible
    return "unknown";
  }

  return "unknown";
}

function main() {
  const data = readJson(HISTORICO_PATH);
  if (!data) {
    console.error("No se pudo leer data/historico.json");
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error("historico.json no es un array válido");
    process.exit(1);
  }

  // Contadores
  const counts = { "V1-4": 0, "V1-4*": 0, "V5": 0, "V6": 0, "V7": 0, "V8": 0, "unknown": 0 };
  const details = [];
  const unknownSamples = [];

  // Auditar
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const tag = detectShape(item);
    if (!counts[tag]) counts[tag] = 0;
    counts[tag] += 1;

    const ok = tag !== "unknown";
    const mark = ok ? "✔" : "✖";
    const line = ok
      ? "index " + i + ": " + tag + " (normalizado OK)"
      : "index " + i + ": UNKNOWN (tag:unknown)";
    details.push(mark + " " + line);

    if (!ok) {
      unknownSamples.push({ index: i, sample: item });
    }
  }

  // Persistir unknowns
  writeJson(UNKNOWN_OUT, unknownSamples);

  // Resumen estilo que ya vienes usando
  console.log("✅ Auditoría v1.3.3 (revisado)");
  console.log("  V1-4  : " + counts["V1-4"]);
  console.log("  V1-4* : " + counts["V1-4*"]);
  console.log("  V5    : " + counts["V5"]);
  console.log("  V6    : " + counts["V6"]);
  console.log("  V7    : " + counts["V7"]);
  console.log("  V8    : " + counts["V8"]);
  console.log("  Reconocidos solo por normalizador: 0");
  console.log("  Unknown: " + counts["unknown"]);
  console.log("");
  console.log("Muestras desconocidas: data/historico_unknown_samples.json");
  console.log("");
  console.log("Detalle:");
  details.forEach((d) => console.log(d));
}

main();
