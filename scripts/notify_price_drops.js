// scripts/notify_price_drops.js
// ------------------------------------------------------------
// Detecta bajadas de precio entre ejecuciones y dispara alertas.
// ------------------------------------------------------------

import path from "path";
import {
  log,
  DATA_DIR,
  readJson,
  writeJson,
  ensureDir,
  nowIsoUtc,
  resolvePath,
} from "./helpers/helper.js";
import { sendAlert } from "./alert.js";

const STATE_FILE = resolvePath("logs", "notify_state.json");

function loadState() {
  return readJson(STATE_FILE, { byRoute: {} });
}

function saveState(state) {
  ensureDir(path.dirname(STATE_FILE));
  writeJson(STATE_FILE, state);
}

function snapshotBestByRoute(currentData) {
  const out = {};
  try {
    const resultados = currentData?.resultados ?? [];
    for (const r of resultados) {
      const route = r?.route || r?.ruta || "UNKNOWN";
      const price =
        r?.price ?? r?.precio ?? r?.mejor_precio ?? r?.summary?.best_price;
      if (price == null) continue;
      if (!(route in out) || Number(price) < Number(out[route])) {
        out[route] = Number(price);
      }
    }
  } catch (e) {
    log(`[snapshotBestByRoute] error: ${e?.message || e}`);
  }
  return out;
}

function buildAlertMessage({ route, oldPrice, newPrice, meta }) {
  const diff = oldPrice - newPrice;
  const pct = oldPrice > 0 ? Math.round((diff / oldPrice) * 100) : 0;

  return [
    `🔻 Bajó el precio en ${route}`,
    `• Antes: $${oldPrice}`,
    `• Ahora: $${newPrice}`,
    `• Ahorro: $${diff} (${pct}%)`,
    `• Fuente: ${meta?.fuente || meta?.source || "desconocida"}`,
    `• Generado: ${meta?.generado || nowIsoUtc()}`,
  ].join("\n");
}

async function main() {
  log("🔎 notify_price_drops: iniciando comparación…");

  const dataPath = path.join(DATA_DIR, "data.json");
  const current = readJson(dataPath, null);
  if (!current) {
    log("⚠️ No se encontró data.json, nada que notificar.");
    return;
  }

  const currentBest = snapshotBestByRoute(current);
  const state = loadState();
  const prevBest = state.byRoute || {};

  let alerts = 0;
  for (const [route, newPrice] of Object.entries(currentBest)) {
    const oldPrice = prevBest[route];
    if (oldPrice == null) continue;

    if (Number(newPrice) < Number(oldPrice)) {
      alerts += 1;
      const msg = buildAlertMessage({
        route,
        oldPrice: Number(oldPrice),
        newPrice: Number(newPrice),
        meta: current?.meta || {},
      });

      try {
        await sendAlert(msg);
        log(`📣 Alerta enviada (${route}): $${oldPrice} → $${newPrice}`);
      } catch (e) {
        log(`⚠️ Error enviando alerta (${route}): ${e?.message || e}`);
      }
    }
  }

  state.byRoute = currentBest;
  state.updatedAt = nowIsoUtc();
  saveState(state);

  log(`✅ notify_price_drops: terminado. Alertas enviadas: ${alerts}`);
}

try {
  await main();
} catch (err) {
  log(`❌ notify_price_drops error: ${err?.stack || err}`);
  process.exitCode = 1;
}
