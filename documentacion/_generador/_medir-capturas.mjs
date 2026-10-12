// Mide la altura que ocuparia cada captura en el PDF, para saber cuales no caben
// en una pagina A4 (area util: 178 mm de ancho x ~259 mm de alto).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const DOC = path.join(RAIZ, 'documentacion');
const html = fs.readFileSync(path.join(DOC, 'E7_Pruebas_Integracion.html'), 'utf8');

// Ancho util de la caja de contenido en el PDF: A4 (210mm) menos margenes (16+16mm)
const ANCHO_UTIL_MM = 178;
// Alto util: A4 (297mm) menos margenes (18+20mm)
const ALTO_UTIL_MM = 259;

const capturas = [...html.matchAll(/<img src="([^"]+)"[^>]*>/g)].map((m) => m[1]);

console.log(`Area util de una pagina A4: ${ANCHO_UTIL_MM} mm x ${ALTO_UTIL_MM} mm\n`);
console.log('Captura                               Ancho   Alto    Alto al 178mm   ¿Cabe?');
console.log('-'.repeat(85));

for (const rel of capturas) {
  // Las rutas del documento son relativas a documentacion/, no a la raiz.
  const p = path.join(DOC, rel);
  if (!fs.existsSync(p)) { console.log(`  ${path.basename(rel)}  (NO EXISTE: ${rel})`); continue; }

  // Dimensiones del PNG: se leen de la cabecera IHDR (bytes 16-24)
  const buf = fs.readFileSync(p);
  const ancho = buf.readUInt32BE(16);
  const alto = buf.readUInt32BE(20);

  // Al escalar al ancho util, la altura resultante en mm
  const altoMm = (alto / ancho) * ANCHO_UTIL_MM;
  const cabe = altoMm <= ALTO_UTIL_MM;

  console.log(
    `  ${path.basename(rel).padEnd(34)} ${String(ancho).padStart(5)}  ${String(alto).padStart(5)}   ${altoMm.toFixed(0).padStart(10)} mm   ${cabe ? 'sí' : '>>> NO CABE <<<'}`,
  );
}
