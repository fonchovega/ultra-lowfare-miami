/**
 * 🧱 Reconstruye historico.json usando el historial de commits de data.json en Git.
 * - Lee todos los commits que tocaron data.json (la ruta se define en DATA_FILE).
 * - Extrae el contenido de cada versión y normaliza a un formato común.
 * - Deduplica por meta.generado y escribe historico.json con tope MAX_HISTORY (default 600).
 *
 * 📋 Requisitos: tener Git instalado y ejecutar en un repo clonado (no ZIP).
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const MAX_HISTORY = process.env.MAX_HISTORY || 600;
const DATA_FILE = process.env.DATA_FILE || "data.json"; // Ruta de entrada
const HIST_FILE = process.env.HIST_FILE || "historico.json"; // Archivo de salida

// --- Función segura para parsear JSON sin romper ---
function safeJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- Obtiene todos los commits que modificaron el archivo data.json ---
function getCommitsAffectingData() {
  try {
    const output = execSync(git log --pretty=format:%H -- ${DATA_FILE}, { encoding: "utf8" });
    return output.split("\n").filter(Boolean);
  } catch {
    console.error("❌ Error al obtener commits de Git. Asegúrate de estar en un repositorio válido.");
    process.exit(1);
  }
}

// --- Lee el contenido del archivo data.json en un commit específico ---
function readDataAt(ref) {
  try {
    const raw = execSync(git show ${ref}:${DATA_FILE}, { encoding: "utf8" });
    return safeJSON(raw);
  } catch {
    return null;
  }
}

// --- Normaliza y deduplica los registros ---
function normalizeEntries(jsonData) {
  if (!jsonData) return [];
  if (!Array.isArray(jsonData)) jsonData = [jsonData];

  const entries = [];
  for (const block of jsonData) {
    if (!block || !block.resultados) continue;
    for (const record of block.resultados) {
      entries.push({
        meta: { generado: block.meta?.generado || null },
        resumen: record,
      });
    }
  }

  return entries;
}

// --- Reconstrucción completa ---
function rebuild() {
  console.log(🔄 Reconstruyendo ${HIST_FILE} desde historial de ${DATA_FILE} ...);

  const commits = getCommitsAffectingData();
  const all = [];

  for (const commitHash of commits.reverse()) {
    const data = readDataAt(commitHash);
    const entries = normalizeEntries(data);
    all.push(...entries);
  }

  // Deduplicar por meta.generado
  const unique = [];
  const seen = new Set();
  for (const item of all) {
    const key = item.meta?.generado;
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  // Limitar al máximo
  const limited = unique.slice(-MAX_HISTORY);

  // Escribir resultado
  fs.writeFileSync(HIST_FILE, JSON.stringify(limited, null, 2), "utf8");
  console.log(✅ Reconstrucción lista: ${HIST_FILE} (${limited.length} registros, límite ${MAX_HISTORY}));
}

// --- Ejecución principal ---
try {
  rebuild();
} catch (err) {
  console.error("⚠️ Error reconstruyendo histórico:", err);
  process.exit(1);
}
