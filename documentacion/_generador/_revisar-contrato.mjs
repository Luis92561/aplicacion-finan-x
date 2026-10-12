/**
 * Comprueba que el contrato (Evidencia 5) ya no tenga marcadores resaltados:
 * los datos de las partes deben aparecer como lineas en blanco con su etiqueta.
 *
 * Los comentarios de codigo (/* ... *​/ y <!-- ... -->) se descartan antes de
 * analizar: explican el cambio y mencionan a proposito lo que habia antes, asi que
 * no deben contar como texto visible del documento.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const HTML = path.join(RAIZ, 'documentacion', 'E5_Contrato_Licencia_Software.html');
const GEN = path.join(RAIZ, 'documentacion', '_generador', '05-contrato-licencia.mjs');

/** Quita comentarios de bloque, de linea y de HTML. */
const sinComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const h = sinComentarios(fs.readFileSync(HTML, 'utf8'));
const g = sinComentarios(fs.readFileSync(GEN, 'utf8'));

const cuenta = (t, p) => (t.match(p) || []).length;

console.log('=== GENERADOR (sin comentarios) ===');
let fallos = 0;
for (const [nombre, re] of [
  ['usos de M()', /M\(/g],
  ['clase placeholder', /placeholder/g],
  ['palabra marcador', /marcador/i],
  ['etiquetas [Nombre] [NIT] [CC]...', /\[(Nombre|NIT|CC|ciudad|día|mes|año|número|razón|correo|pasaporte)/g],
]) {
  const n = cuenta(g, re);
  console.log(`  ${nombre.padEnd(34)} ${n}`);
  if (n > 0) fallos++;
}

console.log('\n=== DOCUMENTO GENERADO (sin comentarios) ===');
for (const [nombre, re, exigirCero] of [
  ['elementos con clase placeholder', /class="placeholder"/g, true],
  ['palabra "marcador"', /marcador/gi, true],
  ['huecos en blanco (hueco)', /class="hueco"/g, false],
  ['lineas de firma (linea-firma)', /class="linea-firma"/g, false],
  ['rayas de relleno antiguas', /class="linea-vacia"/g, true],
  ['corchetes de plantilla restantes', /\[(Nombre|NIT|CC|ciudad|día|mes|año|número|razón|correo|pasaporte)/g, true],
  ['valores sin resolver', /(?<![A-Za-z])(undefined|NaN)(?![A-Za-z])/g, true],
  ['mojibake', /Ã|Â|â€/g, true],
]) {
  const n = cuenta(h, re);
  console.log(`  ${nombre.padEnd(34)} ${n}`);
  if (exigirCero ? n > 0 : n === 0) fallos++;
}

console.log('\n=== LAS ETIQUETAS SIGUEN PRESENTES ===');
// En las tablas de partes la etiqueta es la celda con clase c-etiqueta; en la tabla
// de caracteristicas del software sigue siendo un <strong>.
for (const e of ['Integrantes', 'Documento de identidad', 'Domicilio', 'Correo de contacto',
  'Razón social', 'NIT', 'Representante legal', 'Documento del representante']) {
  const ok = h.includes(`class="c-etiqueta">${e}<`) || h.includes(`<strong>${e}</strong>`);
  console.log(`  ${e.padEnd(34)} ${ok ? 'OK' : '✗ FALTA'}`);
  if (!ok) fallos++;
}
const okUbic = h.includes('<strong>Ubicación del código</strong>');
console.log(`  ${'Ubicación del código'.padEnd(34)} ${okUbic ? 'OK' : '✗ FALTA'}`);
if (!okUbic) fallos++;

// La tabla debe conservar el aspecto: franjas y bordes del tema.
if (!h.includes('nth-child(even)')) { console.log('  ✗ falta la regla de franjas alternas'); fallos++; }
else console.log('  franjas alternas del tema       OK');
if (!/table\.formulario tbody tr:last-child td\{border-bottom:none\}/.test(h)) {
  console.log('  ✗ falta quitar el borde de la ultima fila'); fallos++;
} else console.log('  borde de fila conservado        OK');

console.log(`\n${fallos === 0 ? '✓ Contrato correcto: sin marcadores, con etiquetas y lineas en blanco' : `✗ ${fallos} problema(s)`}`);
process.exit(fallos ? 1 : 0);
