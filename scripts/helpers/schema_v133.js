/**

* schema_v133.js
* Utilidades de validación/shape para histórico v1.3.3
* 
* No usa template literals para evitar problemas al copiar desde WhatsApp.
*/

export const WRITER_VERSION = '1.3.3';

// --------------------------- Helpers básicos ---------------------------
function isPlainObject(x) {
return !!x && typeof x === 'object' && !Array.isArray(x);
}

function hasKeys(obj, keys) {
if (!isPlainObject(obj)) return false;
for (const k of keys) {
if (!(k in obj)) return false;
}
return true;
}

function isIsoString(x) {
if (typeof x !== 'string') return false;
// Validación simple de ISO 8601
return x.includes('T') && x.endsWith('Z');
}

// --------------------------- Shapes canónicos ---------------------------
export function isMeta(meta) {
if (!isPlainObject(meta)) return false;
// generado es obligatorio; el resto opcional
if (!('generado' in meta)) return false;
return typeof meta.generado === 'string';
}

export function isResumenArray(arr) {
if (!Array.isArray(arr)) return false;
// elementos típicos: { ruta, salida?, retorno?, umbral|umbral_usd, precio|precio_mas_bajo_usd, cumple|resultado }
return true;
}

export function isResultadosArray(arr) {
if (!Array.isArray(arr)) return false;
// elementos típicos: { ruta, fecha, precio_encontrado, limite, cumple, fuente, detalles? }
return true;
}

/**

* Un "bloque" válido debe cumplir:
*    - meta: objeto con al menos 'generado' (string)
*    - y al menos uno de: resumen[array] o resultados[array]
*/
export function isBlockLike(entry) {
if (!isPlainObject(entry)) return false;
if (!isMeta(entry.meta)) return false;

const hasResumen = 'resumen' in entry ? isResumenArray(entry.resumen) : false;
const hasResultados = 'resultados' in entry ? isResultadosArray(entry.resultados) : false;

return hasResumen || hasResultados;
}

// --------------------------- Validador detallado ---------------------------
export function validateBlock(entry) {
const errors = [];
if (!isPlainObject(entry)) {
return { ok: false, errors: ['entry no es objeto'] };
}

if (!isMeta(entry.meta)) {
errors.push('meta inválido o sin "generado"');
} else {
if (!isIsoString(entry.meta.generado)) {
// Permitimos strings no ISO, pero avisamos
errors.push('meta.generado no parece ISO-8601 (se coercionará al escribir)');
}
}

const hasResumen = 'resumen' in entry;
const hasResultados = 'resultados' in entry;

if (!hasResumen && !hasResultados) {
errors.push('faltan "resumen" y/o "resultados"');
} else {
if (hasResumen && !isResumenArray(entry.resumen)) {
errors.push('resumen no es array');
}
if (hasResultados && !isResultadosArray(entry.resultados)) {
errors.push('resultados no es array');
}
}

return { ok: errors.length === 0, errors };
}