/**

* auditor_v133.js
* Auditor de estructuras en data/historico.json
* Detecta versiones V1–V8 y genera data/historico_unknown_samples.json
*/

import fs from 'node:fs';
import path from 'node:path';
import { isBlockLike } from './schema_v133.js';

// --------------------------- utilitarios ---------------------------
function readJsonSafe(p, fb) {
try {
return JSON.parse(fs.readFileSync(p, 'utf8'));
} catch (_) {
return fb;
}
}

function writeJson(p, data) {
fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function keys(obj) {
return obj ? Object.keys(obj) : [];
}

// --------------------------- identificación ---------------------------
function detectVersion(sample) {
if (!sample || typeof sample !== 'object') return 'unknown';
const k = keys(sample);

// Casos por patrón
if (k.includes('meta') && k.includes('resumen') && !k.includes('detalles')) return 'V1-4';
if (k.includes('meta') && k.includes('resumen') && k.includes('detalles')) return 'V5';
if (k.includes('meta') && Array.isArray(sample.resumen) && sample.resumen[0]?.precio)
return 'V6';
if (k.includes('meta') && Array.isArray(sample.resumen) && sample.resumen[0]?.aerolinea)
return 'V7';
if (Array.isArray(sample) && sample[0]?.meta && Array.isArray(sample[0].resultados))
return 'V8';

return 'unknown';
}

// --------------------------- auditor principal ---------------------------
export function auditHistorico(baseDir = '.') {
const HIST = path.join(baseDir, 'data', 'historico.json');
const hist = readJsonSafe(HIST, []);
const unknownSamples = [];

const summary = {
'V1-4': 0,
'V1-4*': 0,
V5: 0,
V6: 0,
V7: 0,
V8: 0,
'Reconocidos solo por normalizador': 0,
Unknown: 0
};

hist.forEach((item, idx) => {
const tag = detectVersion(item);
if (tag === 'unknown') {
summary.Unknown++;
unknownSamples.push({ index: idx, sample: item });
console.log('✖ index ' + idx + ': UNKNOWN (tag:unknown)');
} else {
summary[tag] = (summary[tag] || 0) + 1;
console.log('✔ index ' + idx + ': ' + tag + ' (normalizado OK)');
}
});

const OUT = path.join(baseDir, 'data', 'historico_unknown_samples.json');
writeJson(OUT, unknownSamples);

console.log('\n✅ Auditoría v1.3.3 (revisado)');
for (const [k, v] of Object.entries(summary)) {
const pad = k.padEnd(12, ' ');
console.log('  ' + pad + ': ' + v);
}
console.log('\nMuestras desconocidas: ' + OUT);

return { summary, unknownSamples };
}

// CLI
if (import.meta.url && process.argv && process.argv[1]) {
try {
const base = process.argv[2] || '.';
auditHistorico(base);
} catch (e) {
console.error('Error auditor_v133:', e);
process.exit(1);
}
}