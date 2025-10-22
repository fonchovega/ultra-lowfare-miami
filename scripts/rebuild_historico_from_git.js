/**
 * Reconstruye historico.json leyendo el historial de commits de data.json.
 * - Lista todos los commits que modificaron data.json.
 * - Extrae y normaliza el contenido (resultados) de cada versión.
 * - Deduplica por meta.generado y guarda hasta MAX_HISTORY entradas.
 */

import { execSync } from "child_process";
import fs from "fs";

const MAX_HISTORY = Number(process.env.MAX_HISTORY || 600);
const DATA_FILE   = "data.json";
const HIST_FILE   = "historico.json";

/* ---------- utilidades ---------- */
function safeJSON(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

/** Devuelve hashes de commits que tocaron data.json (más antiguo primero) */
function getCommitsAffectingData() {
  try {
    const out = execSync(`git log --pretty=format:%H -- ${DATA_FILE}`, { encoding: "utf8" });
    // más antiguo primero
    return out.split("\n").filter(Boolean).reverse();
  } catch (err) {
    console.error("Error ejecutando git log:", err.message);
    return [];
  }
}

/** Lee el contenido de data.json en un commit dado (hash) */
function readDataAt(commitHash) {
  try {
    const raw = execSync(`git show ${commitHash}:${DATA_FILE}`, { encoding: "utf8" });
    return safeJSON(raw);
  } catch {
    return null;
  }
}

/** Normaliza cualquier forma a un arreglo de registros {meta,resumen} */
function normalizeEntries(jsonData) {
  if (!jsonData) return [];
  const blocks = Array.isArray(jsonData) ? jsonData : [jsonData];

  const entries = [];
  for (const block of blocks) {
    if (!block || !block.resultados) continue;

    for (const rec of block.resultados) {
      entries.push({
        meta: {
          // si existe meta.generado lo usamos, si no, null (luego se completa)
          generado: block?.meta?.generado ?? null,
        },
        resumen: rec,
      });
    }
  }
  return entries;
}

/* ---------- reconstrucción ---------- */
function rebuild() {
  console.log(`Reconstruyendo ${HIST_FILE} desde el historial de ${DATA_FILE}...`);

  const commits = getCommitsAffectingData();
  if (commits.length === 0) {
    console.error("No se hallaron commits que afecten data.json.");
    process.exit(1);
  }

  const all = [];

  for (const commitHash of commits) {
    const data = readDataAt(commitHash);
    const entries = normalizeEntries(data);

    // completa meta.generado si venía null, con timestamp sintético taggeado por commit
    for (const e of entries) {
      if (!e.meta.generado) e.meta.generado = `${new Date().toISOString()}#${commitHash}`;
      all.push(e);
    }

    // opcional: corta temprano si ya superamos el tope
    if (all.length >= MAX_HISTORY) break;
  }

  // deduplica por meta.generado (última ocurrencia gana)
  const map = new Map();
  for (const e of all) map.set(e.meta.generado, e);

  // ordena por fecha ascendente (ISO empieza con año, sirve para ordenar)
  const ordered = Array.from(map.values()).sort(
    (a, b) => String(a.meta.generado).localeCompare(String(b.meta.generado))
  );

  // recorta a las últimas MAX_HISTORY entradas
  const recorte = ordered.slice(-MAX_HISTORY);

  fs.writeFileSync(HIST_FILE, JSON.stringify(recorte, null, 2), "utf8");
  console.log(`Listo. Escribí ${recorte.length} registros en ${HIST_FILE} (máx ${MAX_HISTORY}).`);
}

/* ---------- main ---------- */
try {
  // verificación simple de que existe repo git
  if (!fs.existsSync(".git")) {
    console.error("Este script debe ejecutarse dentro de un repo Git (carpeta .git no encontrada).");
    process.exit(1);
  }
  rebuild();
} catch (err) {
  console.error("Error reconstruyendo histórico:", err);
  process.exit(1);
}
