// scoring.js — puntajes sencillos para rankear proveedores
export function scoreProvider(p, opts) {
  // opts: { prefer_low_fees, prefer_refundable }
  let s = 0;
  // Heurísticas: metas suelen tener más opciones -> +1
  if (p.kind === "meta") s += 1;
  // Preferencias
  if (opts?.prefer_low_fees && p.kind === "airline") s += 1;
  if (opts?.prefer_refundable) s += 0; // placeholder
  // Cobertura geográfica priorizada si incluye país de origen
  if (p.matchesOrigin) s += 2;
  return s;
}
