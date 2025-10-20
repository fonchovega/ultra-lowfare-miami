// scripts/farebot.js
import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('./config.json','utf8'));
const DATA_PATH = './data.json';

/* === Tabla equipaje por aerolínea y tarifa (simplificada) === */
const EQUIPAJE = {
  'Avianca': { XS:{carryOn:false,checked:false}, S:{carryOn:true,checked:false}, M:{carryOn:true,checked:true}, L:{carryOn:true,checked:true} },
  'LATAM':   { Basic:{carryOn:false,checked:false}, Light:{carryOn:true,checked:false}, Plus:{carryOn:true,checked:true}, Top:{carryOn:true,checked:true} },
  'Copa Airlines': { Promo:{carryOn:true,checked:false}, Classic:{carryOn:true,checked:true}, Full:{carryOn:true,checked:true} },
  'American Airlines': { Basic:{carryOn:true,checked:false}, Main:{carryOn:true,checked:true} },
  'JetBlue': { BlueBasic:{carryOn:false,checked:false}, Blue:{carryOn:true,checked:false}, BluePlus:{carryOn:true,checked:true} },
  'Spirit': { Standard:{carryOn:false,checked:false}, Bundle:{carryOn:true,checked:true} },
  'United': { Basic:{carryOn:false,checked:false}, Econ:{carryOn:true,checked:false}, Flex:{carryOn:true,checked:true} },
  'Delta':  { Basic:{carryOn:true,checked:false}, Main:{carryOn:true,checked:true} }
};

