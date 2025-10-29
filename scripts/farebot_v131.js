// farebot_v131.js — motor v1.3.1 (selección dinámica + logging + histórico)
import fs from "fs";
import { selectProviders } from "./selector_proveedores.js";
import { logRun } from "./run_logger.js";

const CFG_PATH = "./config.json";
const DATA_PATH = "./data.json";
const HIST_PATH = "./data/historico.json";

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; } }
function ensureDirOf(filePath) {
  const path = filePath.split("/").slice(0, -1).join("/");
  if (path) fs.mkdirSync(path, { recursive: true });
}

function bestPriceMock() {
  // Simulación: en tu stack real aquí van los scrapers/consultas; conservamos mock estable.
  // (Se respeta 1 stop máx y carry-on como filtros en proveedores/itinerarios cuando existan scrapers reales.)
  // Para no romper flujos, devolvemos un valor aproximado.
  return 389 + Math.floor(Math.random()*21) - 10; // 379..399
}

(async function main() {
  const cfg = readJson(CFG_PATH, {});
  const project = cfg.projects?.[0]; // mantenemos Project A por ahora
  if (!project) {
    console.error("❌ No hay proyecto configurado en config.json");
    process.exit(1);
  }

  const routes = [];
  for (const to of project.destinations) {
    routes.push({
      from: project.origins[0],
      to,
      dep: project.depart,
      ret: project.return[0],
      adt: project.pax?.adults ?? 1,
      budget: project.budget?.[to] ?? null
    });
    if (project.return[1]) {
      routes.push({
        from: project.origins[0],
        to,
        dep: project.depart,
        ret: project.return[1],
        adt: project.pax?.adults ?? 1,
        budget: project.budget?.[to] ?? null
      });
    }
  }

  const results = [];
  for (const r of routes) {
    const sel = await selectProviders({ route: r });
    const price = bestPriceMock();
    results.push({
      route: `${r.from}-${r.to}`,
      dep: r.dep,
      ret: r.ret,
      pax: r.adt,
      constraints: { carry_on_required: !!cfg.carry_on_required, max_stops: cfg.max_stops ?? 1 },
      providers: {
        meta: sel.chosenMeta.map(m => ({ id: m.id, name: m.name, link: m.link, score: m.score })),
        airlines: sel.chosenAir.map(a => ({ id: a.id, name: a.name, link: a.link, score: a.score }))
      },
      best_offer: {
        total_usd: price,
        under_budget: r.budget ? price <= r.budget : null
      }
    });
  }

  const snapshot = {
    meta: {
      generado: new Date().toISOString(),
      proyecto: project.id,
      rutasKey: `A:${project.origins[0]}|${project.destinations.join(",")}`,
      v: "1.3.1"
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

  // Actualizar histórico (append si no existe ese generado)
  const hist = readJson(HIST_PATH, []);
  const exists = hist.some(h => h?.meta?.generado === snapshot.meta.generado);
  if (!exists) {
    ensureDirOf(HIST_PATH);
    hist.push(snapshot);
    fs.writeFileSync(HIST_PATH, JSON.stringify(hist, null, 2), "utf8");
    console.log(`✅ Histórico actualizado (${hist.length} snapshots)`);
  }

  // Log técnico de corrida
  logRun({
    project: project.id,
    carriers_meta: results[0]?.providers?.meta?.map(m => m.id) || [],
    carriers_air:  results[0]?.providers?.airlines?.map(a => a.id) || [],
    constraints: { carry_on_required: !!cfg.carry_on_required, max_stops: cfg.max_stops ?? 1 },
    v: "1.3.1"
  });

  console.log("🎯 FareBot v1.3.1 finalizado.");
})();
