// ============================================================
// notify_price_drops.js — Envía notificaciones de caídas de precio
// ============================================================

import fs from "fs";
import path from "path";
import { log, nowIsoUtc, writeJson, readJsonSafe } from "./helper.js"; // 🔧 ruta corregida
import { sendTelegram } from "./helpers/alert.js"; // ya estaba correcto

// ============================================================
// CONFIGURACIÓN
// ============================================================
const DATA_DIR = "./data";
const DATA_FILE = path.join(DATA_DIR, "data.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const ALERT_LOG = path.join(DATA_DIR, "alerts_log.json");

const UMBRAL_ALERTA = 20; // Diferencia porcentual mínima para disparar alerta

// ============================================================
// FUNCIONES PRINCIPALES
// ============================================================

const calcularDiferencia = (anterior, actual) => {
  if (!anterior || anterior <= 0) return 0;
  return ((anterior - actual) / anterior) * 100;
};

const registrarAlerta = (detalle) => {
  const logs = readJsonSafe(ALERT_LOG, []);
  logs.push({ fecha: nowIsoUtc(), ...detalle });
  writeJson(ALERT_LOG, logs);
  log(`🟢 Alerta registrada: ${detalle.mensaje}`, "ALERT");
};

const procesar = () => {
  log("🚀 Iniciando verificación de caídas de precios...", "RUN");

  const data = readJsonSafe(DATA_FILE, null);
  const historico = readJsonSafe(HIST_FILE, []);
  if (!data || !data.resultados) {
    log("⚠️ No hay resultados recientes para analizar.", "WARN");
    return;
  }

  const actuales = data.resultados;
  const alertas = [];

  for (const vuelo of actuales) {
    const { route, precio } = vuelo;
    const prev = historico
      .filter((h) => h.resumen?.ruta?.includes(route))
      .sort((a, b) => new Date(b.meta.generado) - new Date(a.meta.generado))[0];

    if (prev?.resumen?.precio_encontrado) {
      const diff = calcularDiferencia(prev.resumen.precio_encontrado, precio);
      if (diff >= UMBRAL_ALERTA) {
        const msg = `✈️ ${route}: bajó ${diff.toFixed(1)}% → ahora $${precio} (antes $${prev.resumen.precio_encontrado})`;
        alertas.push(msg);
        registrarAlerta({ ruta: route, mensaje: msg });
      }
    }
  }

  if (alertas.length > 0) {
    sendTelegram(`🔥 **Alerta de tarifas (${nowIsoUtc()})**\n${alertas.join("\n")}`);
  } else {
    log("Sin caídas de precio significativas.", "INFO");
  }
};

procesar();
