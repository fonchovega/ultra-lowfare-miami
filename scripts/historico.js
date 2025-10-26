// ======================================================================
// Script: historico.js
// Función: Combina data.json actual con data/historico.json acumulado
// ======================================================================

import fs from "fs";

const DATA_PATH = "./data.json";                 // data actual (última corrida)
const HIST_PATH = "./data/historico.json";       // ruta nueva del histórico

try {
  // Leer data.json (última ejecución)
  const dataRaw = fs.readFileSync(DATA_PATH, "utf8");
  const data = JSON.parse(dataRaw);

  // Leer o inicializar histórico
  let historico = [];
  if (fs.existsSync(HIST_PATH)) {
    const histRaw = fs.readFileSync(HIST_PATH, "utf8");
    historico = JSON.parse(histRaw);
  }

  // Evitar duplicados por fecha exacta (meta.generado)
  const yaExiste = historico.some(
    (item) => item.meta?.generado === data.meta?.generado
  );

  if (!yaExiste) {
    historico.push(data);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log(`✅ Histórico actualizado en ${HIST_PATH}`);
  } else {
    console.log("ℹ️  Registro ya existente, no se agregó al histórico.");
  }

} catch (err) {
  console.error("❌ Error combinando data.json con histórico:", err);
}
