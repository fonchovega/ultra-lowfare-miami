// ======================================================================
// Script: scripts/rebuild_historico_from_git.js
// Reconstruye data/historico.json leyendo el historial de commits de data.json
// - Lee todos los commits que modificaron data.json
// - Extrae el contenido (objeto o array) de cada versión
// - Normaliza, deduplica por meta.generado y guarda hasta MAX_HISTORY entradas
// ======================================================================

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Config
const MAX_HISTORY = Number(process.env.MAX_HISTORY || 600);
const DATA_FILE = "data.json";              // archivo rastreado en git
const HIST_FILE = path.join("data", "historico.json"); // destino acumulado

// Utilidades
function safeJSON(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

// Devuelve hashes de commits que tocaron data.json (más antiguo primero)
function getCommitsAffectingData() {
  try {
    const out = execSync(`git log --pretty=format:%H -- ${DATA_FILE}`, { encoding: "utf8" });
    return out.split("\n").filter(Boolean).reverse();
  } catch (err) {
    console.error("❌ Error ejecutando git log:", err.message);
    return [];
  }
}

// Lee el contenido de data.json en un commit dado (SHA)
function readDataAt(commit) {
  try {
    const raw = execSync(`git show ${commit}:${DATA_FILE}`, { encoding: "utf8" });
    return safeJSON(raw);
  } catch {
    return null;
  }
}

// Normaliza: acepta objeto único o array de objetos
function normalizeEntries(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (typeof json === "object") return [json];
  return [];
}

function run() {
  console.log(`🛠️  Reconstruyendo ${HIST_FILE} desde el historial de ${DATA_FILE}...`);
  const commits = getCommitsAffectingData();
  if (commits.length === 0) {
    console.log("ℹ️  No se encontraron commits que afecten data.json.");
    return;
  }

  // Cargar histórico existente (si hay)
  let historicoActual = [];
  if (fs.existsSync(HIST_FILE)) {
    const raw = fs.readFileSync(HIST_FILE, "utf8");
    historicoActual = safeJSON(raw) || [];
  }

  const vistos = new Set(
    historicoActual
      .map(e => e?.meta?.generado)
      .filter(Boolean)
  );

  const reconstruido = [...historicoActual];

  for (const sha of commits) {
    const json = readDataAt(sha);
    const entries = normalizeEntries(json);

    for (const entry of entries) {
      const timestamp = entry?.meta?.generado || entry?.meta?.fecha || entry?.fecha;
      if (!timestamp) continue; // si no podemos deduplicar, lo ignoramos
      if (vistos.has(timestamp)) continue;

      reconstruido.push(entry);
      vistos.add(timestamp);
    }
  }

  // Recorta a las últimas MAX_HISTORY entradas (más recientes al final)
  const recortado = reconstruido.slice(-MAX_HISTORY);

  // Asegura carpeta /data
  fs.mkdirSync(path.dirname(HIST_FILE), { recursive: true });
  fs.writeFileSync(HIST_FILE, JSON.stringify(recortado, null, 2), "utf8");

  console.log(`✅ Listo. Escribí ${recortado.length} registros en ${HIST_FILE} (máx ${MAX_HISTORY}).`);
}

run();
