// Script para reconstruir historico.json combinando data.json y commits previos
import fs from "fs";
import path from "path";

const DATA_PATH = "./data.json";
const HIST_PATH = "./historico.json";

try {
  const dataRaw = fs.readFileSync(DATA_PATH, "utf8");
  const data = JSON.parse(dataRaw);

  // Si no existe historico.json, crear uno nuevo
  let historico = [];
  if (fs.existsSync(HIST_PATH)) {
    const histRaw = fs.readFileSync(HIST_PATH, "utf8");
    historico = JSON.parse(histRaw);
  }

  // Agrega nuevo bloque solo si no está duplicado por fecha
  const yaExiste = historico.some((item) => item.meta?.generado === data.meta?.generado);
  if (!yaExiste) {
    historico.push(data);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("✅ Histórico actualizado correctamente.");
  } else {
    console.log("⚠️ Los datos ya estaban registrados en el histórico.");
  }

  // Limita opcionalmente a 200 entradas (puedes cambiarlo)
  if (historico.length > 200) {
    historico = historico.slice(-200);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("⚙️ Histórico recortado a las últimas 200 ejecuciones.");
  }
} catch (err) {
  console.error("❌ Error procesando histórico:", err);
}
