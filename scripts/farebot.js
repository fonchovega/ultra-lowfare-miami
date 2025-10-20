/**
 * FareBot – Monitor automático de tarifas ultra-low fare
 * Autor: Víctor Vega · Octubre 2025
 */

import fs from "fs";
import axios from "axios";

// --- Rutas y archivos
const CONFIG_PATH = "./config.json";
const DATA_PATH = "./data.json";
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const DATA = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

// --- Tablas de apoyo (equipaje y deeplinks)
const EQUIPAJE = {
  "Avianca": { XS: {carryOn:false}, M: {carryOn:true} },
  "LATAM": { Basic:{carryOn:false}, Light:{carryOn:true} },
  "Copa Airlines": { Promo:{carryOn:false}, Classic:{carryOn:true}, Full:{carryOn:true} },
  "American Airlines": { Basic:{carryOn:false}, Main:{carryOn:true} },
  "JetBlue": { BlueBasic:{carryOn:false}, Blue:{carryOn:true} },
  "Spirit": { Standard:{carryOn:false}, BoostIt:{carryOn:true} },
  "United": { Basic:{carryOn:false}, Econ:{carryOn:true}, Flex:{carryOn:true} },
  "Delta": { Basic:{carryOn:false}, Main:{carryOn:true} }
};

// --- Enlaces directos a aerolíneas
const CARRIERS = {
  CM: {
    name: "Copa Airlines",
    build: (dst, d1, d2) =>
      https://book.copaair.com/booking/entry?tripType=roundtrip&origin=LIM&destination=${dst}&departureDate=${d1}&returnDate=${d2}&adults=1&cabin=economy
  },
  AV: {
    name: "Avianca",
    build: (dst, d1, d2) =>
      https://www.avianca.com/en/?from=LIM&to=${dst}&departureDate=${d1}&returnDate=${d2}&adults=1&cabins=economy
  },
  LA: {
    name: "LATAM",
    build: (dst, d1, d2) =>
      https://www.latamairlines.com/pe/es/oferta-vuelos?origin=LIM&destination=${dst}&outbound=${d1}&inbound=${d2}&adt=1&cabin=economy
  },
  AA: {
    name: "American Airlines",
    build: (dst, d1, d2) =>
      https://www.aa.com/booking/flights/choose-flights?tripType=roundTrip&origin=LIM&destination=${dst}&departDate=${d1}&returnDate=${d2}&cabin=coach&passengerCount=1
  },
  B6: {
    name: "JetBlue",
    build: (dst, d1, d2) =>
      https://www.jetblue.com/booking/flights?from=LIM&to=${dst}&depart=${d1}&return=${d2}&type=rt&adult=1
  },
  NK: {
    name: "Spirit",
    build: (dst, d1, d2) =>
      https://booking.spirit.com/Flight-Search?trip=roundtrip&origin=LIM&destination=${dst}&departing=${d1}&returning=${d2}&ADT=1&cabin=Economy
  },
  UA: {
    name: "United",
    build: (dst, d1, d2) =>
      https://www.united.com/en-us/flights/results?f=LIM&t=${dst}&d=${d1}&r=${d2}&sc=7,7&px=1&taxng=1
  },
  DL: {
    name: "Delta",
    build: (dst, d1, d2) =>
      https://www.delta.com/flight-search/search?tripType=RT&fromCity=LIM&toCity=${dst}&departureDate=${d1}&returnDate=${d2}&passengers=1&cabinClass=MAIN
  }
};

// --- Enlaces a metabuscadores
const META = {
  kayak: (dst, d1, d2) =>
    https://www.kayak.com/flights/LIM-${dst}/${d1}/${d2}?sort=bestflight_a&stops=~1,
  skyscanner: (dst, d1, d2) =>
    https://www.skyscanner.com/transport/flights/lim/${dst.toLowerCase()}/${d1.replaceAll('-','').slice(2)}/${d2.replaceAll('-','').slice(2)}/?adults=1&stops=1&cabinclass=economy,
  expedia: (dst, d1, d2) =>
    https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from:LIM,to:${dst},departure:${d1.replaceAll('-','/')}TANYT&leg2=from:${dst},to:LIM,departure:${d2.replaceAll('-','/')}TANYT&passengers=adults:1&options=cabinclass:economy&stops=1
};

// --- Simulación (solo placeholder)
async function runSim() {
  console.log("▶ Ejecutando simulación de búsqueda...");
  const results = CONFIG.routes.map(r => ({
    ruta: ${r.label},
    salida: r.depart,
    retorno: r.return[0],
    umbral: r.umbral,
    precio: Math.floor(350 + Math.random() * 100),
    cumple: Math.random() > 0.6 ? "Cumple" : "No cumple"
  }));

  const resumen = results.map(r => ({
    ruta: r.ruta,
    precio_mas_bajo_usd: r.precio,
    umbral_usd: r.umbral,
    resultado: r.cumple
  }));

  const salida = {
    meta: { generado: new Date().toISOString() },
    resumen
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(salida, null, 2), "utf8");
  console.log("✅ data.json actualizado correctamente.");
}

runSim().catch(err => console.error("❌ Error:", err));
