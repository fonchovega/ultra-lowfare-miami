// ======================================================================
// Script: dedupe.js
// Función: Elimina duplicados del histórico según meta.generado
// ======================================================================

import fs from "fs";

const HIST_PATH = "./data/historico.json";

try {
  const raw = fs.readFileSync(HIST_PATH, "utf8");
  const historico = JSON.parse(raw);

  const vistos = new Set();
  const depurado = [];

  for (const item of historico) {
    const clave = item?.meta?.generado;
    if (clave && !vistos.has(clave)) {
      vistos.add(clave);
      depurado.push(item);
    }
  }

  const antes = historico.length;
  const despues = depurado.length;
  fs.writeFileSync(HIST_PATH, JSON.stringify(depurado, null, 2), "utf8");

  console.log(
    `✅ Histórico depurado. ${antes} → ${despues} registros únicos guardados.`
  );

} catch (err) {
  console.error("❌ Error depurando histórico:", err);
}
