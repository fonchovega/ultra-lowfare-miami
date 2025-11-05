/**

* writer_historico_v133_full.js
* Escritura robusta del histórico y snapshot actual (v1.3.3)
* 
*    - Anexa uno o varios bloques "canónicos" al archivo data/historico.json
*    - Actualiza data/data.json con el último bloque recibido (snapshot actual)
*    - No usa template literals para evitar problemas al copiar desde WhatsApp
*/

import fs from 'node:fs';
import path from 'node:path';
import {
WRITER_VERSION,
isBlockLike,
isMeta
} from './schema_v133.js';

// --------------------------- Utilitarios I/O ---------------------------

function ensureDir(p) {
fs.mkdirSync(p, { recursive: true });
}

function readJsonSafe(p, fallback) {
try {
const raw = fs.readFileSync(p, 'utf8');
return JSON.parse(raw);
} catch (_) {
return fallback;
}
}

function writeJsonAtomic(p, data) {
const tmp = p + '.tmp';
const txt = JSON.stringify(data, null, 2);
fs.writeFileSync(tmp, txt, 'utf8');
fs.renameSync(tmp, p);
}

function nowIso() {
try {
return new Date().toISOString();
} catch (_) {
return '1970-01-01T00:00:00.000Z';
}
}

// --------------------------- Normalización mínima ---------------------------

function coerceBlock(entry) {
// Si ya parece bloque válido, lo regresamos tal cual
if (isBlockLike(entry)) return entry;

// Caso especial: algunos payloads venían como { meta, resumen } sueltos
if (entry && typeof entry === 'object') {
const meta = isMeta(entry.meta) ? entry.meta : { generado: nowIso() };
const out = {
meta: Object.assign({}, meta, { writer_version: WRITER_VERSION }),
resumen: Array.isArray(entry.resumen) ? entry.resumen : [],
resultados: Array.isArray(entry.resultados) ? entry.resultados : []
};
if (isBlockLike(out)) return out;
}

// Último recurso: envolver en un bloque mínimo
return {
meta: { generado: nowIso(), writer_version: WRITER_VERSION },
resumen: [],
resultados: []
};
}

function toBlocks(payload) {
if (Array.isArray(payload)) {
const blocks = [];
for (const it of payload) {
const b = coerceBlock(it);
if (isBlockLike(b)) blocks.push(b);
}
return blocks;
}
return [coerceBlock(payload)];
}

// --------------------------- API pública ---------------------------

/**

* Escribe en:
*    - data/historico.json: append de bloques
*    - data/data.json: último snapshot
* 
* @param {object|object[]} payload  Bloque o lista de bloques canónicos
* @param {object} opts               { baseDir?: string }
* @returns {{written:number, historicoPath:string, snapshotPath:string}}
*/
export function writeHistoricoFull(payload, opts = {}) {
const ROOT = path.resolve(opts.baseDir || '.');
const DATA_DIR = path.join(ROOT, 'data');
const HISTORICO = path.join(DATA_DIR, 'historico.json');
const SNAPSHOT = path.join(DATA_DIR, 'data.json');

ensureDir(DATA_DIR);

const blocks = toBlocks(payload);
const prev = readJsonSafe(HISTORICO, []);
const next = Array.isArray(prev) ? prev.slice() : [];

for (const b of blocks) {
// Garantizamos versionado mínimo
if (!b.meta || typeof b.meta !== 'object') b.meta = {};
if (!b.meta.generado) b.meta.generado = nowIso();
b.meta.writer_version = WRITER_VERSION;
next.push(b);
}

writeJsonAtomic(HISTORICO, next);

// Snapshot: el último bloque recibido
const last = blocks.length > 0 ? blocks[blocks.length - 1] : {
meta: { generado: nowIso(), writer_version: WRITER_VERSION },
resumen: [],
resultados: []
};
writeJsonAtomic(SNAPSHOT, last);

return {
written: blocks.length,
historicoPath: HISTORICO,
snapshotPath: SNAPSHOT
};
}

/**

* CLI opcional:
* node scripts/helpers/writer_historico_v133_full.js data/historico_unknown_samples.json
* Si pasas una ruta a un JSON, lo carga y lo escribe como blocks.
*/
if (import.meta && import.meta.url && process.argv && process.argv[1]) {
try {
const arg = process.argv[2];
if (arg) {
const abs = path.resolve(arg);
const obj = readJsonSafe(abs, null);
if (!obj) {
console.log('No se pudo leer el archivo: ' + abs);
process.exit(2);
}
const result = writeHistoricoFull(obj, { baseDir: '.' });
console.log('Escritura completa. Bloques: ' + String(result.written));
console.log('Historico: ' + result.historicoPath);
console.log('Snapshot : ' + result.snapshotPath);
}
} catch (e) {
console.error('Error en CLI writer_historico_v133_full:', e && e.message ? e.message : String(e));
process.exit(1);
}
}