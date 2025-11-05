// scripts/helpers/normalize_historico_v133.js
// Normalizador canónico para historico.json — v1.3.3 (revisado)
// DEVUELVE: Array<{ meta:{generado:string}, resultados:Array<{ruta,fecha,precio_encontrado,limite?,cumple?,fuente?,detalles?}> }>

export function normalizeHistoricoEntryV133(entry) {
  // ────────────────────────────────────────────────────────────────────────────
  // Utilidades
  // ────────────────────────────────────────────────────────────────────────────
  const nowIso = new Date().toISOString();

  const coerceIso = (v) => {
    if (!v) return nowIso;
    // Acepta "2025-10-18 00:00 CST", "2025-10-23T11:05:12.416Z", etc.
    // Si no es parseable, retorna nowIso para no romper la auditoría.
    const tryDate = Date.parse(
      String(v)
        .replace(/\sCST$/i, " -06:00")
        .replace(/\sUTC$/i, " +00:00")
    );
    return Number.isFinite(tryDate) ? new Date(tryDate).toISOString() : nowIso;
  };

  const trim = (s) => (typeof s === "string" ? s.trim() : s);

  const ensureRuta = (raw) => {
    if (!raw) return null;
    let s = String(raw).replace(/\s+/g, " ").trim();

    // Uniformizar separadores: "⇄", "→", "->", "a", etc.
    // Salen formatos como: "LIM ⇄ FLL", " LIM → MCO", "LIM -> MIA"
    s = s
      .replace(/\s*↔\s*/g, " ⇄ ")
      .replace(/\s*<->\s*/g, " ⇄ ")
      .replace(/\s*->\s*/g, " → ")
      .replace(/\s*→\s*/g, " → ")
      .replace(/\s*-\s*>\s*/g, " → ");

    // Limpieza de espacios sobrantes
    s = s.replace(/\s{2,}/g, " ").trim();

    // Si aún no tiene separador reconocible pero vienen origen/destino por separado,
    // lo dejamos pasar y que lo construya el llamador.
    return s;
  };

  const makeResult = ({
    ruta,
    fecha,
    precio,
    limite,
    cumple,
    fuente,
    detalles,
  }) => {
    const canonical = {
      ruta: trim(ruta) || null,
      fecha: coerceIso(fecha),
      precio_encontrado: Number.isFinite(Number(precio))
        ? Number(precio)
        : null,
    };
    if (limite !== undefined) canonical.limite = Number(limite);
    if (cumple !== undefined && cumple !== null)
      canonical.cumple = String(cumple);
    if (fuente) canonical.fuente = String(fuente);
    if (detalles && typeof detalles === "object") canonical.detalles = detalles;
    return canonical;
  };

  const makeBlock = (generadoIso, resultados) => ({
    meta: { generado: coerceIso(generadoIso) },
    resultados,
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Detectores de forma
  // ────────────────────────────────────────────────────────────────────────────

  // Forma D (canonical): { meta:{generado}, resultados:[ {ruta, fecha, precio_encontrado, ...} ] }
  const isCanonical =
    entry &&
    typeof entry === "object" &&
    entry.meta &&
    (entry.resultados && Array.isArray(entry.resultados)) &&
    entry.resultados.every((r) => "ruta" in r && "precio_encontrado" in r);

  if (isCanonical) {
    // Normalizamos fechas vacías si las hubiera
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

  // Forma A (index 20): meta {..., zona_horaria, ...}, resumen:[{ruta, ultima_ejecucion, precio_mas_bajo_usd, umbral_usd, resultado}], detalles:{...}
  const shapeA =
    entry &&
    entry.meta &&
    Array.isArray(entry.resumen) &&
    entry.resumen.every(
      (x) =>
        typeof x === "object" &&
        "ruta" in x &&
        ("precio_mas_bajo_usd" in x || "precio" in x) &&
        ("umbral_usd" in x || "umbral" in x)
    );

  if (shapeA) {
    const generado = entry.meta?.generado ?? nowIso;
    const resultados = entry.resumen.map((r) =>
      makeResult({
        ruta: ensureRuta(r.ruta),
        fecha: r.ultima_ejecucion || generado,
        precio:
          r.precio_mas_bajo_usd ??
          r.precio ??
          r.minimo ??
          r.min_price ??
          null,
        limite: r.umbral_usd ?? r.umbral ?? null,
        cumple:
          r.resultado ??
          (Number(r.precio_mas_bajo_usd ?? r.precio) <=
          Number(r.umbral_usd ?? r.umbral)
            ? "Cumple"
            : "No cumple"),
        fuente: "dashboard-resumen",
      })
    );
    return [makeBlock(generado, resultados)];
  }

  // Forma B (index 23–29): meta:{generado}, resumen:[{ruta, salida, retorno, umbral, precio, cumple}]
  const shapeB =
    entry &&
    entry.meta &&
    Array.isArray(entry.resumen) &&
    entry.resumen.every(
      (x) =>
        typeof x === "object" &&
        "ruta" in x &&
        "precio" in x &&
        ("umbral" in x || "umbral_usd" in x)
    );

  if (shapeB) {
    const generado = entry.meta?.generado ?? nowIso;
    const resultados = entry.resumen.map((r) =>
      makeResult({
        ruta: ensureRuta(r.ruta),
        fecha: generado, // usamos timestamp de generación como referencia de snapshot
        precio: r.precio,
        limite: r.umbral ?? r.umbral_usd ?? null,
        cumple: r.cumple,
        fuente: "resumen-con-fechas",
        detalles: {
          salida: r.salida || null,
          retorno: r.retorno || null,
        },
      })
    );
    return [makeBlock(generado, resultados)];
  }

  // Forma C (index 30): meta:{generado, origen, moneda}, resumen:[{fecha, destino, precio, ...}]
  const shapeC =
    entry &&
    entry.meta &&
    Array.isArray(entry.resumen) &&
    entry.meta.origen &&
    entry.resumen.every(
      (x) =>
        typeof x === "object" &&
        "destino" in x &&
        ("precio" in x || "precio_usd" in x)
    );

  if (shapeC) {
    const generado = entry.meta?.generado ?? nowIso;
    const origen = String(entry.meta.origen).trim();
    const resultados = entry.resumen.map((r) =>
      makeResult({
        ruta: ensureRuta(`${origen} → ${r.destino}`),
        fecha: r.fecha || generado,
        precio: r.precio ?? r.precio_usd ?? null,
        limite: null, // no viene umbral en esta forma
        cumple: null, // desconocido
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

  // Forma E (index 37): array de bloques [{meta:{generado}, resultados:[...]}]
  if (Array.isArray(entry)) {
    const blocks = [];
    for (const b of entry) {
      if (
        b &&
        b.meta &&
        Array.isArray(b.resultados) &&
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

  // Si nada calza, devolvemos vacío para que el auditor lo marque como unknown.
  return [];
}
