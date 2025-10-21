// scripts/alert.js
import fs from 'fs';
import { execSync } from 'child_process';

const DATA = JSON.parse(fs.readFileSync('./data.json','utf8'));
const resumen = DATA.resumen || [];
const historico = DATA.historico || []; // [{fecha, fll, mia, mco}]

const last7 = historico.slice(-7);
const min7 = {
  FLL: Math.min(...last7.map(x=>x.fll).filter(n=>typeof n==='number')),
  MIA: Math.min(...last7.map(x=>x.mia).filter(n=>typeof n==='number')),
  MCO: Math.min(...last7.map(x=>x.mco).filter(n=>typeof n==='number')),
};

const alerts = [];
for(const r of resumen){
  const ruta = r.ruta||'';
  const min = r.precio_mas_bajo_usd ?? null;
  const cumple = /cumple/i.test(r.resultado||'');
  let ref = null;
  if(ruta.includes('FLL')) ref = min7.FLL;
  if(ruta.includes('MIA')) ref = min7.MIA;
  if(ruta.includes('MCO')) ref = min7.MCO;

  const drop = (typeof min==='number' && typeof ref==='number') ? (ref - min) : 0;
  if(cumple || drop >= 20){
    alerts.push({ ruta, resultado: r.resultado, min, umbral: r.umbral_usd, drop });
  }
}

if(!alerts.length){
  console.log('No hay alertas que emitir.');
  process.exit(0);
}

const body = [
  **Alerta de tarifas – ${new Date().toISOString()}**,
  '',
  ...alerts.map(a=>- **${a.ruta}**: ${a.resultado} · Min: USD ${a.min} · Umbral: USD ${a.umbral} · Variación 7d: ${a.drop>0?'-':''}${a.drop} USD),
  '',
  'Fuente: data.json (workflow FareBot).'
].join('\n');

try{
  // Crear Issue usando GitHub CLI (ya disponible en runners) con GITHUB_TOKEN implícito
  execSync(gh issue create -t "Alerta de tarifas (${new Date().toISOString().slice(0,16)})" -b "${body.replace(/"/g,'\\"')}", {stdio:'inherit'});
} catch(e){
  console.error('No se pudo crear el Issue de alerta:', e.message);
  process.exit(0);
}
