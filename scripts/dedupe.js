function normStr(x) {
  return String(x ?? "").trim().toLowerCase();
}

function makeKey(x) {
  // Clave estable para deduplicar “mismo resultado”
  // Puedes ajustar campos si lo ves necesario
  return [
    normStr(x.route),
    normStr(x.departDate),
    normStr(x.returnDate),
    normStr(x.stopsMax),
    normStr(x.baggage),
    normStr(x.airline || x.metaAirline || ""),
    normStr(x.metaEngine || x.source || ""),
    normStr(x.itinerary || ""),
    normStr(x.currency || "usd"),
    String(Math.round(Number(x.totalFare || x.price || 0) * 100)) // centavos
  ].join("|");
}

function dedupeKeepLatest(records) {
  const map = new Map();
  for (const r of records) {
    const k = makeKey(r);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, r);
      continue;
    }
    // conservar el más nuevo por foundAt
    const a = new Date(prev.foundAt || prev.createdAt || 0).getTime();
    const b = new Date(r.foundAt || r.createdAt || 0).getTime();
    if (b >= a) map.set(k, r);
  }
  return Array.from(map.values());
}

module.exports = { dedupeKeepLatest };
