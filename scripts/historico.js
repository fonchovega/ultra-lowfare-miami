// 📘 reconstruye historico.json desde los commits previos de data.json
import { execSync } from "child_process";
import fs from "fs";

const HISTORICO_PATH = "./historico.json";

function getDataFromCommit(ref) {
  try {
    const raw = execSync(git show ${ref}:data.json, { encoding: "utf8" });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getAllCommits() {
  const raw = execSync(git log --pretty=format:%H -- data.json, {
    encoding: "utf8",
  });
  return raw.split("\n").reverse(); // más antiguo → más reciente
}

(function buildHistorico() {
  const commits = getAllCommits();
  const historico = [];

  console.log(🔍 Analizando ${commits.length} commits con data.json...);

  for (const commit of commits) {
    const snap = getDataFromCommit(commit);
    if (!snap || !snap.resumen) continue;

    const fecha = snap.meta?.generado || "sin-fecha";
    for (const r of snap.resumen) {
      historico.push({
        fecha,
        ruta: r.ruta,
        salida: r.salida,
        retorno: r.retorno,
        precio: r.precio,
        umbral: r.umbral,
        cumple: r.precio <= r.umbral,
      });
    }
  }

  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(historico, null, 2), "utf8");
  console.log(✅ historico.json reconstruido con ${historico.length} registros.);
})();
