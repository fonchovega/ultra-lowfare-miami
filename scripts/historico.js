// =============================================================
// Script: historico.js
// Función: Combina data.json actual con historico.json acumulado
// =============================================================
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

  // Evita duplicados por fecha
  const yaExiste = historico.some(
    (item) => item.meta?.generado === data.meta?.generado
  );

  if (!yaExiste) {
    historico.push(data);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("✅ Histórico actualizado correctamente.");
  } else {
    console.log("⚠️ Registro ya existente, no se agregó duplicado.");
  }

  // Mantener máximo 200 registros (opcional)
  if (historico.length > 200) {
    historico = historico.slice(-200);
    fs.writeFileSync(HIST_PATH, JSON.stringify(historico, null, 2), "utf8");
    console.log("⚙️ Histórico recortado a las últimas 200 ejecuciones.");
  }
} catch (err) {
  console.error("❌ Error procesando histórico:", err);
}
