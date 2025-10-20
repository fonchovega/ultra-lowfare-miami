// FareBot - versión estable sin errores de sintaxis
import fs from "fs";
import axios from "axios";

const CONFIG_PATH = "./config.json";
const DATA_PATH = "./data.json";
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const DATA = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const EQUIPAJE = {
  Avianca: { XS: { carryOn: false }, M: { carryOn: true } },
  LATAM: { Basic: { carryOn: false }, Light: { carryOn: true } },
  "Copa Airlines": {
    Promo: { carryOn: false },
    Classic: { carryOn: true },
    Full: { carryOn: true },
  },
  "American Airlines": { Basic: { carryOn: false }, Main: { carryOn: true } },
  JetBlue: { BlueBasic: { carryOn: false }, Blue: { carryOn: true } },
  Spirit: { Standard: { carryOn: false }, BoostIt: { carryOn: true } },
  United: {
    Basic: { carryOn: false },
    Econ: { carryOn: true },
    Flex: { carryOn: true },
  },
  Delta: { Basic: { carryOn: false }, Main: { carryOn: true } },
};

const CARRIERS = {
  CM: {
    name: "Copa Airlines",
    build: function (dst, d1, d2) {
      return "https://book.copaair.com/booking/entry?tripType=roundtrip&origin=LIM&destination=" +
        dst + "&departureDate=" + d1 + "&returnDate=" + d2 + "&adults=1&cabin=economy";
    },
  },
  AV: {
    name: "Avianca",
    build: function (dst, d1, d2) {
      return "https://www.avianca.com/en/?from=LIM&to=" + dst +
        "&departureDate=" + d1 + "&returnDate=" + d2 + "&adults=1&cabins=economy";
    },
  },
  LA: {
    name: "LATAM",
    build: function (dst, d1, d2) {
      return "https://www.latamairlines.com/pe/es/oferta-vuelos?origin=LIM&destination=" + dst +
        "&outbound=" + d1 + "&inbound=" + d2 + "&adt=1&cabin=economy";
    },
  },
};

const META = {
  kayak: function (dst, d1, d2) {
    return "https://www.kayak.com/flights/LIM-" + dst + "/" + d1 + "/" + d2 + "?sort=bestflight_a&stops=~1";
  },
  skyscanner: function (dst, d1, d2) {
    return "https://www.skyscanner.com/transport/flights/lim/" + dst.toLowerCase() + "/" +
      d1.replaceAll("-", "").slice(2) + "/" + d2.replaceAll("-", "").slice(2) +
      "/?adults=1&stops=1&cabinclass=economy";
  },
  expedia: function (dst, d1, d2) {
    return "https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from:LIM,to:" + dst +
      ",departure:" + d1.replaceAll("-", "/") + "TANYT&leg2=from:" + dst + ",to:LIM,departure:" +
      d2.replaceAll("-", "/") + "TANYT&passengers=adults:1&options=cabinclass:economy&stops=1";
  },
};

async function runSim() {
  console.log("▶ Ejecutando simulación...");
  const results = CONFIG.routes.map(r => ({
    ruta: r.label,
    salida: r.depart,
    retorno: r.return[0],
    umbral: r.umbral,
    precio: Math.floor(350 + Math.random() * 100),
    cumple: Math.random() > 0.6 ? "Cumple" : "No cumple",
  }));

  const salida = {
    meta: { generado: new Date().toISOString() },
    resumen: results,
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(salida, null, 2), "utf8");
  console.log("✅ data.json actualizado correctamente.");
}

runSim().catch(err => console.error("❌ Error:", err));
