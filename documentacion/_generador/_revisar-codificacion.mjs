// Verifica que los archivos editados sigan siendo UTF-8 valido y sin mojibake.
// Este proyecto ya sufrio dos veces corrupcion de acentos por reescribir archivos
// con la codificacion equivocada, asi que se comprueba explicitamente.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

const ARCHIVOS = [
  'README.md',
  'documentacion/LEEME.md',
  'documentacion/SPEC_Funcional.md',
  'documentacion/SPEC_Tecnico.md',
  'documentacion/Instrucciones_Despliegue.md',
  'documentacion/GUIA_CODIGO_COMPLETO.md',
  'deep-docs/02-ARQUITECTURA.md',
  'deep-docs/05-REGLAS-DE-NEGOCIO.md',
  'deep-docs/07-LEVANTAR-Y-PROBAR.md',
  'deep-docs/09-OBSERVACIONES-Y-RIESGOS.md',
];

console.log('Archivo                                        BOM   Mojibake  U+FFFD');
console.log('─'.repeat(72));

let problemas = 0;
for (const rel of ARCHIVOS) {
  const p = path.join(RAIZ, rel);
  if (!fs.existsSync(p)) { console.log(`  ⚠ no existe ${rel}`); problemas++; continue; }

  const buf = fs.readFileSync(p);
  const texto = buf.toString('utf8');

  // BOM UTF-8
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  // Secuencias tipicas de mojibake (UTF-8 leido como latin1)
  const mojibake = (texto.match(/Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â€[\u0090-\u009F]/g) || []).length;
  // Caracteres de reemplazo: indican bytes invalidos para UTF-8
  const reemplazo = (texto.match(/\uFFFD/g) || []).length;

  if (bom || mojibake || reemplazo) problemas++;

  console.log(
    `  ${rel.padEnd(44)} ${bom ? 'SÍ ' : 'no '} ${String(mojibake).padStart(8)} ${String(reemplazo).padStart(8)}`,
  );
}

console.log(`\n${problemas === 0 ? '✓ Los 10 archivos son UTF-8 válido, sin BOM ni acentos corruptos' : `⚠ ${problemas} archivo(s) con problemas de codificación`}`);
process.exit(problemas ? 1 : 0);
