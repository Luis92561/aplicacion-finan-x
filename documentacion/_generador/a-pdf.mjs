/**
 * Convierte a PDF todos los documentos de evidencias en HTML, usando Chrome headless.
 *
 * Es el mismo metodo que el proyecto ya usa para sus PDF (Chrome headless),
 * porque no depende de librerias externas y respeta el CSS de impresion.
 *
 * Uso (desde la raiz):  node documentacion/_generador/a-pdf.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const DOC = path.join(RAIZ, 'documentacion');

const CHROME_CANDIDATOS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chrome = CHROME_CANDIDATOS.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('No se encontro Chrome ni Edge. Defina CHROME_PATH.');
  process.exit(1);
}
console.log(`Navegador: ${chrome}\n`);

// Los documentos de evidencia se reconocen por el prefijo E<n>_
const archivos = fs.readdirSync(DOC).filter((f) => /^E\d+_.*\.html$/.test(f)).sort();
if (!archivos.length) {
  console.error('No hay documentos E*.html en documentacion/. Ejecute primero los generadores.');
  process.exit(1);
}

let ok = 0;
let fallos = 0;

for (const archivo of archivos) {
  const origen = path.join(DOC, archivo);
  const destino = path.join(DOC, archivo.replace(/\.html$/, '.pdf'));
  const uri = new URL(`file:///${origen.replace(/\\/g, '/')}`).href;

  const r = spawnSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--virtual-time-budget=12000',
    `--print-to-pdf=${destino}`,
    uri,
  ], { encoding: 'utf8', timeout: 120000 });

  if (fs.existsSync(destino) && fs.statSync(destino).size > 2000) {
    const kb = (fs.statSync(destino).size / 1024).toFixed(0);
    console.log(`  OK   ${archivo.padEnd(46)} -> ${path.basename(destino).padEnd(46)} ${kb.padStart(5)} KB`);
    ok++;
  } else {
    console.error(`  FALLO ${archivo}`);
    if (r.stderr) console.error('        ' + r.stderr.split('\n').slice(-3).join('\n        '));
    fallos++;
  }
}

console.log(`\nPDF generados: ${ok}${fallos ? `  ·  fallos: ${fallos}` : ''}`);
process.exit(fallos ? 1 : 0);
