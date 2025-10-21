// ===============================================================
// Script: historico.js
// Función: Combina data.json actual con historico.json acumulado
// ===============================================================

import fs from "fs";

const DATA_PATH = "./data.json";
const HIST_PATH = "./historico.json";

try {
  // Leer data.json
  const dataRaw = fs.readFileSync(DATA_PATH, "utf8");
  const data = JSON.parse(dataRaw);

  // Leer o inicializar histórico
  let historico = [];
  if (fs.existsSync(HIST_PATH)) {
    const histRaw = fs.readFileSync(HIST_PATH, "utf8");
    historico = JSON.parse(histRaw);
  }

  // Evitar duplicados por fecha (meta.generado)
  const yaExiste = historico.some(
    (item) => item?.meta?.generado === data?.meta?.generado
  );

  if (!yaExiste) {
    historico.push(data);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("Historico actualizado correctamente.");
  } else {
    console.log("Registro ya existente; no se agrego duplicado.");
  }

  // Mantener maximo 600 registros (opcional)
  if (historico.length > 600) {
    historico = historico.slice(-600);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("Historico recortado a las ultimas 200 ejecuciones.");
  }
} catch (err) {
  console.error("Error procesando historico:", err);
}
