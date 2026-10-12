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
  ['lineas en blanco (linea-vacia)', /class="linea-vacia"/g, false],
  ['corchetes de plantilla restantes', /\[(Nombre|NIT|CC|ciudad|día|mes|año|número|razón|correo|pasaporte)/g, true],
  ['valores sin resolver', /(?<![A-Za-z])(undefined|NaN)(?![A-Za-z])/g, true],
  ['mojibake', /Ã|Â|â€/g, true],
]) {
  const n = cuenta(h, re);
  console.log(`  ${nombre.padEnd(34)} ${n}`);
  if (exigirCero ? n > 0 : n === 0) fallos++;
}

console.log('\n=== LAS ETIQUETAS SIGUEN PRESENTES (opcion A) ===');
for (const e of ['Integrantes', 'Documento de identidad', 'Domicilio', 'Correo de contacto',
  'Razón social', 'NIT', 'Representante legal', 'Documento del representante',
  'Ubicación del código']) {
  const ok = h.includes(`<strong>${e}</strong>`);
  console.log(`  ${e.padEnd(34)} ${ok ? 'OK' : '✗ FALTA'}`);
  if (!ok) fallos++;
}

console.log(`\n${fallos === 0 ? '✓ Contrato correcto: sin marcadores, con etiquetas y lineas en blanco' : `✗ ${fallos} problema(s)`}`);
process.exit(fallos ? 1 : 0);
