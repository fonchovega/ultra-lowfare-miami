// scripts/helpers/normalize_historico_v133.js
// Normalizador canónico para historico.json — v1.3.3 (revisado+F+G)
// Salida canónica:
//   Array<{
//     meta: { generado: string },
//     resultados: Array<{
//       ruta: string,
//       fecha: string,                 // ISO
//       precio_encontrado: number|null,
//       limite?: number|null,
//       cumple?: string|null,
//       fuente?: string|null,
//       detalles?: object
//     }>
//   }>

export function normalizeHistoricoEntryV133(entry) {
  const nowIso = new Date().toISOString();

  const coerceIso = (v) => {
    if (!v) return nowIso;
    const s = String(v)
      .replace(/\sCST$/i, " -06:00")
      .replace(/\sUTC$/i, " +00:00");
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t).toISOString() : nowIso;
  };

  const trim = (s) => (typeof s === "string" ? s.trim() : s);

  const ensureRuta = (raw) => {
    if (!raw) return null;
    let s = String(raw).replace(/\s+/g, " ").trim();
    s = s
      .replace(/\s*↔\s*/g, " ⇄ ")
      .replace(/\s*<->\s*/g, " ⇄ ")
      .replace(/\s*-\s*>\s*/g, " → ")
      .replace(/\s*->\s*/g, " → ")
      .replace(/\s*→\s*/g, " → ");
    return s.replace(/\s{2,}/g, " ").trim();
  };

  const makeResult = ({ ruta, fecha, precio, limite, cumple, fuente, detalles }) => {
    const out = {
      ruta: trim(ruta) || null,
      fecha: coerceIso(fecha),
      precio_encontrado: Number.isFinite(Number(precio)) ? Number(precio) : null,
    };
    if (limite !== undefined) out.limite = (limite === null ? null : Number(limite));
    if (cumple !== undefined) out.cumple = (cumple === null ? null : String(cumple));
    if (fuente) out.fuente = String(fuente);
    if (detalles && typeof detalles === "object") out.detalles = detalles;
    return out;
  };

  const makeBlock = (generadoIso, resultados) => ({
    meta: { generado: coerceIso(generadoIso) },
    resultados,
  });

  // ─────────────────────────── Formas soportadas ───────────────────────────

  // D) Canónica: { meta, resultados:[{ruta,fecha,precio_encontrado,...}] }
  const isCanonical =
    entry && typeof entry === "object" &&
    entry.meta && Array.isArray(entry.resultados) &&
    entry.resultados.every((r) => "ruta" in r && "precio_encontrado" in r);

  if (isCanonical) {
    const generado = entry.meta?.generado ?? nowIso;
    const resultados = entry.resultados.map((r) =>
      makeResult({
        ruta: ensureRuta(r.ruta),
        fecha: r.fecha || generado,
        precio: r.precio_encontrado,
        limite: r.limite,
        cumple: r.cumple,
        fuente: r.fuente,
        detalles: r.detalles,
      })
    );
    return [makeBlock(generado, resultados)];
  }

  // A) Dashboard-resumen (index 20)
  const shapeA =
    entry && entry.meta && Array.isArray(entry.resumen) &&
    entry.resumen.every((x) =>
      x && "ruta" in x && ("precio_mas_bajo_usd" in x || "precio" in x) &&
      ("umbral_usd" in x || "umbral" in x)
    );

  if (shapeA) {
    const generado = entry.meta?.generado ?? nowIso;
    const resultados = entry.resumen.map((r) =>
      makeResult({
        ruta: ensureRuta(r.ruta),
        fecha: r.ultima_ejecucion || generado,
        precio: r.precio_mas_bajo_usd ?? r.precio ?? r.minimo ?? r.min_price ?? null,
        limite: r.umbral_usd ?? r.umbral ?? null,
        cumple:
          r.resultado ??
          (Number(r.precio_mas_bajo_usd ?? r.precio) <= Number(r.umbral_usd ?? r.umbral)
            ? "Cumple"
            : "No cumple"),
        fuente: "dashboard-resumen",
      })
    );
    return [makeBlock(generado, resultados)];
  }

  // B) Resumen con salida/retorno (index 23–29)
  const shapeB =
    entry && entry.meta && Array.isArray(entry.resumen) &&
    entry.resumen.every((x) => x && "ruta" in x && "precio" in x && ("umbral" in x || "umbral_usd" in x));

  if (shapeB) {
    const generado = entry.meta?.generado ?? nowIso;
    const resultados = entry.resumen.map((r) =>
      makeResult({
        ruta: ensureRuta(r.ruta),
        fecha: generado,
        precio: r.precio,
        limite: r.umbral ?? r.umbral_usd ?? null,
        cumple: r.cumple ?? null,
        fuente: "resumen-con-fechas",
        detalles: { salida: r.salida || null, retorno: r.retorno || null },
      })
    );
    return [makeBlock(generado, resultados)];
  }

  // C) Tabla de ofertas por origen/destino (index 30)
  const shapeC =
    entry && entry.meta && entry.meta.origen &&
    Array.isArray(entry.resumen) &&
    entry.resumen.every((x) => x && "destino" in x && ("precio" in x || "precio_usd" in x));

  if (shapeC) {
    const generado = entry.meta?.generado ?? nowIso;
    const origen = String(entry.meta.origen).trim();
    const resultados = entry.resumen.map((r) =>
      makeResult({
        ruta: ensureRuta(`${origen} → ${r.destino}`),
        fecha: r.fecha || generado,
        precio: r.precio ?? r.precio_usd ?? null,
        limite: null,
        cumple: null,
        fuente: "tabla-ofertas",
        detalles: {
          aerolinea: r.aerolinea || null,
          escala: r.escala ?? null,
          equipaje: r.equipaje || null,
          duracion: r.duracion_vuelo || null,
          moneda: entry.meta.moneda || "USD",
        },
      })
    );
    return [makeBlock(generado, resultados)];
  }

  // E) Array de bloques canónicos (index 37)
  if (Array.isArray(entry)) {
    const blocks = [];
    for (const b of entry) {
      if (
        b && b.meta && Array.isArray(b.resultados) &&
        b.resultados.every((r) => "ruta" in r && "precio_encontrado" in r)
      ) {
        const generado = b.meta?.generado ?? nowIso;
        const resultados = b.resultados.map((r) =>
          makeResult({
            ruta: ensureRuta(r.ruta),
            fecha: r.fecha || generado,
            precio: r.precio_encontrado,
            limite: r.limite,
            cumple: r.cumple,
            fuente: r.fuente,
            detalles: r.detalles,
          })
        );
        blocks.push(makeBlock(generado, resultados));
      }
    }
    if (blocks.length) return blocks;
  }

  // F) “historico” diario por destino (grid fll/mia/mco)
  const shapeF = entry && Array.isArray(entry.historico);
  if (shapeF) {
    // Intentamos deducir origen (si existiera en el propio objeto o asumimos LIM)
    const origen = entry.meta?.origen || "LIM";
    const generado = entry.meta?.generado || nowIso;

    const mapKeyToDest = (k) => {
      const m = String(k).toLowerCase().trim();
      if (m === "fll") return "FLL";
      if (m === "mia") return "MIA";
      if (m === "mco") return "MCO";
      return m.toUpperCase();
    };

    const resultados = [];
    for (const row of entry.historico) {
      if (!row || typeof row !== "object") continue;
      const fecha = row.fecha || generado;
      for (const [k, v] of Object.entries(row)) {
        if (k === "fecha") continue;
        if (!Number.isFinite(Number(v))) continue;
        const dest = mapKeyToDest(k);
        resultados.push(
          makeResult({
            ruta: ensureRuta(`${origen} → ${dest}`),
            fecha,
            precio: Number(v),
            limite: null,
            cumple: null,
            fuente: "historico-grid",
          })
        );
      }
    }
    if (resultados.length) return [makeBlock(generado, resultados)];
  }

  // G) “historico_detallado” por ruta (listas con precio_usd/estado)
  const shapeG =
    entry && entry.historico_detallado && typeof entry.historico_detallado === "object";

  if (shapeG) {
    const generado = entry.meta?.generado || nowIso;
    const resultados = [];
    for (const [rutaKey, lista] of Object.entries(entry.historico_detallado)) {
      if (!Array.isArray(lista)) continue;
      for (const it of lista) {
        if (!it) continue;
        const precio =
          it.precio_usd ?? it.precio ?? it.precio_encontrado ?? null;
        if (precio === null) continue;
        resultados.push(
          makeResult({
            ruta: ensureRuta(rutaKey),
            fecha: it.fecha || generado,
            precio,
            limite: it.umbral ?? it.limite ?? null,
            cumple: it.estado ?? it.cumple ?? null,
            fuente: it.fuente || "historico-detallado",
            detalles: {
              tipo: it.tipo || null,
              url: it.url || null,
              nota: it.resultado || null,
            },
          })
        );
      }
    }
    if (resultados.length) return [makeBlock(generado, resultados)];
  }

  // Sin coincidencia: marcar como unknown
  return [];
}
