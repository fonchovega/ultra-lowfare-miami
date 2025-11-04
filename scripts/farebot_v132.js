// ============================================================
// alert.js — Sistema de alertas FareBot v1.3.2
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nowIsoUtc, log } from "./helper.js";

// ------------------------------------------------------------
// Configuración
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALERT_LOG = path.join(__dirname, "../data/alert_log.json");

const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
function readJsonSafe(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data) ? data : fallback;
  } catch (err) {
    log(`⚠️ Error leyendo ${file}: ${err.message}`);
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    log(`⚠️ Error escribiendo ${file}: ${err.message}`);
  }
}

// ------------------------------------------------------------
// Alerta si hay caída de precio
// ------------------------------------------------------------
export async function alertIfDrop(precioActual) {
  const logs = readJsonSafe(ALERT_LOG, []);
  const ultimaAlerta = logs[logs.length - 1];
  const ultimaFecha = ultimaAlerta?.fecha || "n/a";
  const ultimoPrecio = ultimaAlerta?.precio || null;

  if (ultimoPrecio && precioActual >= ultimoPrecio) {
    log(`🔸 Sin cambios relevantes: $${precioActual} ≥ $${ultimoPrecio}`);
    return;
  }

  const mensaje = [
    `**Alerta de tarifas - ${new Date().toISOString()}**`,
    "",
    `🟢 Nuevo precio más bajo detectado: $${precioActual}`,
    ultimoPrecio
      ? `📉 Anterior: $${ultimoPrecio} (del ${ultimaFecha})`
      : "Primer registro detectado.",
    "",
    `🕓 Generado: ${nowIsoUtc()}`,
  ].join("\n");

  log("📩 Enviando alerta de Telegram...");
  const enviado = await sendTelegramMessage(mensaje);

  logs.push({
    fecha: nowIsoUtc(),
    precio: precioActual,
    enviado: enviado ? "✅" : "❌",
  });

  writeJson(ALERT_LOG, logs);
  log("🗂️ Log de alertas actualizado.");
}

// ------------------------------------------------------------
// Envío a Telegram (si configurado)
// ------------------------------------------------------------
async function sendTelegramMessage(text) {
  if (!TELEGRAM_API_URL || !TELEGRAM_CHAT_ID) {
    log("⚠️ No se configuró Telegram; alerta no enviada.");
    return false;
  }

  try {
    const res = await fetch(
      `${TELEGRAM_API_URL}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(
        text
      )}&parse_mode=Markdown`
    );

    if (!res.ok) {
      log(`⚠️ Error al enviar Telegram: ${res.statusText}`);
      return false;
    }

    log("✅ Alerta enviada correctamente a Telegram.");
    return true;
  } catch (err) {
    log(`❌ Error enviando alerta: ${err.message}`);
    return false;
  }
}
