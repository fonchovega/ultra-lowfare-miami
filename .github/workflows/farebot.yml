// ============================================================
// sync_all.js — Sincroniza histórico + genera contexto v1.2
// ============================================================

import path from "path";
import { execSync } from "child_process";
import { readJsonSafe, writeJson, ensureDir, nowIsoUtc, log } from "./helper.js";

const DATA_PATH = "./data.json";
const HIST_PATH = "./data/historico.json";
const CONTEXT_PATH = "./data/historico_contextual_v1.2.json";
const CFG_PATH = "./config.json";

log("🚀 Iniciando sincronización total...");

const updateHistorico = () => {
  const data = readJsonSafe(DATA_PATH, null);
  if (!data) {
    log("⚠️ No hay data.json, omitiendo histórico.", "WARN");
    return 0;
  }

  let historico = readJsonSafe(HIST_PATH, []);
  const yaExiste = historico.some((i) => i.meta?.generado === data.meta?.generado);

  if (!yaExiste) {
    historico.push(data);
    writeJson(HIST_PATH, historico);
    log(✅ Histórico actualizado (${historico.length}));
  } else {
    log("ℹ️ Registro existente. No agregado.");
  }
  return historico.length;
};

const generateContext = (snapCount) => {
  const REPO = "fonchovega/ultra-lowfare-miami";
  const cfg = readJsonSafe(CFG_PATH, null);

  const payload = {
    meta: {
      tipo: "contextual",
      version_contexto: "v1.2",
      fuente: "ChatGPT_sync + GitHub Actions API",
      fecha_sync: nowIsoUtc(),
      repo: REPO,
      commit: execSync("git rev-parse HEAD").toString().trim(),
    },
    resumen: {
      snapshots_en_historico_json: snapCount,
      ultimo_dedupe: { ejecutado: true, registros_unicos: snapCount },
      config: cfg,
    },
    bitacora_tecnica: [
      "v1.1: histórico en /data",
      "v1.2: guard_run + dedupe + límites",
      "v1.3.1: helper.js consolidado y referencias corregidas",
    ],
  };

  writeJson(CONTEXT_PATH, payload);
  log(✅ Contexto v1.2 generado en ${CONTEXT_PATH});
};

const totalSnapshots = updateHistorico();
generateContext(totalSnapshots);

log("🎯 Sincronización finalizada correctamente.");
