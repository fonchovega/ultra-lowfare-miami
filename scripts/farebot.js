// scripts/farebot.js
// Bot dual (Tequila + Amadeus). Node 18+.
// Lee parámetros desde config.json y actualiza data.json.
// Requiere: TEQUILA_API_KEY, AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET (secrets).

import fs from 'fs';
import path from 'path';
import process from 'process';

// ---------- Utiles ----------
const nowISO = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const selloCST = () => nowISO() + ' CST';
const todayYMD = () => new Date().toISOString().slice(0,10);
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf-8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2), 'utf-8');

function ddmmyyyy_to_yyyy_mm_dd(s) {
  const [dd, mm, yyyy] = s.split('/').map(x=>x.trim());
  return ${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')};
}
function pushIfUnique(arr, obj) {
  const key = JSON.stringify([obj.fecha, obj.fuente, obj.precio_usd, obj.estado]);
  if (!arr._set) arr._set = new Set();
  if (arr.__set.has(key)) return;
  arr.__set.add(key);
  arr.push(obj);
}

// ---------- Paths ----------
const ROOT = process.cwd();
const CFG_PATH = path.join(ROOT, 'config.json');
const DATA_PATH = path.join(ROOT, 'data.json');

// ---------- Cargar config / data ----------
if (!fs.existsSync(CFG_PATH)) {
  console.error('[ERROR] Falta config.json en la raíz.');
  process.exit(1);
}
const CFG = readJson(CFG_PATH);
const DATA = fs.existsSync(DATA_PATH) ? readJson(DATA_PATH) : {
  meta: {
    titulo: "Dashboard Ultra-Low Fare · Víctor Vega",
    generado: selloCST(),
    zona_horaria: "CST",
    frecuencia_horas: 3,
    rutas: CFG.rutas.map(r=>LIM ⇄ ${r.dst}),
    simulaciones_registradas: 0
  },
  resumen: [],
  contador_diario: { completadas: 0, total: 24, proxima: "—" },
  detalles: {},
  historico: [],
  historico_detallado: {}
};

// Asegurar estructuras por ruta
for (const r of CFG.rutas) {
  const ruta = ${CFG.origen} ⇄ ${r.dst};
  if (!DATA.resumen.find(x=>x.ruta===ruta)) {
    DATA.resumen.push({ ruta, ultima_ejecucion: "—", precio_mas_bajo_usd: null, umbral_usd: r.umbral, resultado: "—" });
  } else {
    DATA.resumen.find(x=>x.ruta===ruta).umbral_usd = r.umbral;
  }
  if (!DATA.detalles[ruta]) DATA.detalles[ruta] = { bloque: 0, hora: "—", simulacion: "—", umbral: r.umbral, resultado_final: "—", evaluaciones: [] };
  if (!DATA.historico_detallado[ruta]) DATA.historico_detallado[ruta] = [];
}

const SELLO = selloCST();

// ---------- Proveedor: Tequila (Kiwi) ----------
const TEQUILA_API_KEY = process.env.TEQUILA_API_KEY || '';
const TEQUILA_URL = 'https://api.tequila.kiwi.com/v2/search';

async function tequilaSearch({ from, to, depart, retFrom, retTo, currency, maxStopovers=1 }) {
  if (!TEQUILA_API_KEY) return null;
  const url = new URL(TEQUILA_URL);
  url.searchParams.set('fly_from', from);
  url.searchParams.set('fly_to', to);
  url.searchParams.set('date_from', depart);
  url.searchParams.set('date_to', depart);
  url.searchParams.set('return_from', retFrom);
  url.searchParams.set('return_to', retTo);
  url.searchParams.set('curr', currency);
  url.searchParams.set('adults', '1');
  url.searchParams.set('max_stopovers', String(maxStopovers));
  url.searchParams.set('limit', '20');
  url.searchParams.set('sort', 'price');

  const res = await fetch(url.toString(), { headers: { apikey: TEQUILA_API_KEY } });
  if (!res.ok) return null;
  const json = await res.json();
  const best = (json.data || [])[0];
  if (!best) return null;

  // Filtrar por segmentos totales (<= 2 por trayecto ⇒ 1 escala max). Tequila ya respeta max_stopovers.
  return {
    source: 'Tequila (Kiwi)',
    currency,
    price: best.price,
    airline: best.route?.[0]?.airline || '',
    routeSummary: best.route?.map(s => ${s.cityFrom||s.flyFrom}→${s.cityTo||s.flyTo}).join(' / ') || ''
  };
}

// ---------- Proveedor: Amadeus ----------
const AMA_ID = process.env.AMADEUS_CLIENT_ID || '';
const AMA_SECRET = process.env.AMADEUS_CLIENT_SECRET || '';
const AMA_ENV = (process.env.AMADEUS_ENV || 'test').toLowerCase(); // 'test' | 'prod'
const AMA_BASE = AMA_ENV === 'prod' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';

async function amadeusToken() {
  if (!AMA_ID || !AMA_SECRET) return null;
  const res = await fetch(${AMA_BASE}/v1/security/oauth2/token, {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AMA_ID,
      client_secret: AMA_SECRET
    })
  });
  if (!res.ok) return null;
  return await res.json(); // { access_token, ... }
}

