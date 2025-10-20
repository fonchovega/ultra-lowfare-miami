// scripts/farebot.js  (ESM, sin dependencias externas)
import fs from "fs";

// ------- Carga de archivos -------
const CFG = JSON.parse(fs.readFileSync("./config.json","utf8"));
const DATA_PATH = "./data.json";
const DATA = JSON.parse(fs.readFileSync(DATA_PATH,"utf8"));

// ------- Tablas de apoyo (equipaje y deeplinks) -------
const EQUIPAJE = {
  "Avianca": { XS:{carryOn:false}, S:{carryOn:true}, M:{carryOn:true}, L:{carryOn:true} },
  "LATAM":   { Basic:{carryOn:false}, Light:{carryOn:true}, Plus:{carryOn:true}, Top:{carryOn:true} },
  "Copa Airlines": { Promo:{carryOn:true}, Classic:{carryOn:true}, Full:{carryOn:true} },
  "American Airlines": { Basic:{carryOn:true}, Main:{carryOn:true} },
  "JetBlue": { BlueBasic:{carryOn:false}, Blue:{carryOn:true}, BluePlus:{carryOn:true} },
  "Spirit": { Standard:{carryOn:false}, Bundle:{carryOn:true} },
  "United": { Basic:{carryOn:false}, Econ:{carryOn:true}, Flex:{carryOn:true} },
  "Delta":  { Basic:{carryOn:true}, Main:{carryOn:true} }
};

// --- CARRIERS: deeplinks a aerolíneas (con backticks correctos)
const CARRIERS = {
  CM: { // Copa
    name: "Copa Airlines",
    build: (dst, d1, d2) =>
      https://book.copaair.com/booking/entry?tripType=roundtrip&origin=LIM&destination=${dst}&departureDate=${d1}&returnDate=${d2}&adults=1&cabin=economy
  },
  AV: { // Avianca
    name: "Avianca",
    build: (dst, d1, d2) =>
      https://www.avianca.com/en/?from=LIM&to=${dst}&departureDate=${d1}&returnDate=${d2}&adults=1&cabins=economy
  },
  LA: { // LATAM
    name: "LATAM",
    build: (dst, d1, d2) =>
      https://www.latamairlines.com/pe/es/oferta-vuelos?origin=LIM&destination=${dst}&outbound=${d1}&inbound=${d2}&adt=1&cabin=economy
  },
  AA: { // American
    name: "American Airlines",
    build: (dst, d1, d2) =>
      https://www.aa.com/booking/flights/choose-flights?tripType=roundTrip&origin=LIM&destination=${dst}&departDate=${d1}&returnDate=${d2}&cabin=coach&passengerCount=1
  },
  B6: { // JetBlue
    name: "JetBlue",
    build: (dst, d1, d2) =>
      https://www.jetblue.com/booking/flights?from=LIM&to=${dst}&depart=${d1}&return=${d2}&type=rt&adult=1
  },
  NK: { // Spirit
    name: "Spirit",
    build: (dst, d1, d2) =>
      https://booking.spirit.com/Flight-Search?trip=roundtrip&origin=LIM&destination=${dst}&departing=${d1}&returning=${d2}&ADT=1&cabin=Economy
  },
  UA: { // United
    name: "United",
    build: (dst, d1, d2) =>
      https://www.united.com/en-us/flights/results?f=LIM&t=${dst}&d=${d1}&r=${d2}&sc=7,7&px=1&taxng=1
  },
  DL: { // Delta
    name: "Delta",
    build: (dst, d1, d2) =>
      https://www.delta.com/flight-search/search?tripType=RT&fromCity=LIM&toCity=${dst}&departureDate=${d1}&returnDate=${d2}&passengers=1&cabinClass=MAIN
  }
};

// --- META: deeplinks a metabuscadores (con backticks correctos)
const META = {
  kayak: (dst, d1, d2) =>
    https://www.kayak.com/flights/LIM-${dst}/${d1}/${d2}?sort=bestflight_a&stops=~1,
  skyscanner: (dst, d1, d2) =>
    https://www.skyscanner.com/transport/flights/lim/${dst.toLowerCase()}/${d1.replaceAll('-','').slice(2)}/${d2.replaceAll('-','').slice(2)}/?adults=1&stops=1&cabinclass=economy,
  expedia: (dst, d1, d2) =>
    https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from:LIM,to:${dst},departure:${d1.replaceAll('-','/')}TANYT&leg2=from:${dst},to:LIM,departure:${d2.replaceAll('-','/')}TANYT&passengers=adults:1&options=cabinclass:economy&stops=1
};

const carrierCodeFromOperador = (txt='')=>{
  const t = txt.toLowerCase();
  if(t.includes('avianca')) return 'AV';
  if(t.includes('copa')) return 'CM';
  if(t.includes('latam')) return 'LA';
  if(t.includes('american')) return 'AA';
  if(t.includes('jetblue')) return 'B6';
  if(t.includes('spirit')) return 'NK';
  if(t.includes('united')) return 'UA';
  if(t.includes('delta')) return 'DL';
  return '';
};
const buildDeeplink = ({carrierCode, dst, d1, d2})=>{
  if (carrierCode && CARRIERS[carrierCode]) return CARRIERS[carrierCode].build(dst,d1,d2);
  const pref = (CFG.providers_prefer && CFG.providers_prefer[0]) || 'kayak';
  return (META[pref]||META.kayak)(dst,d1,d2);
};
const incluyeCarry = (aerolinea, tarifa)=>{
  if(!aerolinea || !tarifa) return false;
  return !!EQUIPAJE[aerolinea]?.[tarifa]?.carryOn;
};

