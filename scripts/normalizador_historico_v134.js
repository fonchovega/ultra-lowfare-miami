/**
 * normalizador_historico_v134.js
 * v1.3.4 — Genera data/historico_normalizado.json
 */

import fs from "fs";
import path from "path";

const BASE = path.resolve("data");
const SRC_FILE = path.join(BASE, "historico.json");
const OUT_FILE = path.join(BASE, "historico_normalizado.json");

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("❌ No se pudo leer:", file, e.message);
    return [];
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  console.log("💾 Archivo generado:", file);
}

function normalizar() {
  console.log("🔄 Normalizando histórico...");
  const historico = loadJSON(SRC_FILE);

  if (!Array.isArray(historico) || historico.length === 0) {
    console.log("⚠️ histórico.json vacío o inválido.");
    saveJSON(OUT_FILE, []);
    return;
  }

  const normalizado = historico.map((r) => {
    return {
      ruta: r.ruta || "",
      fecha: r.fecha || "",
      precio: r.precio_encontrado || null,
      limite: r.limite || null,
      cumple: r.cumple || "",
      fuente: r.fuente || "",
      detalles: r.detalles || {},
    };
  });

  saveJSON(OUT_FILE, normalizado);
  console.log("✅ Normalización completada. Registros:", normalizado.length);
}

normalizar();
