// 📘 Script para generar historico.json desde los commits previos de data.json
// Autor: Victor Vega — Ultra Low Fare Bot

import { execSync } from "child_process";
import fs from "fs";

const HISTORICO_PATH = "./historico.json";
const TMP_FILE = "./tmp_data.json";

// 🧠 Función auxiliar para leer una versión antigua del data.json
function getDataFromCommit(ref) {
  try {
    const raw = execSync(git show ${ref}:data.json, { encoding: "utf8" });
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function getAllCommits() {
  const raw = execSync(git log --pretty=format:%H -- data.json, { encoding: "utf8" });
  return raw.split("\n").reverse(); // De antiguo a reciente
}

function buildHistorico() {
  const commits = getAllCommits();
  const historico = [];

  console.log(🔍 Analizando ${commits.length} commits con data.json...);

  for (const commit of commits) {
    const snapshot = getDataFromCommit(commit);
    if (!snapshot || !snapshot.resumen) continue;

    const fecha = snapshot.meta?.generado || "sin-fecha";
    snapshot.resumen.forEach((r) => {
      historico.push({
        fecha,
        ruta: r.ruta,
        salida: r.salida,
        retorno: r.retorno,
        precio: r.precio,
        umbral: r.umbral,
        cumple: r.cumple
      });
    });
  }

  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(historico, null, 2), "utf8");
  console.log(✅ historico.json generado con ${historico.length} registros.);
}
buildHistorico();
