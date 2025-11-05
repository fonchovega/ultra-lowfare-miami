// scripts/audit_historico_v133_view.js
// Ultra-LowFare · Visualizador/Auditor v1.3.3
// Lee los outputs normalizados y detallados para mostrar estadísticas útiles

import fs from "fs";
import path from "path";
import { logInfo, logWarn, logError, DEFAULT_PATHS } from "./helpers/helper.js";

function loadJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    logWarn(`No se pudo leer ${file}: ${e.message}`);
    return null;
  }
}

function main() {
  logInfo("=== Vista Auditoría Historico v1.3.3 ===");

  const auditFile = path.join(DEFAULT_PATHS.dataDir, "historico_audit_v133.json");
  const normFile = path.join(DEFAULT_PATHS.dataDir, "historico_normalized_v133.json");
  const detFile = path.join(DEFAULT_PATHS.dataDir, "historico_detailed_v133.json");

  const audit = loadJsonSafe(auditFile);
  const norm = loadJsonSafe(normFile);
  const det = loadJsonSafe(detFile);

  if (!audit || !norm || !det) {
    logError("Faltan archivos de salida de la versión 1.3.3. Ejecuta primero writer_historico_v133_full.js");
    return;
  }

  logInfo(`Versión: ${audit.meta.version}`);
  logInfo(`Timestamp: ${audit.meta.timestamp}`);
  logInfo(`Total raw: ${audit.meta.total_raw}`);
  logInfo(`Total normalizado: ${audit.meta.total_normalized}`);
  logInfo(`Total detallado: ${audit.meta.total_detailed}`);

  logInfo("Conteo por tipo de estructura:");
  for (const [k, v] of Object.entries(audit.conteo_por_tag)) {
    logInfo(`  ${k.padEnd(6)} → ${v}`);
  }

  const uniqueRutas = [...new Set(det.map((d) => d.ruta))];
  const minPrecio = Math.min(...det.map((d) => d.precio_usd || Infinity));
  const maxPrecio = Math.max(...det.map((d) => d.precio_usd || 0));

  logInfo("Resumen de dataset detallado:");
  logInfo(`  Total rutas únicas: ${uniqueRutas.length}`);
  logInfo(`  Precio mínimo: ${minPrecio}`);
  logInfo(`  Precio máximo: ${maxPrecio}`);

  const fuentes = {};
  det.forEach((d) => {
    const f = d.fuente_tipo || "desconocido";
    fuentes[f] = (fuentes[f] || 0) + 1;
  });

  logInfo("Distribución por tipo de fuente:");
  Object.entries(fuentes).forEach(([f, n]) => logInfo(`  ${f.padEnd(12)}: ${n}`));

  logInfo("✅ Auditoría de vista completada");
}

main();
