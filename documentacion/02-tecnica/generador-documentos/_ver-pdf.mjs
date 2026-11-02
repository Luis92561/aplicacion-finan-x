// Comprueba que los PDF contienen las capturas: busca objetos de imagen y cuenta paginas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const DOC = path.join(RAIZ, 'documentacion');

const pdfs = fs.readdirSync(DOC).filter((f) => /^E\d+_.*\.pdf$/.test(f)).sort();

console.log('Documento                                     Páginas  Imágenes   Tamaño');
console.log('─'.repeat(74));

for (const f of pdfs) {
  const buf = fs.readFileSync(path.join(DOC, f));
  const txt = buf.toString('latin1');
  const imagenes = (txt.match(/\/Subtype\s*\/Image/g) || []).length;
  // El numero de paginas del arbol /Count del catalogo, o contando objetos /Type /Page
  const cuentaArbol = txt.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  const paginas = cuentaArbol ? Number(cuentaArbol[1]) : (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const kb = (buf.length / 1024).toFixed(0);
  console.log(`  ${f.replace(/\.pdf$/, '').padEnd(44)} ${String(paginas).padStart(6)}  ${String(imagenes).padStart(8)}  ${kb.padStart(6)} KB`);
}

console.log(`\nCapturas en documentacion/capturas/: ${fs.readdirSync(path.join(DOC, 'capturas')).filter((f) => f.endsWith('.png')).length}`);
