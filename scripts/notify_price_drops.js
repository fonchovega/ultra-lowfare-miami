// ESM
import { fileURLToPath } from "url";
import path from "path";
import { readFile } from "fs/promises";

// Nuestros utilitarios
import { readJsonSafe, writeJson, log } from "./helpers/helper.js";

/**
 * Configuración por entorno
 * SOURCE puede ser: 'live' | 'mock' | 'adaptative'
 * ALERT_THRESHOLD_USD: umbral general (fallback) si no hay por-corredor
 */
const SOURCE_FILTER = (process.env.SOURCE || process.env.FAREBOT_MODE || "adaptative").toLowerCase();
const DEFAULT_THRESHOLD = Number(process.env.ALERT_THRESHOLD_USD || process.env.ALERT_THRESHOLD || 400);

// Rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, "../data/data.json");

/* --------------------------- helpers locales --------------------------- */

function normalizeArray(raw) {
  // Si ya es arreglo en raíz
  if (Array.isArray(raw)) return raw;

  // Si viene como objeto con alguna colección conocida
  const candidates = ["resultados", "results", "items", "data", "registros", "fares", "entries", "list"];
  for (const key of candidates) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }

  // Nada reconocible
  return [];
}

function getSource(rec) {
  // Intenta múltiples campos para identificar fuente
  const s =
    (rec.source ??
      rec.mode ??
      rec.origen_datos ??
      rec.fuente ??
      rec.provider_source ??
      rec.meta?.source ??
      rec.meta?.fuente ??
      "").toString().toLowerCase();

  if (s) return s;
  // Heurística: si el registro proviene de scraping HTML podría marcarse live,
  // si proviene de carga/seed lo tratamos como mock. Sin señal clara, no filtramos.
  return "";
}

function passSourceFilter(s) {
  if (!s) return SOURCE_FILTER === "adaptative"; // sin etiqueta: solo pasa en adaptative
  if (SOURCE_FILTER === "adaptative") return s === "live" || s === "mock";
  return s === SOURCE_FILTER;
}

function getPrice(rec) {
  // Campos posibles
  const p =
    rec.price ??
    rec.precio ??
    rec.precio_total ??
    rec.best_price ??
    rec.mejor_precio ??
    rec.total ??
    rec.cost ??
    rec.costo;

  return Number(p);
}

function getRouteKey(rec) {
  // Varias formas de ruta
  const r =
    rec.route ??
    rec.ruta ??
    rec.routeKey ??
    rec.rutaKey ??
    (rec.origen && rec.destino ? `${rec.origen}-${rec.destino}` : undefined);

  return String(r || "UNK-UNK");
}

function getTimestamp(rec) {
  // Preferimos fecha del hallazgo; si no, salida del vuelo
  return (
    rec.found_at ||
    rec.encontrado_en ||
    rec.fecha_busqueda ||
    rec.fecha ||
    rec.departure_time ||
    rec.salida ||
    rec.meta?.generado ||
    null
  );
}

function getAirline(rec) {
  return rec.airline || rec.aerolinea || rec.carrier || rec.proveedor || rec.provider || "";
}

function getThresholdForRoute(routeKey) {
  // Hook futuro para umbrales por corredor (ej.: LIM-MIA, LIM-FLL, LIM-MCO)
  // Por ahora, usa el default. Si quieres, podemos leer de data/sources.json.
  return DEFAULT_THRESHOLD;
}

/* --------------------------------- main -------------------------------- */

async function main() {
  try {
    log(`🔎 Analizando dataset de tarifas...`);

    // Carga flexible (readJsonSafe ya maneja errores de I/O)
    const raw = await readJsonSafe(DATA_PATH, null);
    if (!raw) {
      log(`⚠️ data.json no existe o es ilegible. Se omite análisis.`);
      return;
    }

    const records = normalizeArray(raw);

    if (!records.length) {
      log(`⚠️ data.json no contiene registros reconocibles (arreglo vacío o formato no soportado).`);
      return;
    }

    // Normalización + filtrado por fuente
    const normalized = records
      .map((rec) => {
        const src = getSource(rec);
        const routeKey = getRouteKey(rec);
        const price = getPrice(rec);
        const when = getTimestamp(rec);
        const airline = getAirline(rec);
        return { ...rec, __src: src, __route: routeKey, __price: price, __ts: when, __airline: airline };
      })
      .filter((r) => passSourceFilter(r.__src))
      .filter((r) => Number.isFinite(r.__price));

    if (!normalized.length) {
      log(`ℹ️ No hay registros que cumplan con SOURCE='${SOURCE_FILTER}'.`);
      return;
    }

    // Evaluación por umbral (por corredor)
    const breaches = [];
    for (const rec of normalized) {
      const th = getThresholdForRoute(rec.__route);
      if (rec.__price <= th) {
        breaches.push({ ...rec, __threshold: th });
      }
    }

    // Resumen
    const total = normalized.length;
    const bySource = normalized.reduce(
      (acc, r) => {
        const k = r.__src || "unlabeled";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      },
      {}
    );

    log(
      `📊 Registros válidos: ${total} | por fuente: ${Object.entries(bySource)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ")}`
    );

    if (!breaches.length) {
      log(`✅ No hay caídas de precio por debajo del umbral (DEFAULT=${DEFAULT_THRESHOLD}).`);
      return;
    }

    // Ordena por precio asc
    breaches.sort((a, b) => a.__price - b.__price);

    log(`🚨 ${breaches.length} ofertas bajo umbral:`);
    for (const b of breaches.slice(0, 25)) {
      const ts = b.__ts ? new Date(b.__ts).toISOString() : "—";
      const line = [
        `• ${b.__route}`,
        b.__airline ? `(${b.__airline})` : "",
        `USD ${b.__price}`,
        `thr ${b.__threshold}`,
        `[${b.__src || "?"}]`,
        ts,
      ]
        .filter(Boolean)
        .join("  ");

      log(line);
    }

    // Aquí podríamos invocar Telegram/Email según configuración,
    // pero mantenemos este script de “detección + log”.
  } catch (err) {
    log(`❌ Error en notify_price_drops.js: ${err.message}`);
    throw err;
  }
}

await main();
