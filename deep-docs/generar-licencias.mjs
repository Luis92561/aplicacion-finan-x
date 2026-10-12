/**
 * Extrae las licencias REALES de todas las dependencias desde los package-lock.json.
 *
 * Sirve de base para la matriz de propiedad intelectual: la licencia hay que
 * verificarla, no suponerla. El dato sale del propio árbol de dependencias
 * instalable, que es la fuente autoritativa.
 *
 * Uso (desde la raíz del proyecto):  node deep-docs/_generar_licencias.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = new URL('../', import.meta.url);

function leerLock(ruta) {
  const abs = new URL(ruta, RAIZ);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function recolectar(lock) {
  const out = new Map();
  if (!lock?.packages) return out;
  for (const [nombre, info] of Object.entries(lock.packages)) {
    if (!nombre.startsWith('node_modules/')) continue;
    // Solo paquetes de primer nivel de node_modules (no los anidados)
    const rel = nombre.replace('node_modules/', '');
    if (rel.includes('node_modules/')) continue;
    let lic = info.license;
    if (!lic && Array.isArray(info.licenses)) lic = info.licenses.map((l) => l.type).join(' OR ');
    out.set(rel, { version: info.version, licencia: lic || 'NO INDICADA' });
  }
  return out;
}

const beDirectas = Object.keys(JSON.parse(fs.readFileSync(new URL('backend/package.json', RAIZ), 'utf8')).dependencies || {});
const feDirectas = Object.keys(JSON.parse(fs.readFileSync(new URL('frontend/package.json', RAIZ), 'utf8')).dependencies || {});
const feDev = Object.keys(JSON.parse(fs.readFileSync(new URL('frontend/package.json', RAIZ), 'utf8')).devDependencies || {});

const be = recolectar(leerLock('backend/package-lock.json'));
const fe = recolectar(leerLock('frontend/package-lock.json'));

const filas = [];
for (const [ambito, mapa, directas, dev] of [
  ['backend', be, beDirectas, []],
  ['frontend', fe, feDirectas, feDev],
]) {
  for (const [nombre, info] of mapa) {
    const tipo = directas.includes(nombre) ? 'directa' : (dev.includes(nombre) ? 'desarrollo' : 'transitiva');
    filas.push({ ambito, nombre, version: info.version, licencia: info.licencia, tipo });
  }
}

filas.sort((a, b) => a.ambito.localeCompare(b.ambito) || a.nombre.localeCompare(b.nombre));

// Resumen por licencia
const porLicencia = new Map();
for (const f of filas) porLicencia.set(f.licencia, (porLicencia.get(f.licencia) || 0) + 1);

console.log('=== RESUMEN POR LICENCIA ===');
for (const [lic, n] of [...porLicencia.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${lic.padEnd(24)} ${n}`);
}

console.log(`\nTotal de paquetes analizados: ${filas.length}`);
console.log(`  backend:  ${filas.filter((f) => f.ambito === 'backend').length}`);
console.log(`  frontend: ${filas.filter((f) => f.ambito === 'frontend').length}`);

console.log('\n=== DEPENDENCIAS DIRECTAS ===');
for (const f of filas.filter((x) => x.tipo !== 'transitiva')) {
  console.log(`  [${f.ambito}] ${f.nombre.padEnd(28)} ${String(f.version).padEnd(10)} ${f.licencia.padEnd(12)} (${f.tipo})`);
}

// Avisar de licencias que conviene revisar (copyleft fuerte o no indicada)
const alerta = filas.filter((f) => /GPL|AGPL|NO INDICADA|UNLICENSED/i.test(f.licencia));
console.log(`\n=== AVISOS (${alerta.length}) ===`);
if (!alerta.length) console.log('  Ninguno: no hay licencias copyleft fuertes ni sin indicar.');
for (const f of alerta) console.log(`  [${f.ambito}] ${f.nombre} ${f.version} -> ${f.licencia}`);

fs.writeFileSync(new URL('deep-docs/_licencias.json', RAIZ), JSON.stringify({ generado: new Date().toISOString(), filas }, null, 2), 'utf8');
console.log('\nEscrito: deep-docs/_licencias.json');
