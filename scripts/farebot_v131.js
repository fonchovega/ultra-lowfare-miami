// ============================================================
// farebot_v131.js — motor v1.3.1 (selección dinámica + logging + histórico)
// Versión extendida (LIVE adaptativo + validaciones + resumen + robustez)
// ============================================================

import fs from "fs";
import { selectProviders } from "./selector_proveedores.js";
import { logRun } from "./run_logger.js";
import fetchLiveHTML from "./fetch_live_html.js";
import { registerProviderIfMissing, normalizeProviderId } from "./provider_registry.js";

const CFG_PATH  = "./config.json";
const DATA_PATH = "./data.json";
const HIST_PATH = "./data/historico.json";

// ------------------------------------------------------------
// 🔧 Control de modo de operación
// ------------------------------------------------------------
const SOURCE_MODE = "live"; // Cambia a "mock" si deseas simular

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fb; }
}
function ensureDirOf(filePath) {
  const path = filePath.split("/").slice(0, -1).join("/");
  if (path) fs.mkdirSync(path, { recursive: true });
}
function bestPriceMock() {
  return 389 + Math.floor(Math.random() * 21) - 10; // 379–399
}
function hashKey(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64").slice(0, 24);
}
function assertConfig(cfg){
  if(!cfg?.projects?.[0]) throw new Error("config.projects[0] requerido");
  const p = cfg.projects[0];
  if(!Array.isArray(p.origins) || !p.origins.length) throw new Error("projects[0].origins vacío");
  if(!Array.isArray(p.destinations) || !p.destinations.length) throw new Error("projects[0].destinations vacío");
  if(!p.depart || !p.return?.length) throw new Error("Fechas depart/return requeridas");
}

