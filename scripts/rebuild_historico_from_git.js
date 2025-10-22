/**
 * Reconstruye historico.json usando el historial de commits de data.json en Git.
 * - Lee todos los commits que tocaron data.json (o la ruta que indiques en DATA_FILE).
 * - Extrae el contenido de cada versión y normaliza a un formato común.
 * - Deduplica por meta.generado y escribe historico.json con tope MAX_HISTORY (default 600).
 *
 * Requisitos: tener Git instalado y ejecutar en un repo clonado (no zip).
 */

import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const MAX_HISTORY = Number(process.env.MAX_HISTORY || 600);
const DATA_FILE = process.env.DATA_FILE || "data.json";       // Ruta a reconstruir (por defecto en la raíz)
const HIST_FILE = process.env.HIST_FILE || "historico.json";  // Archivo de salida

// Utilidad segura de parseo
function safeParse(jsonStr) {
  try { return JSON.parse(jsonStr); } catch { return null; }
}

// Normaliza cualquier estructura detectada a un arreglo de entradas con meta.generado
function normalizeToEntries(obj, commitHash) {
  const entries = [];

  // Caso A: objeto con meta+resumen (formato actual)
  if (obj && typeof obj === "object" && obj.meta && obj.meta.generado) {
    entries.push(obj);
    return entries;
  }

  // Caso B: arreglo de corridas (algunas versiones pudieron tener array raíz)
  if (Array.isArray(obj)) {
    // intentamos detectar si cada item ya es tipo "objeto con meta"
    for (const it of obj) {
      if (it && it.meta && it.meta.generado) {
        entries.push(it);
      } else if (it && typeof it === "object") {
        // si no tiene meta.generado, creamos uno sintético con el commit como respaldo
        entries.push({
          meta: { generado: ${new Date().toISOString()}#${commitHash} },
          resumen: it.resumen || it.resultados || []
        });
      }
    }
    return entries;
  }

  // Caso C: objeto sin meta; metemos wrapper mínimo
  if (obj && typeof obj === "object") {
    entries.push({
      meta: { generado: ${new Date().toISOString()}#${commitHash} },
      resumen: obj.resumen || obj.resultados || []
    });
    return entries;
  }

  // Caso D: no parseable → ignorar
  return entries;
}

function getCommitsAffecting(filePath) {
  const cmd = git log --pretty=%H -- "${filePath}";
  const out = execSync(cmd, { encoding: "utf8" });
  const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  // Regresar en orden cronológico (del más antiguo al más nuevo)
  return lines.reverse();
}

function getFileAtCommit(filePath, commitHash) {
  try {
    const showCmd = git show ${commitHash}:"${filePath}";
    return execSync(showCmd, { encoding: "utf8" });
  } catch {
    return null;
  }
}

function main() {
  // Validaciones de entorno
  if (!fs.existsSync(".git")) {
    console.error("❌ Este script debe ejecutarse dentro de un repositorio Git clonado (carpeta .git no encontrada).");
    process.exit(1);
  }

  console.log(🔎 Reconstruyendo histórico desde commits de: ${DATA_FILE});
  const commits = getCommitsAffecting(DATA_FILE);
  if (!commits.length) {
    console.error("⚠️ No se encontraron commits que modifiquen el archivo indicado. Revisa la ruta en DATA_FILE.");
    process.exit(1);
  }
  console.log(🧭 Se detectaron ${commits.length} versiones de ${DATA_FILE});

  const historico = [];
  const seen = new Set(); // para deduplicar por meta.generado

  for (const hash of commits) {
    const content = getFileAtCommit(DATA_FILE, hash);
    if (!content) continue;

    const parsed = safeParse(content);
    if (!parsed) continue;

    const entries = normalizeToEntries(parsed, hash);
    for (const e of entries) {
      const key = e?.meta?.generado;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      historico.push(e);
    }
  }

  // Respetar tope
  const trimmed = historico.slice(-MAX_HISTORY);
  fs.writeFileSync(HIST_FILE, JSON.stringify(trimmed, null, 2), "utf8");

  console.log(✅ Histórico reconstruido: ${HIST_FILE});
  console.log(📦 Total de entradas: ${trimmed.length} (tope ${MAX_HISTORY}));
  console.log(ℹ️ Fuente: ${DATA_FILE} a través de ${commits.length} commits.);
}

main();
