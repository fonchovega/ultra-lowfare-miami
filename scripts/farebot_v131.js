// ============================================================
// farebot_v131.js — motor v1.3.1 (selección dinámica + logging + histórico)
// Modo LIVE adaptativo: aprende proveedores nuevos desde HTML
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
// 🔧 Control de modo de operación (mock o live)
// ------------------------------------------------------------
const SOURCE_MODE = "live"; // cambia a "mock" si deseas simular

// ------------------------------------------------------------
// Utils locales
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
  // Simulación estable 379..399
  return 389 + Math.floor(Math.random() * 21) - 10;
}

(async function main() {
  const cfg = readJson(CFG_PATH, {});
  const project = cfg.projects?.[0]; // seguimos usando el primer proyecto
  if (!project) {
    console.error("❌ No hay proyecto configurado en config.json");
    process.exit(1);
  }

  // Construcción de rutas (mantiene el origen principal actual)
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
  for (const r of routes) {
    const sel = await selectProviders({ route: r });

    // ------------------------------------------------------------
    // 🔧 LIVE adaptativo: elige meta/aerolínea y aprende proveedores nuevos
    // ------------------------------------------------------------
    let price;
    let priceProvider = "mock";
    let deepLink = null;

    if (SOURCE_MODE === "mock") {
      price = bestPriceMock();
    } else {
      // Prioridad: primer metabuscador seleccionado; si no, primera aerolínea
      const providerIdSeed =
        sel?.chosenMeta?.[0]?.id ||
        sel?.chosenAir?.[0]?.id ||
        "SampleMeta"; // fallback defensivo (debes tenerlo definido en html_providers.json)

      console.log(`🌍 LIVE HTML: consultando ${providerIdSeed} para ${r.from}-${r.to}`);

      const live = await fetchLiveHTML({
        providerId: providerIdSeed,
        route: r,
        opts: { timeoutMs: 25000 }
      });

      // Aprendizaje: si el card revela nombre de aerolínea, registrarla dinámicamente
      if (live.providerDetected) {
        const detectedId = normalizeProviderId(live.providerDetected);
        // Heurística simple: providerDetected suele ser aerolínea en el card de resultados
        const isAirline = true;
        const destKeyForRegistry = ["MIA", "FLL", "PBI"].includes(r.to) ? "MIA_AREA" : r.to;

        try {
          const reg = registerProviderIfMissing({
            kind: isAirline ? "aerolineas" : "metabuscadores",
            destKey: destKeyForRegistry,
            displayName: live.providerDetected,
            link: ""
          });
          if (reg.updated) {
            console.log(`🧭 Nuevo proveedor agregado dinámicamente: ${reg.id} → ${reg.destKey}`);
          }
        } catch (e) {
          console.warn(`ℹ️ No se pudo registrar proveedor dinámico (${live.providerDetected}): ${e.message}`);
        }
      }

      if (live.price != null) {
        price = live.price;
        priceProvider = live.provider;
        deepLink = live.urlUsed || null;
      } else {
        console.warn("⚠️ Live HTML sin precio. Fallback a mock.");
        price = bestPriceMock();
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
        link: deepLink
      }
    });
  }

  const snapshot = {
    meta: {
      generado: new Date().toISOString(),
      proyecto: project.id,
      rutasKey: `A:${project.origins[0]}|${project.destinations.join(",")}`,
      v: "1.3.1",
      live: SOURCE_MODE === "live"
    },
    resumen: {
      mejor_precio: Math.min(...results.map(x => x.best_offer.total_usd)),
      cumple_umbral: results.some(x => x.best_offer.under_budget === true),
      iteraciones: results.length
    },
    resultados: results
  };

  // Escribir data.json
  fs.writeFileSync(DATA_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`✅ data.json actualizado`);

  // Actualizar histórico
  const hist = readJson(HIST_PATH, []);
  const exists = hist.some(h => h?.meta?.generado === snapshot.meta.generado);
  if (!exists) {
    ensureDirOf(HIST_PATH);
    hist.push(snapshot);
    fs.writeFileSync(HIST_PATH, JSON.stringify(hist, null, 2), "utf8");
    console.log(`✅ Histórico actualizado (${hist.length} snapshots)`);
  }

  // Log técnico
  logRun({
    project: project.id,
    carriers_meta: results[0]?.providers?.meta?.map(m => m.id) || [],
    carriers_air:  results[0]?.providers?.airlines?.map(a => a.id) || [],
    constraints: { carry_on_required: !!cfg.carry_on_required, max_stops: cfg.max_stops ?? 1 },
    v: "1.3.1",
    live: SOURCE_MODE === "live"
  });

  console.log("🎯 FareBot v1.3.1 finalizado.");
})();