// ------------------------------------------------------------
// 🧭 Proceso principal
// ------------------------------------------------------------
(async function main() {
  const cfg = readJson(CFG_PATH, {});
  try { assertConfig(cfg); } catch(e){ console.error("❌ Config inválida:", e.message); process.exit(1); }

  const project = cfg.projects[0];
  const routes = [];

  for (const to of project.destinations) {
    routes.push({
      from: project.origins[0],
      to,
      dep: project.depart,
      ret: project.return?.[0],
      adt: project.pax?.adults ?? 1,
      budget: project.budget?.[to] ?? null
    });
    if (project.return?.[1]) {
      routes.push({
        from: project.origins[0],
        to,
        dep: project.depart,
        ret: project.return?.[1],
        adt: project.pax?.adults ?? 1,
        budget: project.budget?.[to] ?? null
      });
    }
  }

  const results = [];
  let failCount = 0;

  for (const r of routes) {
    console.log(`🧭 Analizando ${r.from}-${r.to}...`);
    const sel = await selectProviders({ route: r });
    console.log("🧭 Providers:", {
      meta: sel.chosenMeta.map(m=>m.id).slice(0,5),
      air : sel.chosenAir.map(a=>a.id).slice(0,8)
    });

    // ------------------------------------------------------------
    // LIVE adaptativo
    // ------------------------------------------------------------
    let price;
    let priceProvider = "mock";
    let deepLink = null;
    let sourceMethod = "mock";

    if (SOURCE_MODE === "mock") {
      price = bestPriceMock();
    } else {
      const providerIdSeed =
        sel?.chosenMeta?.[0]?.id ||
        sel?.chosenAir?.[0]?.id ||
        "SampleMeta";

      console.log(`🌍 LIVE HTML: consultando ${providerIdSeed} para ${r.from}-${r.to}`);

      const live = await fetchLiveHTML({
        providerId: providerIdSeed,
        route: r,
        opts: { timeoutMs: 25000 }
      });

      // Registro adaptativo de proveedores nuevos
      if (live.providerDetected) {
        const detectedId = normalizeProviderId(live.providerDetected);
        const isAirline = true;
        const destKeyForRegistry = ["MIA", "FLL", "PBI"].includes(r.to) ? "MIA_AREA" : r.to;
        try {
          const reg = registerProviderIfMissing({
            kind: isAirline ? "aerolineas" : "metabuscadores",
            destKey: destKeyForRegistry,
            displayName: live.providerDetected,
            link: "",
            tag: "learned"
          });
          if (reg.updated) {
            console.log(`🧭 Nuevo proveedor agregado dinámicamente: ${reg.id} → ${reg.destKey}`);
          }
        } catch (e) {
          console.warn(`ℹ️ No se pudo registrar proveedor (${live.providerDetected}): ${e.message}`);
        }
      }

      if (live.price != null) {
        price = live.price;
        priceProvider = live.provider;
        deepLink = live.urlUsed || null;
        sourceMethod = live.source_method || "html";
      } else {
        failCount++;
        console.warn(`⚠️ Live HTML sin precio (${failCount}). Fallback a mock.`);
        price = bestPriceMock();
        sourceMethod = "fallback-mock";
      }
    }

    results.push({
      route: `${r.from}-${r.to}`,
      dep: r.dep,
      ret: r.ret,
      pax: r.adt,
      constraints: {
        carry_on_required: !!cfg.carry_on_required,
        max_stops: cfg.max_stops ?? 1
      },
      providers: {
        meta: (sel.chosenMeta || []).map(m => ({
          id: m.id, name: m.name, link: m.link, score: m.score
        })),
        airlines: (sel.chosenAir || []).map(a => ({
          id: a.id, name: a.name, link: a.link, score: a.score
        }))
      },
      best_offer: {
        total_usd: price,
        under_budget: r.budget ? price <= r.budget : null,
        provider: priceProvider,
        link: deepLink,
        source_method: sourceMethod
      }
    });
  }

  const snapshotKey = hashKey({
    id: project.id,
    origins: project.origins,
    destinations: project.destinations,
    depart: project.depart,
    ret: project.return
  });

  const snapshot = {
    meta: {
      generado: new Date().toISOString(),
      proyecto: project.id,
      key: snapshotKey,
      rutasKey: `A:${project.origins[0]}|${project.destinations.join(",")}`,
      v: "1.3.1",
      live: SOURCE_MODE === "live",
      currency_base: "USD"
    },
    resumen: {
      mejor_precio: Math.min(...results.map(x => x.best_offer.total_usd)),
      cumple_umbral: results.some(x => x.best_offer.under_budget === true),
      iteraciones: results.length,
      fallos_live: failCount
    },
    resultados: results
  };

  // ------------------------------------------------------------
  // Escritura de resultados
  // ------------------------------------------------------------
  ensureDirOf(DATA_PATH);
  fs.writeFileSync(DATA_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`✅ data.json actualizado`);

  // Histórico (con dedupe por key)
  const hist = readJson(HIST_PATH, []);
  const exists = hist.some(h => h?.meta?.key === snapshot.meta.key);
  if (!exists) {
    ensureDirOf(HIST_PATH);
    hist.push(snapshot);
    fs.writeFileSync(HIST_PATH, JSON.stringify(hist, null, 2), "utf8");
    console.log(`✅ Histórico actualizado (${hist.length} snapshots)`);
  } else {
    console.log("ℹ️ Snapshot duplicado detectado, no agregado.");
  }

  // ------------------------------------------------------------
  // Log técnico + resumen compacto
  // ------------------------------------------------------------
  logRun({
    project: project.id,
    carriers_meta: results[0]?.providers?.meta?.map(m => m.id) || [],
    carriers_air:  results[0]?.providers?.airlines?.map(a => a.id) || [],
    constraints: { carry_on_required: !!cfg.carry_on_required, max_stops: cfg.max_stops ?? 1 },
    v: "1.3.1",
    live: SOURCE_MODE === "live"
  });

  // Quick summary file
  ensureDirOf("outputs/summary.txt");
  fs.writeFileSync(
    "outputs/summary.txt",
    results.map(r => `${r.route}: $${r.best_offer.total_usd} via ${r.best_offer.provider}`).join("\n"),
    "utf8"
  );

  console.log("🎯 FareBot v1.3.1 (adaptativo) finalizado.");
})();
