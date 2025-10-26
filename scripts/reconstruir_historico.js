// Reconstruye data/historico.json a partir de:
// - data/logs/*/.json  (corridas por fecha/hora)
// - data/data.json        (si existe, últimos resultados)
// - data/historico.json   (lo ya guardado)
// Aplica deduplicación y orden cronológico descendente.

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const { readJSONSafe, writeJSONAtomic, ensureDir } = require("./utils/fs-helpers");
const { dedupeKeepLatest } = require("./utils/dedupe");

const ROOT = process.cwd();
const HIST_FILE = path.join(ROOT, "data", "historico.json");
const LOGS_GLOB = path.join(ROOT, "data", "logs", "*", ".json");
const DATA_JSON = path.join(ROOT, "data", "data.json");

function toISO(x) {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d) ? null : d.toISOString();
}

function normalizeRecord(r) {
  // Adaptador para distintos formatos de salida de farebot/metabuscadores
  const total = r.totalFare ?? r.price ?? r.amount ?? null;
  const route =
    r.route ||
    (r.from && r.to ? ´${r.from}⇄${r.to}´ : r.origin && r.destination ? ´${r.origin}⇄${r.destination}´: "");
  const foundAt = toISO(r.foundAt || r.detectedAt || r.createdAt || r.timestamp || Date.now());

  return {
    route: route || "",
    origin: r.origin || r.from || "",
    destination: r.destination || r.to || "",
    departDate: r.departDate || r.depart || r.outboundDate || "",
    returnDate: r.returnDate || r.return || r.inboundDate || "",
    carryOnOnly: r.carryOnOnly ?? r.baggage === "carry-on" ?? true,
    baggage: r.baggage || (r.carryOnOnly ? "carry-on" : "unknown"),
    stopsMax: r.stopsMax ?? r.maxStops ?? r.stops ?? 1,
    stops: r.stops ?? r.legs?.length ? (r.legs.length - 1) : undefined,
    airline: r.airline || r.carrier || "",
    metaEngine: r.metaEngine || r.engine || r.meta || "",
    source: r.source || r.vendor || "",
    itinerary: r.itinerary || r.legs?.map(l => ´${l.from}-${l.to}´).join(">") || "",
    totalFare: total ? Number(total) : null,
    currency: r.currency || "USD",
    meetsThreshold: r.meetsThreshold ?? r.qualifies ?? false,
    link: r.link || r.deepLink || r.url || "",
    foundAt
  };
}

function collectFromLogs() {
  const files = glob.sync(LOGS_GLOB, { nodir: true });
  const out = [];
  for (const f of files) {
    const arr = readJSONSafe(f, []);
    if (Array.isArray(arr)) {
      for (const r of arr) out.push(normalizeRecord(r));
    } else if (arr && typeof arr === "object") {
      out.push(normalizeRecord(arr));
    }
  }
  return out;
}

function collectFromDataJson() {
  const x = readJSONSafe(DATA_JSON, null);
  if (!x) return [];
  if (Array.isArray(x)) return x.map(normalizeRecord);
  if (x.results && Array.isArray(x.results)) return x.results.map(normalizeRecord);
  return [normalizeRecord(x)];
}

function main() {
  ensureDir(path.join(ROOT, "data"));

  const prev = readJSONSafe(HIST_FILE, []);         // histórico actual (si existe)
  const fromLogs = collectFromLogs();               // logs por corrida
  const fromData = collectFromDataJson();           // respaldo desde data.json

  // Unir todo
  let merged = [...prev, ...fromLogs, ...fromData]
    .filter(x => x && x.route && x.departDate && x.returnDate && x.totalFare != null);

  // Deduplicar conservando el más reciente
  merged = dedupeKeepLatest(merged);

  // Ordenar por fecha hallazgo desc (más reciente primero)
  merged.sort((a, b) => new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime());

  // Persistir
  writeJSONAtomic(HIST_FILE, merged);

  console.log(´Reconstrucción completa: ${merged.length} registros en data/historico.json´);
}

main();
