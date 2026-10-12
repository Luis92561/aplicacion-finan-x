/**
 * Verifica que los documentos de evidencias generados sean coherentes:
 * cuenta los elementos clave de cada uno y avisa de problemas evidentes.
 *
 * Uso (desde la raiz):  node documentacion/_generador/verificar.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const DOC = path.join(RAIZ, 'documentacion');

const EVIDENCIAS = [
  ['E1', 'E1_Modelo_Entidad_Relacion', 'MER'],
  ['E2', 'E2_Diccionario_de_Datos', 'Diccionario de datos'],
  ['E3', 'E3_ERS_IEEE830', 'ERS / IEEE 830'],
  ['E4', 'E4_Matriz_Propiedad_Intelectual', 'Propiedad intelectual'],
  ['E5', 'E5_Contrato_Licencia_Software', 'Contrato de licencia'],
  ['E6', 'E6_Matriz_Trazabilidad', 'Trazabilidad'],
  ['E7', 'E7_Pruebas_Integracion', 'Pruebas de integración'],
];

const cuenta = (texto, patron) => (texto.match(patron) || []).length;

let problemas = 0;
console.log('Documento                              HTML    PDF   tablas  filas');
console.log('─'.repeat(74));

for (const [id, base, nombre] of EVIDENCIAS) {
  const htmlPath = path.join(DOC, `${base}.html`);
  const pdfPath = path.join(DOC, `${base}.pdf`);

  if (!fs.existsSync(htmlPath)) {
    console.log(`  ${id.padEnd(4)} ${nombre.padEnd(30)} FALTA EL HTML`);
    problemas++;
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const kbHtml = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
  const kbPdf = fs.existsSync(pdfPath) ? (fs.statSync(pdfPath).size / 1024).toFixed(0) : null;

  const tablas = cuenta(html, /<table/g);
  const filas = cuenta(html, /<tr>/g);

  console.log(
    `  ${id.padEnd(4)} ${nombre.padEnd(30)} ${(kbHtml + ' KB').padStart(7)}  ${(kbPdf ? kbPdf + ' KB' : '—').padStart(7)}  ${String(tablas).padStart(5)}  ${String(filas).padStart(4)}`,
  );

  // Las imagenes citadas deben existir en disco: si no, el PDF sale sin ellas.
  // Las rutas del documento son relativas a documentacion/.
  const rutas = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const faltan = rutas.filter((r) => !fs.existsSync(path.join(DOC, r)));
  if (faltan.length) {
    console.log(`        ⚠ ${faltan.length} imagen(es) NO encontradas (el PDF saldra sin ellas): ${faltan.slice(0, 3).join(', ')}`);
    problemas++;
  } else if (rutas.length) {
    console.log(`        ✓ imágenes: ${rutas.length} referenciadas, todas presentes`);
  }

  // Comprobaciones basicas de calidad.
  // Ojo con los falsos positivos: "NaN" aparece dentro de "Consolas" (una fuente) y
  // "undefined" podria aparecer dentro de un identificador. Se exige que sean valores
  // sueltos (rodeados de caracteres que no sean letras).
  if (!/<!DOCTYPE html>/i.test(html)) { console.log(`        ⚠ sin DOCTYPE`); problemas++; }
  if (!/charset="utf-8"/i.test(html)) { console.log(`        ⚠ sin charset utf-8`); problemas++; }

  const sospechosos = [
    ...html.matchAll(/(?<![A-Za-z])(undefined|NaN)(?![A-Za-z])/g),
    ...html.matchAll(/\[object Object\]/g),
  ].map((m) => m[0]);

  if (sospechosos.length) {
    const muestra = [...new Set(sospechosos)].join(', ');
    console.log(`        ⚠ ${sospechosos.length} valores sin resolver (${muestra})`);
    problemas++;
  }
  if (/Ã|Â|â€/.test(html)) { console.log(`        ⚠ acentos mal codificados (mojibake)`); problemas++; }
  if (kbPdf === null) { console.log(`        ⚠ falta el PDF`); problemas++; }
}

// Coherencia de nombres entre documentos: las entidades del MER deben aparecer en el diccionario
console.log('\n' + '─'.repeat(38));
const esquema = JSON.parse(fs.readFileSync(path.join(RAIZ, 'deep-docs', '_esquema.json'), 'utf8'));
const tablasEsquema = [...new Set(esquema.columnas.map((c) => c.table_name))];

const dicc = fs.readFileSync(path.join(DOC, 'E2_Diccionario_de_Datos.html'), 'utf8');
const faltanEnDicc = tablasEsquema.filter((t) => !dicc.includes(`<code>${t}</code>`));
console.log(`Entidades del esquema: ${tablasEsquema.length}`);
console.log(`  ...presentes en el diccionario: ${tablasEsquema.length - faltanEnDicc.length}`);
if (faltanEnDicc.length) { console.log(`  ⚠ ausentes: ${faltanEnDicc.join(', ')}`); problemas++; }

// Las columnas del esquema deben estar todas en el diccionario
const faltanCols = esquema.columnas.filter((c) => !dicc.includes(`<code>${c.column_name}</code>`));
console.log(`Columnas del esquema: ${esquema.columnas.length}  ·  ausentes en el diccionario: ${faltanCols.length}`);
if (faltanCols.length) { console.log('  ⚠ ' + faltanCols.slice(0, 8).map((c) => `${c.table_name}.${c.column_name}`).join(', ')); problemas++; }

console.log(`\n${problemas === 0 ? '✓ Sin problemas detectados' : `⚠ ${problemas} problema(s) detectado(s)`}`);

// ---------- Comprobaciones especificas de la Evidencia 7 ----------
const e7 = path.join(DOC, 'E7_Pruebas_Integracion.html');
if (fs.existsSync(e7)) {
  const h = fs.readFileSync(e7, 'utf8');
  const cuenta = (p) => (h.match(p) || []).length;
  console.log('\nEvidencia 7 · Pruebas de integración');
  console.log(`  Resultados PASA:  ${cuenta(/PASA<\/span>/g)}`);
  console.log(`  Resultados FALLA: ${cuenta(/FALLA<\/span>/g)}`);
  console.log(`  Sin dato (—):     ${cuenta(/—<\/span>/g)}`);
  console.log(`  Capturas citadas: ${cuenta(/<img /g)}`);

  // Las imagenes deben existir en disco: si no, el PDF sale sin ellas.
  const rutas = [...h.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  const faltan = rutas.filter((r) => !fs.existsSync(path.join(DOC, r)));
  if (faltan.length) {
    console.log(`  ⚠ ${faltan.length} imagen(es) no encontradas desde documentacion/: ${faltan.slice(0, 3).join(', ')}`);
    problemas++;
  } else if (rutas.length) {
    console.log(`  ✓ Las ${rutas.length} capturas resuelven correctamente`);
  }
}

process.exit(problemas ? 1 : 0);