async function amadeusSearch({ from, to, departYMD, returnYMD, currency, max=20, maxStops=1 }) {
  const tok = await amadeusToken();
  if (!tok?.access_token) return null;

  const url = new URL(${AMA_BASE}/v2/shopping/flight-offers);
  url.searchParams.set('originLocationCode', from);
  url.searchParams.set('destinationLocationCode', to);
  url.searchParams.set('departureDate', departYMD);
  url.searchParams.set('returnDate', returnYMD);
  url.searchParams.set('adults', '1');
  url.searchParams.set('currencyCode', currency);
  url.searchParams.set('max', String(max));

  const res = await fetch(url.toString(), {
    headers: { Authorization: Bearer ${tok.access_token} }
  });
  if (!res.ok) return null;

  const json = await res.json();
  const offers = json.data || [];
  if (!offers.length) return null;

  // Filtrar por escalas (<=1): cada itinerary debe tener segments.length <= 2
  const filtered = offers.filter(o =>
    (o.itineraries||[]).every(it => (it.segments||[]).length <= (maxStops+1))
  );

  const best = (filtered.length ? filtered : offers).sort((a,b)=> (a.price?.grandTotal||1e9) - (b.price?.grandTotal||1e9))[0];
  if (!best) return null;

  // Amadeus price grandTotal es string, conviértelo
  const price = Number(best.price?.grandTotal || '0');

  // Arma resumen de ruta
  const segs = (best.itineraries?.[0]?.segments||[]).concat(best.itineraries?.[1]?.segments||[]);
  const routeSummary = segs.map(s => ${s.departure?.iataCode}→${s.arrival?.iataCode}).join(' / ');
  const airline = segs?.[0]?.carrierCode || '';

  return {
    source: Amadeus (${AMA_ENV}),
    currency,
    price,
    airline,
    routeSummary
  };
}

// ---------- Lógica “Dual Inteligente” ----------
function necesitaConfirmacionAmadeus(price, umbral, reglas) {
  if (!price || !umbral) return false;
  if (reglas.precio_menor_igual_umbral && price <= umbral) return true;
  const margen = (reglas.dentro_porcentaje_umbral ?? 0) / 100;
  return price <= (umbral * (1 + margen));
}

function actualizarHistoricoDiario(data, minsPorRuta) {
  const hoy = todayYMD();
  const row = data.historico.find(x=>x.fecha === hoy);
  if (row) {
    for (const k of Object.keys(minsPorRuta)) {
      const v = minsPorRuta[k];
      if (v != null) row[k] = Math.min(row[k] ?? Infinity, v);
    }
  } else {
    data.historico.push({ fecha: hoy, ...minsPorRuta });
  }
}