// ------- Helpers de rutas/fechas -------
const findRouteCfg = (label)=> CFG.routes.find(r=>r.label===label);
const departOf = (label)=> findRouteCfg(label)?.depart || CFG.routes[0].depart;
const returnOf = (label)=> (findRouteCfg(label)?.return?.[0]) || CFG.routes[0].return[0];
const dstOf = (label)=> findRouteCfg(label)?.dst || 'MIA';

// ------- Marca de tiempo -------
const now = new Date();
const nowPE = new Date(now.toLocaleString('en-US',{timeZone:'America/Lima'}));
const stampCST = now.toLocaleString('es-PE',{hour12:false});
const hhmm = now.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false});

// Meta/KPIs
DATA.meta = { ...(DATA.meta||{}), generado: ${stampCST}, fuente: "Bot sin APIs (preserva metas/aerolíneas)" };
DATA.contador_diario = {
  completadas: Math.min((DATA.contador_diario?.completadas||0)+1, CFG.auto_runs_per_day),
  total: CFG.auto_runs_per_day,
  proxima: ""  // opcional
};

// ------- Procesa DETALLES (no borra nada) -------
Object.keys(DATA.detalles||{}).forEach(label=>{
  const det = DATA.detalles[label];
  det.hora = hhmm;
  det.umbral = findRouteCfg(label)?.umbral ?? det.umbral;
  const d1 = departOf(label);
  const d2 = returnOf(label);
  const dst = dstOf(label);

  (det.evaluaciones||[]).forEach(e=>{
    // Detecta carrier y tarifa si existe
    const carrierCode = carrierCodeFromOperador(e.operador||'');
    const mTarifa = /Tarifa:\s*([A-Za-z0-9+]+)/.exec(e.resultado||'');
    const tarifa = mTarifa ? mTarifa[1] : '';

    // Completa URL si falta (prioriza aerolínea si la conocemos)
    if(!e.url || !e.url.trim()){
      e.url = buildDeeplink({carrierCode, dst, d1, d2});
    }

    // Promueve a Confirmado si cumple carry-on
    const aerolinea = carrierCode ? CARRIERS[carrierCode].name : (e.operador||'');
    if (/cumple/i.test(e.estado) && !/confirmado/i.test(e.estado) && CFG.carry_on_required) {
      if (incluyeCarry(aerolinea, tarifa)) e.estado = "Confirmado";
    }
  });

  // Resultado final = el mejor estado entre las evaluaciones
  const hasConfirmado = det.evaluaciones?.some(x=>/confirmado/i.test(x.estado));
  const hasCumple = det.evaluaciones?.some(x=>/cumple/i.test(x.estado));
  det.resultado_final = hasConfirmado ? "Confirmado" : hasCumple ? "Cumple" : "No cumple";
});

// ------- Recalcula RESUMEN (precio mínimo y best_url por ruta) -------
(DATA.resumen||[]).forEach(row=>{
  const det = DATA.detalles?.[row.ruta];
  if(!det) return;
  // precio mínimo que aparezca en "resultado" como US$ NNN
  let min = null, bestUrl = "";
  (det.evaluaciones||[]).forEach(e=>{
    const m = /US\$\s*([0-9]+(?:\.[0-9]+)?)/.exec(e.resultado||'');
    if(m){
      const p = parseFloat(m[1]);
      if (min===null || p<min) min = p;
    }
    if(!bestUrl && /(Confirmado|Cumple)/i.test(e.estado) && e.url) bestUrl = e.url;
  });
  if(min!=null) row.precio_mas_bajo_usd = min;
  row.ultima_ejecucion = ${stampCST}.slice(0,16);
  if(bestUrl) row.best_url = bestUrl;

  // Resultado en resumen: sincroniza con detalle
  const detRes = DATA.detalles?.[row.ruta]?.resultado_final || row.resultado;
  row.resultado = detRes;
});

// ------- Histórico (serie diaria: mínimo por ruta) -------
const ymd = nowPE.toISOString().slice(0,10);
const entry = { fecha: ymd };
const toKey = (label)=> label.includes("FLL")?"fll":label.includes("MIA")?"mia":"mco";
(DATA.resumen||[]).forEach(r=>{
  const k = toKey(r.ruta);
  entry[k] = r.precio_mas_bajo_usd ?? null;
});
let hist = DATA.historico || [];
const last = hist[hist.length-1];
if(!last || last.fecha !== ymd){ hist.push(entry); } else { hist[hist.length-1] = {...last, ...entry}; }
DATA.historico = hist;

// ------- Histórico detallado (aplanado por cada evaluación que tenga precio) -------
DATA.historico_detallado = DATA.historico_detallado || {};
Object.keys(DATA.detalles||{}).forEach(label=>{
  const det = DATA.detalles[label];
  const arr = DATA.historico_detallado[label] || [];
  (det.evaluaciones||[]).forEach(e=>{
    const m = /US\$\s*([0-9]+(?:\.[0-9]+)?)/.exec(e.resultado||'');
    if(!m) return;
    arr.push({
      fecha: ${ymd} ${hhmm},
      fuente: e.fuente || e.tipo || "",
      precio_usd: parseFloat(m[1]),
      estado: e.estado
    });
  });
  // Limita tamaño (p. ej. últimos 800 para no crecer infinito)
  DATA.historico_detallado[label] = arr.slice(-800);
});

// ------- Guarda -------
fs.writeFileSync(DATA_PATH, JSON.stringify(DATA, null, 2));
console.log("✅ FareBot: data.json actualizado sin perder metas/aerolíneas/deeplinks.");
