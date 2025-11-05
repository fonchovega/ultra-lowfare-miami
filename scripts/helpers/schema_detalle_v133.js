/**

* schema_detalle_v133.js
* Estructura del "detalle expandido" para cada resultado
* Permite registrar aerolínea, fuente (metabuscador), enlace, políticas de equipaje, etc.
*/

export const DETALLE_VERSION = '1.3.3';

export function makeDetalle({
ruta,
origen,
destino,
aerolinea,
fuente,
enlace,
salida,
retorno,
precio,
moneda,
cumple,
limite,
escalas,
equipaje,
observaciones
}) {
return {
ruta: ruta || (origen && destino ? origen + ' ⇄ ' + destino : null),
origen: origen || null,
destino: destino || null,
aerolinea: aerolinea || null,
fuente: fuente || null,
enlace: enlace || null,
salida: salida || null,
retorno: retorno || null,
precio: typeof precio === 'number' ? precio : null,
moneda: moneda || 'USD',
cumple: cumple || 'No definido',
limite: typeof limite === 'number' ? limite : null,
escalas: typeof escalas === 'number' ? escalas : null,
equipaje: equipaje || 'No indicado',
observaciones: observaciones || null,
generado: new Date().toISOString(),
schema_version: DETALLE_VERSION
};
}

export function validateDetalle(d) {
const errors = [];
if (!d) return { ok: false, errors: ['detalle vacío'] };

if (!d.ruta) errors.push('falta ruta');
if (typeof d.precio !== 'number') errors.push('precio inválido');
if (!d.moneda) errors.push('falta moneda');
if (!d.aerolinea && !d.fuente)
errors.push('faltan aerolínea o fuente (una es obligatoria)');

return { ok: errors.length === 0, errors };
}