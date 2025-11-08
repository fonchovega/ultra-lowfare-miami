/*
  reader_normalizado_v133.js
  Lector exclusivo de data/historico_normalizado.json para FrontWeb v1.3.3
  - Sin fallback a historico.json
  - Errores explícitos si no existe o está vacío
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta garantizada al repo (carpeta raíz que contiene "data")
function repoRootDir() {
  // sube desde scripts/helpers hasta raíz del repo
  return path.resolve(__dirname, "..", "..");
}

function readJsonSafe(absPath) {
  try {
    if (!fs.existsSync(absPath)) {
      return { ok: false, err: "NO_FILE", data: null };
    }
    const raw = fs.readFileSync(absPath, "utf8");
    if (!raw || !raw.trim()) {
      return { ok: false, err: "EMPTY_FILE", data: null };
    }
    const parsed = JSON.parse(raw);
    return { ok: true, err: null, data: parsed };
  } catch (e) {
    return { ok: false, err: "PARSE_ERROR: " + e.message, data: null };
  }
}

export function loadHistoricoNormalizado() {
  const root = repoRootDir();
  const abs = path.join(root, "data", "historico_normalizado.json");

  const out = readJsonSafe(abs);
  if (!out.ok) {
    const msg =
      "FrontWeb v1.3.3 requiere data/historico_normalizado.json. Error: " + out.err +
      ". Ejecuta: npm run verify:v133 y luego npm run fix:unknowns para generarlo.";
    const err = new Error(msg);
    err.code = "NORMALIZADO_MISSING";
    err.path = abs;
    throw err;
  }

  // Debe ser Array no vacío (FrontWeb consume arrays)
  if (!Array.isArray(out.data) || out.data.length === 0) {
    const msg =
      "historico_normalizado.json existe pero está vacío o no es un arreglo. Reprocesa el histórico.";
    const err = new Error(msg);
    err.code = "NORMALIZADO_EMPTY";
    err.path = abs;
    throw err;
  }

  return out.data;
}