/* === Mapeo de carriers para deeplink directo === */
const CARRIERS = {
  CM: { name: 'Copa Airlines', build:(dst,d1,d2)=>https://book.copaair.com/booking/flights?tripType=roundtrip&origin=LIM&destination=${dst}&departureDate=${d1}&returnDate=${d2}&adt=1&cabin=economy },
  AV: { name: 'Avianca', build:(dst,d1,d2)=>https://www.avianca.com/en/?from=LIM&to=${dst}&departureDate=${d1}&returnDate=${d2}&adults=1&cabins=economy },
  LA: { name: 'LATAM', build:(dst,d1,d2)=>https://www.latamairlines.com/pe/es/oferta-vuelos?origin=LIM&destination=${dst}&outbound=${d1}&inbound=${d2}&adt=1&cabin=economy },
  AA: { name: 'American Airlines', build:(dst,d1,d2)=>https://www.aa.com/booking/flights/choose-flights?tripType=roundTrip&origin=LIM&destination=${dst}&departDate=${d1}&returnDate=${d2}&cabin=coach&passengerCount=1 },
  B6: { name: 'JetBlue', build:(dst,d1,d2)=>https://www.jetblue.com/booking/flights?from=LIM&to=${dst}&depart=${d1}&return=${d2}&type=rt&adult=1 },
  NK: { name: 'Spirit', build:(dst,d1,d2)=>https://booking.spirit.com/Flight-Search?trip=roundtrip&origin=LIM&destination=${dst}&departing=${d1}&returning=${d2}&ADT=1&cabin=Economy },
  UA: { name: 'United', build:(dst,d1,d2)=>https://www.united.com/en-us/flights/results?f=LIM&t=${dst}&d=${d1}&r=${d2}&sc=7,7&px=1&taxng=1 },
  DL: { name: 'Delta', build:(dst,d1,d2)=>https://www.delta.com/flight-search/search?tripType=RT&fromCity=LIM&toCity=${dst}&departureDate=${d1}&returnDate=${d2}&passengers=1&cabinClass=MAIN }
};
function buildMetaLink(dst, d1, d2){
  return {
    kayak:https://www.kayak.com/flights/LIM-${dst}/${d1}/${d2}?sort=bestflight_a&stops=~1,
    skyscanner:https://www.skyscanner.com/transport/flights/lim/${dst.toLowerCase()}/${d1.replaceAll('-','').slice(2)}/${d2.replaceAll('-','').slice(2)}/?adults=1&stops=1&cabinclass=economy,
    expedia:https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from:LIM,to:${dst},departure:${d1.replaceAll('-','/')}TANYT&leg2=from:${dst},to:LIM,departure:${d2.replaceAll('-','/')}TANYT&passengers=adults:1&options=cabinclass:economy&stops=1
  };
}
function buildDeeplinkByCarrierOrMeta({ carrierCode, dst, d1, d2, preferMeta='kayak' }){
  if (carrierCode && CARRIERS[carrierCode]) {
    return { url: CARRIERS[carrierCode].build(dst, d1, d2), operador: CARRIERS[carrierCode].name };
  }
  const meta = buildMetaLink(dst,d1,d2);
  const key = meta[preferMeta] ? preferMeta : 'kayak';
  return { url: meta[key], operador: 'Múltiples (metabuscador)' };
}
function incluyeCarryOn(aerolinea, tarifa){
  if(!aerolinea || !tarifa) return false;
  const i = EQUIPAJE[aerolinea]?.[tarifa];
  return !!(i && i.carryOn);
}

/* === Utilidades de datos === */
function readData(){
  if(!fs.existsSync(DATA_PATH)) return null;
  return JSON.parse(fs.readFileSync(DATA_PATH,'utf8'));
}
function writeData(obj){
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2));
}

/* === Simulador “sin APIs” para correr y actualizar data.json ===
   - Aquí NO buscamos en vivo. Tomamos el fichero actual, ajustamos timestamps,
     y aplicamos reglas (equipaje/umbral) y deeplinks.
   - Cuando quieras APIs, cambiamos este bloque.
*/
function simulateRun(){
  const now = new Date();
  const hh = now.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false});
  const gen = now.toLocaleString('es-PE',{hour12:false});

  const cfg = CONFIG;
  const data = readData() || {
    meta:{}, contador_diario:{completadas:0,total:cfg.auto_runs_per_day,proxima:""},
    resumen:[], detalles:{}, historico:[], historico_detallado:{}
  };

  data.meta.generado = gen;

  // Actualiza “última ejecución” conservando precios simulados
  (data.resumen||[]).forEach(r=>{
    r.ultima_ejecucion = gen.slice(0,16);
    // Si cumple, asegúrate que haya best_url
    if((r.resultado||'').toLowerCase().includes('cumple') && !r.best_url){
      const routeKey = r.ruta;
      const d = data.detalles?.[routeKey];
      const ok = d?.evaluaciones?.find(x=>/(Confirmado|Cumple)/.test(x.estado) && x.url);
      if(ok) r.best_url = ok.url;
    }
  });

  // Ajusta detalle: añade íconos lógicos + “Confirmado” si carry-on cumple
  Object.keys(data.detalles||{}).forEach(routeKey=>{
    const det = data.detalles[routeKey];
    det.hora = hh;
    det.resultado_final = det.resultado_final || 'Informativo';
    (det.evaluaciones||[]).forEach(e=>{
      // Deducir carrierCode simple desde operador
      let carrierCode = '';
      if(/avianca/i.test(e.operador)) carrierCode='AV';
      else if(/copa/i.test(e.operador)) carrierCode='CM';
      else if(/latam/i.test(e.operador)) carrierCode='LA';
      else if(/american/i.test(e.operador)) carrierCode='AA';
      else if(/jetblue/i.test(e.operador)) carrierCode='B6';
      else if(/spirit/i.test(e.operador)) carrierCode='NK';

      // Detectar tarifa por texto (si existe)
      let tarifa = '';
      const m = /Tarifa:\s*([A-Za-z0-9+]+)/.exec(e.resultado||'');
      if(m) tarifa = m[1];

      // Promover a Confirmado si corresponde
      if(/cumple/i.test(e.estado) && !/confirmado/i.test(e.estado)){
        const opName = carrierCode && CARRIERS[carrierCode]?.name || e.operador || '';
        if(CONFIG.carry_on_required && incluyeCarryOn(opName, tarifa)){
          e.estado = 'Confirmado';
        }
      }

      // Completar deeplink si falta
      if(!e.url){
        const ruta = /LIM ⇄ (\w{3})/.test(routeKey) ? RegExp.$1 : '';
        const d1 = findRouteDepart(routeKey) || CONFIG.routes[0].depart;
        const d2 = findAnyReturnForRoute(routeKey) || CONFIG.routes[0].return[0];
        const { url } = buildDeeplinkByCarrierOrMeta({ carrierCode, dst:ruta, d1, d2, preferMeta:CONFIG.providers_prefer?.[0]||'kayak' });
        e.url = url;
      }
    });
  });

  // KPIs demo
  data.contador_diario.completadas = Math.min((data.contador_diario.completadas||0)+1, cfg.auto_runs_per_day);
  data.contador_diario.total = cfg.auto_runs_per_day;
  data.contador_diario.proxima = ''; // (si usas Actions, el schedule ya está definido)

  writeData(data);
}

function findRouteDepart(routeKey){
  const label = routeKey.trim();
  const r = CONFIG.routes.find(x=>x.label===label);
  return r?.depart || null;
}
function findAnyReturnForRoute(routeKey){
  const label = routeKey.trim();
  const r = CONFIG.routes.find(x=>x.label===label);
  return (r?.return?.[0]) || null;
}

/* === Main === */
simulateRun();
console.log('Simulación terminada (sin APIs). data.json actualizado.');
