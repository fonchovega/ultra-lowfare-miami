// ============================================================
// historico.js — Combina data.json con data/historico.json
// ============================================================

import { readJsonSafe, writeJson, ensureDir, log } from "./helper.js";
import path from "path";

const DATA_PATH = "./data.json";
const HIST_PATH = "./data/historico.json";

try {
  const data = readJsonSafe(DATA_PATH, null);
  if (!data) {
    log("⚠️ No se encontró data.json. Cancelando actualización.", "WARN");
    process.exit(0);
  }

  let historico = readJsonSafe(HIST_PATH, []);
  const yaExiste = historico.some((item) => item.meta?.generado === data.meta?.generado);

  if (!yaExiste) {
    historico.push(data);
    ensureDir(path.dirname(HIST_PATH));
    writeJson(HIST_PATH, historico);
    log(✅ Histórico actualizado (${historico.length} registros));
  } else {
    log("ℹ️ Registro duplicado. No se agregó al histórico.", "INFO");
  }

} catch (err) {
  log(❌ Error actualizando histórico: ${err.message}, "ERROR");
}
