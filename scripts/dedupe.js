// ============================================================
// dedupe.js — Deduplica data/historico.json por meta.generado
//  - Mantiene el primer snapshot encontrado para cada timestamp
//  - Ordena por meta.generado asc (ISO) y reescribe el archivo
//  - Emite un reporte en data/historico_dedupe_report.json
//  - Puede importarse como módulo (dedupeHistorico) o ejecutarse solo
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const HIST_PATH = path.join(__dirname, "..", "data", "historico.json");
const REPORT_PATH = path.join(__dirname, "..", "data", "historico_dedupe_report.json");

export function dedupeHistorico() {
  if (!fs.existsSync(HIST_PATH)) {
    return { ok: true, antes: 0, despues: 0, removidos: 0 };
  }

  const raw = fs.readFileSync(HIST_PATH, "utf8");
  let arr;
  try {
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error("historico.json no es un array");
  } catch (e) {
    throw new Error(historico.json inválido: ${e.message});
  }

  const antes = arr.length;

  // Normalizar clave de dedupe (ISO de meta.generado)
  const seen = new Set();
  const deduped = [];
  for (const item of arr) {
    const key = item?.meta?.generado ?? "";
    if (!key) {
      // Si no hay meta.generado, se conserva (pero sin duplicar objetos idénticos por JSON.stringify)
      const json = JSON.stringify(item);
      if (!seen.has(json)) {
        seen.add(json);
        deduped.push(item);
      }
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  // Orden por timestamp (si existe) ascendente
  deduped.sort((a, b) => {
    const ta = a?.meta?.generado ?? "";
    const tb = b?.meta?.generado ?? "";
    return ta.localeCompare(tb);
  });

  const despues = deduped.length;
  const removidos = antes - despues;

  fs.writeFileSync(HIST_PATH, JSON.stringify(deduped, null, 2), "utf8");

  const report = {
    meta: {
      generado: new Date().toISOString(),
      script: "dedupe.js",
    },
    resumen: { antes, despues, removidos },
    detalles: {
      criterio: "meta.generado (ISO) + fallback JSON.stringify",
      orden: "ascendente por meta.generado",
      archivo: "data/historico.json",
    },
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  return { ok: true, antes, despues, removidos, report_path: REPORT_PATH };
}

// Modo ejecución directa: node scripts/dedupe.js
if (import.meta.main) {
  try {
    const res = dedupeHistorico();
    console.log(
      ✅ Dedupe completado | antes=${res.antes} despues=${res.despues} removidos=${res.removidos}
    );
    process.exit(0);
  } catch (e) {
    console.error("❌ Error en dedupe:", e.message);
    process.exit(1);
  }
}
