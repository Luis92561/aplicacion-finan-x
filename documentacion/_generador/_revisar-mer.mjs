// Verifica que la seccion 6 se elimino del MER y que el documento sigue completo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const h = fs.readFileSync(path.join(RAIZ, 'documentacion', 'E1_Modelo_Entidad_Relacion.html'), 'utf8');

console.log('=== RESTOS DE LA SECCION 6 (todos deben ser 0) ===');
let fallos = 0;
for (const b of [
  'Coherencia con los demás documentos',
  'Cómo regenerar este documento',
  'generar-esquema.mjs',
  '01-mer.mjs',
  'cadena documental',
  'Evidencia 2 · Diccionario',
  'Evidencia 3 · ERS',
  'Evidencia 6 · Matriz',
  'Evidencia 7 · Pruebas',
]) {
  const n = h.split(b).length - 1;
  console.log(`  ${String(n).padStart(2)}  ${b}`);
  if (n > 0) fallos++;
}

console.log('\n=== EL DOCUMENTO SIGUE COMPLETO ===');
const secciones = Array.from(h.matchAll(/<h1>([^<]+)<\/h1>/g)).map((m) => m[1]);
console.log('  secciones:', secciones.join(' | '));
for (const s of ['1. Introducción', '2. Entidades', '3. Diagrama entidad-relación', '4. Relaciones y cardinalidades', '5. Claves y restricciones']) {
  const ok = secciones.includes(s);
  console.log(`  ${ok ? 'OK' : '✗ FALTA'}  ${s}`);
  if (!ok) fallos++;
}
if (secciones.some((s) => /^6\./.test(s))) { console.log('  ✗ sigue habiendo una sección 6'); fallos++; }

console.log('\n=== EL DIAGRAMA SIGUE INTACTO ===');
const entidades = (h.match(/<text[^>]*fill="#ffffff"[^>]*>[a-z_]+<\/text>/g) || []).length;
console.log(`  cabeceras de entidad en el SVG: ${entidades}  (deben ser 12)`);
if (entidades !== 12) fallos++;
const valores = [...h.matchAll(/(?<![A-Za-z])(undefined|NaN)(?![A-Za-z])/g)].length;
console.log(`  valores sin resolver: ${valores}`);
if (valores) fallos++;
const pie = h.includes('Evidencia 1 de 7');
console.log(`  pie de página presente: ${pie ? 'sí' : 'NO'}`);
if (!pie) fallos++;

console.log(`\n${fallos === 0 ? '✓ MER correcto: sección 6 eliminada y documento completo' : `✗ ${fallos} problema(s)`}`);
process.exit(fallos ? 1 : 0);
