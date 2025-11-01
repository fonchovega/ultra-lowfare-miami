// ============================================================
// scripts/scoring.js
// Ultra-LowFare v1.3.1 — heurísticas básicas para rankeo adaptativo
// ============================================================
 
// Exportación por defecto (para que el import dinámico funcione)
export default function scoring(p, opts = {}) {
// opts: { prefer_low_fees, prefer_refundable, route, originCountry, destCountry }
let s = 0;

// --- Heurísticas base ---
// Metabuscadores suelen ofrecer más opciones -> +1
if (p.kind === "meta") s += 1;

// Preferencias del usuario
if (opts.prefer_low_fees && p.kind === "airline") s += 1;
if (opts.prefer_refundable && p.kind === "airline") s += 0.5;

// Cobertura geográfica: prioridad si el proveedor opera desde país origen
if (p.countries_origin?.includes(opts.originCountry)) s += 2;

// Bonus si el proveedor tiene peso interno alto (definido en aliases)
if (p.weight && p.weight > 0) s += p.weight;

return s;
}
