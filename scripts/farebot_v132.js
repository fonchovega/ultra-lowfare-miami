// scripts/farebot.js
// ============================================================
// FareBot core engine (v1.3.2 aligned)
// - Modo: LIVE / MOCK (FAREBOT_MODE)
// - Lee/actualiza: data/data.json, data/historico.json
// - Dedupe por (route, provider, hour-bucket)
// - Logs y timestamps via helpers
// ============================================================

import path from "path";
import {
  ROOT,
  DATA_DIR,
  ensureDir,
  readJson,
  writeJson,
  nowIsoUtc,
  log,
} from "./helpers/helper.js";
import { fetchLivePrices } from "./fetch_live_html.js"; // se usa en modo live si está disponible

// ------------------------------------------------------------
// Configuración
// ------------------------------------------------------------
const VERSION = process.env.FAREBOT_VERSION || "1.3.2";
const MODE = (process.env.FAREBOT_MODE || "live").toLowerCase(); // "live" | "mock" | "adaptative"

// Rutas de datasets
const DATA_PATH = path.join(DATA_DIR, "data.json");
const HIST_PATH = path.join(DATA_DIR, "historico.json");

// ------------------------------------------------------------
// Utilidades internas
// ------------------------------------------------------------
function seededNumber(seedStr, min, max) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const frac = (h >>> 0) / 2 ** 32;
  return Math.round(min + frac * (max - min));
}

async function fetchMockPrices(route) {
  const ts = new Date();
  const hour = ts.getUTCHours();
  const baseMin = route.includes("MCO") ? 240 : route.includes("FLL") ? 210 : 230;
  const baseMax = route.includes("MIA") ? 860 : route.includes("FLL") ? 780 : 820;
  const osc = Math.floor(((hour * 23) % 37) - 18);
  const seed = `${route}|${ts.toISOString().slice(0, 13)}`;

  const bestPrice = Math.max(180, Math.min(950, seededNumber(seed, baseMin, baseMax) + osc));
  const providerPool = ["Skyscanner-mock","Kayak-mock","Avianca-mock","LATAM-mock","Copa-mock","Spirit-mock"];
  const provider = providerPool[seededNumber(seed + ":p", 0, providerPool.length - 1)];

  return {
    bestPrice,
    provider,
    legs: [
      {
        date: ts.toISOString().slice(0, 10),
        depart: "08:35",
        arrive: "15:05",
        from: route.slice(0, 3),
        to: route.slice(4, 7),
        stops: [0, 1, 2][seededNumber(seed + ":s", 0, 2)],
        fareBrand: ["Basic", "Light", "Standard"][seededNumber(seed + ":b", 0, 2)],
        baggagePolicyHint: "Carry-on incluido; maleta facturada con costo adicional",
      },
    ],
  };
}

async function fetchPrices(route) {
  if (MODE === "mock") return fetchMockPrices(route);
  // "live" o "adaptative": por ahora, live directo.
  return fetchLivePrices(route);
}

function dedupeByKey(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, it);
  }
  return Array.from(map.values());
}

function parseRutasFromDataMeta(currentData) {
  // Preferimos meta.rutasKey estilo "A:LIM|MIA,FLL,MCO"
  const key = currentData?.meta?.rutasKey;
  if (key && key.includes("|")) {
    const [tag, rest] = key.split("|");
    const orig = tag.includes(":") ? tag.split(":")[1] : "LIM";
    const dests = rest.split(",").map(s => s.trim()).filter(Boolean);
    return dests.map(d => `${orig}-${d}`);
  }
  // Fallback: si resultados ya existen, extraer rutas
  const fallback = (currentData?.resultados || [])
    .map(r => r.route || r.ruta)
    .filter(Boolean);
  if (fallback.length) return Array.from(new Set(fallback));
  // Último recurso: trío LIM-MIA/FLL/MCO
  return ["LIM-MIA", "LIM-FLL", "LIM-MCO"];
}

// ------------------------------------------------------------
// Motor principal
// ------------------------------------------------------------
export async function main() {
  log(`🚀 FareBot core start v${VERSION} [mode=${MODE}] @ ${nowIsoUtc()}`);

  ensureDir(DATA_DIR);

  // Cargar dataset actual (si no existe, arrancamos uno base)
  let current = readJson(DATA_PATH, null);
  if (!current) {
    current = {
      meta: {
        generado: nowIsoUtc(),
        proyecto: "A",
        rutasKey: "A:LIM|MIA,FLL,MCO",
        v: VERSION,
        mode: MODE,
      },
      resumen: {
        mejor_precio: null,
        cumple_umbral: false,
        iteraciones: 0,
      },
      resultados: [],
    };
  }

  const rutas = parseRutasFromDataMeta(current);
  if (!rutas.length) {
    log("⚠️ No hay rutas para procesar. Abortando.");
    return;
  }

  const resultados = [];
  for (const ruta of rutas) {
    try {
      log(`✈️  Buscando → ${ruta} ...`);
      const res = await fetchPrices(ruta);
      resultados.push({
        route: ruta,
        bestPrice: res.bestPrice,
        provider: res.provider,
        legs: res.legs || [],
        fuente: MODE,
        timestamp: nowIsoUtc(),
      });
      log(`   ✅ ${ruta} — ${res.provider} → $${res.bestPrice}`);
    } catch (err) {
      log(`   ❌ Error en ${ruta}: ${err?.message || err}`);
    }
  }

  // Dedupe por (route|provider|hour-bucket)
  const compact = dedupeByKey(
    resultados,
    r => `${r.route}|${r.provider}|${r.timestamp.slice(0, 13)}`
  );

  const mejorPrecio = compact.length ? Math.min(...compact.map(r => r.bestPrice)) : null;
  const umbral = current?.resumen?.umbral ?? 400;

  const nuevoData = {
    meta: {
      generado: nowIsoUtc(),
      proyecto: current?.meta?.proyecto || "A",
      rutasKey: current?.meta?.rutasKey || "A:LIM|MIA,FLL,MCO",
      v: VERSION,
      mode: MODE,
    },
    resumen: {
      mejor_precio: mejorPrecio,
      cumple_umbral: Number.isFinite(mejorPrecio) ? mejorPrecio <= umbral : false,
      iteraciones: (current?.resumen?.iteraciones || 0) + 1,
      umbral,
    },
    resultados: compact,
  };

  writeJson(DATA_PATH, nuevoData);
  log("💾 data.json actualizado.");

  // Actualizar histórico (array con tope)
  let historico = readJson(HIST_PATH, []);
  if (!Array.isArray(historico)) historico = [];
  historico.push({
    meta: { generado: nuevoData.meta.generado },
    resumen: {
      ruta: nuevoData.meta.rutasKey,
      fecha: nuevoData.meta.generado,
      mejor_precio: nuevoData.resumen.mejor_precio,
      fuente: MODE,
      cumple: nuevoData.resumen.cumple_umbral ? "✅ Cumple" : "❌ No cumple",
    },
  });
  const MAX_RECORDS = 600;
  if (historico.length > MAX_RECORDS) {
    historico = historico.slice(-MAX_RECORDS);
    log(`✂️  Histórico recortado a las últimas ${MAX_RECORDS} ejecuciones.`);
  }
  writeJson(HIST_PATH, historico);
  log("📚 historico.json actualizado.");

  log("🏁 FareBot core finalizado.");
}

// Auto-ejecución si es invocado directamente por Node (entry clásico)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    log(`💥 Error crítico FareBot core: ${err?.stack || err}`);
    process.exit(1);
  });
}
