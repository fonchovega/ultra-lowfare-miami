// scripts/writer_historico_v133_full.js
// Ultra-LowFare · Writer/Auditor completo v1.3.3
// Relee el histórico, detecta estructuras, normaliza, enriquece y guarda resultados

import {
  DEFAULT_PATHS,
  loadHistorico,
  writeJsonSafe,
  logInfo,
  logWarn,
  logError,
  nowIso,
} from "./helpers/helper.js";
import {
  detectHistoricoVariant,
  normalizeAll,
  summarizeCounts,
  TAGS,
} from "./helpers/schema_v133.js";
import { buildDetailedDataset } from "./helpers/schema_detalle_v133.js";
import path from "path";

async function main() {
  logInfo("=== Auditoría y Normalización Historico v1.3.3 ===");

  // 1. Leer histórico original
  const historico = loadHistorico();
  if (!Array.isArray(historico) || historico.length === 0) {
    logWarn("El archivo historico.json está vacío o no es válido.");
    return;
  }
  logInfo(`Registros cargados: ${historico.length}`);

  // 2. Detectar variantes y normalizar
  const { normalized, tags } = normalizeAll(historico);
  const counts = summarizeCounts(tags);

  logInfo(`Normalizados: ${normalized.length}`);
  for (const [k, v] of Object.entries(counts)) {
    logInfo(`  ${k.padEnd(6)}: ${v}`);
  }

  // 3. Enriquecer con detalle extendido
  const detailed = buildDetailedDataset(normalized);
  logInfo(`Dataset detallado listo: ${detailed.length} filas`);

  // 4. Guardar outputs
  const outDir = DEFAULT_PATHS.dataDir;
  const auditFile = path.join(outDir, "historico_audit_v133.json");
  const normalizedFile = path.join(outDir, "historico_normalized_v133.json");
  const detailedFile = path.join(outDir, "historico_detailed_v133.json");

  writeJsonSafe(auditFile, {
    meta: {
      version: "1.3.3",
      timestamp: nowIso(),
      total_raw: historico.length,
      total_normalized: normalized.length,
      total_detailed: detailed.length,
    },
    conteo_por_tag: counts,
  });

  writeJsonSafe(normalizedFile, normalized);
  writeJsonSafe(detailedFile, detailed);

  logInfo("Archivos generados:");
  logInfo(` - ${auditFile}`);
  logInfo(` - ${normalizedFile}`);
  logInfo(` - ${detailedFile}`);

  logInfo("✅ Proceso finalizado correctamente");
}

// ---- Ejecutar ----
main().catch((err) => {
  logError("Error crítico al procesar histórico", "writer_historico_v133_full", err);
});