// ---------- MAIN ----------
(async () => {
  const departYMD = ddmmyyyy_to_yyyy_mm_dd(CFG.fechas.salida);
  const retFromYMD = ddmmyyyy_to_yyyy_mm_dd(CFG.fechas.retorno_desde);
  const retToYMD   = ddmmyyyy_to_yyyy_mm_dd(CFG.fechas.retorno_hasta);

  DATA.meta.generado = SELLO;
  DATA.meta.rutas = CFG.rutas.map(r=>${CFG.origen} ⇄ ${r.dst});

  const mins = { fll:null, mia:null, mco:null };
  let sims = 0;

  for (const r of CFG.rutas) {
    const ruta = ${CFG.origen} ⇄ ${r.dst};
    const det = DATA.detalles[ruta];
    det.bloque = (det.bloque||0) + 1;
    det.hora = SELLO.split(' ')[1]?.slice(0,5) + ' CST';
    det.simulacion = ${det.bloque}/8;
    det.umbral = r.umbral;

    // 1) Tequila primero (descubrimiento)
    let resT = null;
    try {
      resT = await tequilaSearch({
        from: CFG.origen, to: r.dst,
        depart: CFG.fechas.salida,
        retFrom: CFG.fechas.retorno_desde,
        retTo: CFG.fechas.retorno_hasta,
        currency: CFG.moneda,
        maxStopovers: CFG.maxEscalas
      });
    } catch { /* noop */ }

    // 2) Decidir si confirmamos con Amadeus
    let resA = null;
    if (resT && necesitaConfirmacionAmadeus(resT.price, r.umbral, CFG.proveedores.confirmar_con_amadeus_si)) {
      try {
        // Usamos retorno superior (más estricto) para evitar sesgos
        resA = await amadeusSearch({
          from: CFG.origen, to: r.dst,
          departYMD,
          returnYMD: retToYMD,
          currency: CFG.moneda,
          maxStops: CFG.maxEscalas
        });
      } catch { /* noop */ }
    }

    // 3) Elegir precio final y estado
    const candidatos = [resT, resA].filter(Boolean);
    if (!candidatos.length) {
      det.evaluaciones.unshift({
        tipo: "Búsqueda",
        fuente: "Tequila/Amadeus",
        resultado: "Sin resultados válidos en esta corrida",
        estado: "Informativo"
      });
      continue;
    }
    sims++;

    // Mejor (mínimo) y etiqueta
    const best = candidatos.sort((a,b)=> (a.price||1e9) - (b.price||1e9))[0];
    const estado = best.price <= r.umbral
      ? (resA ? "Confirmado" : "Cumple")
      : (resA ? (Math.abs((resA.price - resT.price) / (resT.price||1)) <= 0.03 ? "Parcial" : "No cumple") : "No cumple");

    // Actualiza resumen
    const row = DATA.resumen.find(x=>x.ruta===ruta);
    row.ultima_ejecucion = SELLO;
    row.precio_mas_bajo_usd = row.precio_mas_bajo_usd == null ? best.price : Math.min(row.precio_mas_bajo_usd, best.price);
    row.resultado = (best.price <= r.umbral) ? "Cumple" : "No cumple";

    // Detalle (guardamos ambas fuentes si existen)
    if (resT) det.evaluaciones.unshift({
      tipo: "Tarifa directa",
      fuente: resT.source,
      resultado: US$ ${resT.price} RT · ≤ ${CFG.maxEscalas} escala(s) · ${resT.airline||''} · ${resT.routeSummary||''},
      estado: resA ? (resT.price <= r.umbral ? "Confirmado" : "Parcial") : (resT.price <= r.umbral ? "Cumple" : "No cumple")
    });
    if (resA) det.evaluaciones.unshift({
      tipo: "Verificación",
      fuente: resA.source,
      resultado: US$ ${resA.price} RT · ≤ ${CFG.maxEscalas} escala(s) · ${resA.airline||''} · ${resA.routeSummary||''},
      estado: (resA.price <= r.umbral) ? "Confirmado" : "No cumple"
    });
    det.resultado_final = estado;

    // Histórico diario (mínimo por ruta)
    const key = r.dst.toLowerCase();
    if (['fll','mia','mco'].includes(key)) {
      mins[key] = (mins[key]==null) ? best.price : Math.min(mins[key], best.price);
    }

    // Histórico detallado
    const arr = DATA.historico_detallado[ruta];
    pushIfUnique(arr, { fecha: SELLO.replace(' CST',''), fuente: resT?.source || resA?.source || 'N/A', precio_usd: best.price, estado });
  }

  // KPIs + histórico diario
  DATA.contador_diario.completadas = (DATA.contador_diario.completadas||0) + sims;
  DATA.meta.simulaciones_registradas = (DATA.meta.simulaciones_registradas||0) + sims;
  actualizarHistoricoDiario(DATA, mins);

  writeJson(DATA_PATH, DATA);
  console.log([OK] data.json actualizado @ ${SELLO} · simulaciones: ${sims});
})().catch(e=>{
  console.error('[ERROR] farebot:', e.message);
  process.exit(1);
});
