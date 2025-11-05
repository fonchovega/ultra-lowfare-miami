// scripts/helpers/normalize_historico_v133.js
// Normalizador canónico para historico.json (v1.3.3)
// DEVUELVE: Array<{ meta:{ generado:string }, resultados:Array<{ruta,fecha,precio_encontrado,limite?,cumple?,fuente?,detalles?}> }>

export function normalizeHistoricoEntryV133(entry) {
  // Canon: bloque = { meta:{generado}, resultados:[{ruta,fecha,precio_encontrado,limite?,cumple?,fuente?,detalles?}] }
  const blocks = [];

  // Helper: fecha ISO segura
  const nowIso = () => new Date().toISOString();
  const coerceIso = (v) => {
    if (!v) return nowIso();
    // Acepta "2025-10-18 00:00 CST", "2025-10-21T15:00:00Z", etc.
    const tryDate = Date.parse(v);
    return Number.isFinite(tryDate) ? new Date(tryDate).toISOString() : nowIso();
  };

  // Helper: crear resultado mínimo
  const makeResult = ({ ruta, fecha, precio, limite, cumple, fuente, detalles }) => ({
    ruta: ruta || null,
    fecha: coerceIso(fecha),
    precio_encontrado: typeof precio === "number" ? precio : null,
    ...(typeof limite === "number" ? { limite } : {}),
    ...(typeof cumple === "string" ? { cumple } : {}),
    ...(fuente ? { fuente } : {}),
    ...(detalles ? { detalles } : {})
  });

  // === CASO V8: array de bloques [{meta:{}, resultados:[]}, ...]
  if (Array.isArray(entry)) {
    const out = entry.map((b) => {
      const meta = b?.meta ?? {};
      const resultados = Array.isArray(b?.resultados) ? b.resultados.map(r => makeResult({
        ruta: r?.ruta?.toString()?.trim() || null,
        fecha: r?.fecha,
        precio: r?.precio_encontrado,
        limite: r?.limite,
        cumple: r?.cumple,
        fuente: r?.fuente,
        detalles: r?.detalles
      })) : [];
      return { meta: { generado: coerceIso(meta?.generado) }, resultados };
    }).filter(b => b.resultados.length > 0);
    return out;
  }

  if (!entry || typeof entry !== "object") return [];

  // === CASO V5: snapshot de dashboard con meta.titulo, resumen[], detalles{ "LIM ⇄ FLL": {...}, ... }
  if (entry?.meta?.titulo && Array.isArray(entry?.resumen) && entry?.detalles && typeof entry.detalles === "object") {
    const gen = coerceIso(entry.meta?.generado);
    const res = [];
    // 1) Tomamos precios base desde el resumen (precio_mas_bajo_usd / umbral_usd).
    for (const r of entry.resumen) {
      const ruta = r?.ruta || null;
      res.push(makeResult({
        ruta,
        fecha: gen,
        precio: r?.precio_mas_bajo_usd,
        limite: r?.umbral_usd,
        cumple: r?.resultado // “Cumple” / “No cumple”
      }));
    }
    return [{ meta: { generado: gen }, resultados: res }];
  }

  // === CASO V6: resumen con salida/retorno/umbral/precio/cumple
  if (Array.isArray(entry?.resumen) && entry?.resumen[0]?.salida && entry?.resumen[0]?.retorno) {
    const gen = coerceIso(entry?.meta?.generado);
    const res = entry.resumen.map(r => makeResult({
      ruta: r?.ruta || null,
      fecha: gen,
      precio: r?.precio,
      limite: r?.umbral,
      cumple: r?.cumple
    }));
    return [{ meta: { generado: gen }, resultados: res }];
  }

  // === CASO V7: tabla plana por destino/aerolinea/precio (sin umbral explícito)
  if (Array.isArray(entry?.resumen) && entry?.resumen[0]?.destino) {
    const gen = coerceIso(entry?.meta?.generado);
    const origen = entry?.meta?.origen || "LIM";
    const res = entry.resumen.map(r => makeResult({
      ruta: `${origen} → ${r?.destino}`,
      fecha: gen,
      precio: r?.precio,
      // No hay umbral/cumple claros en esta variante
      fuente: r?.aerolinea ? `aerolínea: ${r.aerolinea}` : undefined,
      detalles: {
        escala: r?.escala ?? null,
        equipaje: r?.equipaje ?? null,
        duracion: r?.duracion_vuelo ?? null
      }
    }));
    return [{ meta: { generado: gen }, resultados: res }];
  }

  // === CASOS V1-4 / variantes antiguas: historico / historico_detallado
  if (Array.isArray(entry?.historico) || Array.isArray(entry?.historico_detallado) || Array.isArray(entry?.resultados)) {
    const gen = coerceIso(entry?.meta?.generado);
    const arr =
      Array.isArray(entry?.resultados) ? entry.resultados :
      Array.isArray(entry?.historico) ? entry.historico :
      Array.isArray(entry?.historico_detallado) ? entry.historico_detallado :
      [];

    const res = arr.map(r => makeResult({
      ruta: r?.ruta || r?.route || null,
      fecha: r?.fecha || gen,
      precio: r?.precio_encontrado ?? r?.precio ?? r?.price ?? null,
      limite: r?.limite ?? r?.umbral ?? null,
      cumple: r?.cumple ?? r?.resultado ?? null,
      fuente: r?.fuente,
      detalles: r?.detalles
    })).filter(x => x.ruta && Number.isFinite(x.precio_encontrado));

    if (res.length > 0) return [{ meta: { generado: gen }, resultados: res }];
    return [];
  }

  // Si nada calza, no devolvemos nada (auditor reportará unknown)
  return [];
}
