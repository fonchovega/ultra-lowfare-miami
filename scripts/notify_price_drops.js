// ============================================================
// scripts/notify_price_drops.js — diffs de mejores precios y persistencia
// ============================================================

import fs from "fs";
import { writeJsonAtomic, writeJsonIfChanged } from "../helper.js";

const P_DATA    = "./data/data.json";
const P_LAST    = "./data/last_best.json";
const P_LASTRUN = "./docs/_last_run.json";

function readJson(p, fb){
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fb; }
}

function bestByRoute(results){
  const m = new Map();
  for (const r of results || []) {
    const key   = r.route || r.ruta || "";
    const total = r.total_usd ?? r.total ?? r.aereo ?? r.precio_encontrado ?? null;
    if (!key || typeof total !== "number") continue;
    if (!m.has(key) || total < m.get(key).total) m.set(key, { route:key, total, raw:r });
  }
  return Object.fromEntries([...m.entries()].map(([k,v])=>[k,v]));
}

async function main(){
  const snapshot = readJson(P_DATA, null);
  if (!snapshot) { console.log("⚠️ No hay data.json"); return; }

  const bestNow  = bestByRoute(snapshot.resultados || []);
  const lastBest = readJson(P_LAST, {});

  const diffs = [];
  for (const [route, cur] of Object.entries(bestNow)) {
    const prev = lastBest[route];
    if (!prev || (typeof prev.total === "number" && cur.total < prev.total)) {
      diffs.push({ route, cur, prev });
      lastBest[route] = { total: cur.total, at: new Date().toISOString() };
    }
  }

  // Persistencias
  writeJsonAtomic(P_LAST, lastBest); // seguro/atómico
  writeJsonIfChanged(P_LASTRUN, {
    timestamp: new Date().toISOString(),
    mejores: Object.fromEntries(Object.entries(bestNow).map(([k,v]) => [k, v.total]))
  });

  console.log(`✅ Notificaciones (simuladas) preparadas: ${diffs.length}. Persistidos last_best y _last_run.`);
}

await main();
