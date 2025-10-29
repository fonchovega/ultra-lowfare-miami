// dedupe.js — elimina duplicados en histórico. En v1.3.1 se puede ignorar snapshots con mismo precio.
import fs from "fs";

const HIST_PATH = "./data/historico.json";
const CFG_PATH  = "./config.json";

function read(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

(function main() {
  const cfg = read(CFG_PATH, {});
  const eqPrice = !!cfg?.v131?.dedupe_equal_price;

  let hist = read(HIST_PATH, []);
  if (!Array.isArray(hist) || !hist.length) {
    console.log("ℹ️ No hay histórico para dedupe.");
    process.exit(0);
  }

  const seen = new Set();
  const out = [];
  for (const snap of hist) {
    const k = eqPrice
      ? `${snap?.meta?.rutasKey}|${snap?.mejorPrecio||snap?.resumen?.mejor_precio}`
      : `${snap?.meta?.generado}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(snap);
  }

  fs.writeFileSync(HIST_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`✅ Dedupe listo: ${out.length} registros únicos.`);
})();
