// Script para reconstruir historico.json combinando data.json y commits previos
import fs from "fs";

const DATA_PATH = "./data.json";
const HIST_PATH = "./historico.json";

try {
  // Leer el archivo data.json actual
  const dataRaw = fs.readFileSync(DATA_PATH, "utf8");
  const data = JSON.parse(dataRaw);

  // Si no existe historico.json, crearlo vacío
  let historico = [];
  if (fs.existsSync(HIST_PATH)) {
    const histRaw = fs.readFileSync(HIST_PATH, "utf8");
    historico = JSON.parse(histRaw);
  }

  // Evita duplicados según fecha
  const yaExiste = historico.some(
    (item) => item.meta?.generado === data.meta?.generado
  );

  if (!yaExiste) {
    historico.push(data);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("✅ Histórico actualizado correctamente.");
  } else {
    console.log("⚠️ Los datos ya estaban en el histórico, no se duplicaron.");
  }

  // Recorta a 600 entradas máximo (opcional)
  if (historico.length > 600) {
    historico = historico.slice(-600);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("⚙️ Histórico recortado a las últimas 200 ejecuciones.");
  }
} catch (err) {
  console.error("❌ Error procesando histórico:", err);
}
