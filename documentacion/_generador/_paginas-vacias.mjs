/**
 * Detecta paginas realmente vacias de un PDF.
 *
 * Una pagina esta vacia si NO dibuja texto (operadores Tj/TJ) ni imagenes (Do).
 * El texto de un PDF de Chrome va en hexadecimal, asi que no se cuenta por caracteres
 * sino por operadores: contar caracteres daba falsos positivos.
 *
 * Uso: node documentacion/_generador/_paginas-vacias.mjs <ruta.pdf>
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const ruta = path.resolve(RAIZ, process.argv[2] || 'documentacion/E7_Pruebas_Integracion.pdf');
const buf = fs.readFileSync(ruta);
const tex = buf.toString('latin1');

function objeto(n) {
  const m = new RegExp(`(?:^|[^0-9])${n}\\s+0\\s+obj\\b`).exec(tex);
  if (!m) return null;
  const ini = m.index + m[0].length;
  const fin = tex.indexOf('endobj', ini);
  return { cuerpo: tex.slice(ini, fin < 0 ? tex.length : fin), ini };
}

function flujo(n) {
  const o = objeto(n);
  if (!o) return '';
  const s = o.cuerpo.indexOf('stream');
  if (s < 0) return '';
  let ini = o.ini + s + 6;
  if (buf[ini] === 0x0d) ini++;
  if (buf[ini] === 0x0a) ini++;
  const rel = o.cuerpo.indexOf('endstream', s);
  const crudo = buf.subarray(ini, rel < 0 ? buf.length : o.ini + rel);
  if (/FlateDecode/.test(o.cuerpo.slice(0, s))) {
    try { return zlib.inflateSync(crudo).toString('latin1'); } catch { return ''; }
  }
  return crudo.toString('latin1');
}

const mRoot = /\/Root\s+(\d+)\s+0\s+R/.exec(tex);
const mCat = mRoot && new RegExp(`(?:^|[^0-9])${Number(mRoot[1])}\\s+0\\s+obj([\\s\\S]*?)endobj`).exec(tex);
const refP = mCat && /\/Pages\s+(\d+)\s+0\s+R/.exec(mCat[1]);

function hojas(n, vistos = new Set()) {
  if (vistos.has(n)) return [];
  vistos.add(n);
  const o = objeto(n);
  if (!o) return [];
  if (/\/Type\s*\/Page[^s]/.test(o.cuerpo)) return [n];
  const kids = /\/Kids\s*\[([^\]]*)\]/.exec(o.cuerpo);
  if (!kids) return [];
  return (kids[1].match(/(\d+)\s+0\s+R/g) || [])
    .map((s) => Number(s.match(/\d+/)[0]))
    .flatMap((r) => hojas(r, vistos));
}

const paginas = refP ? hojas(Number(refP[1])) : [];
console.log(`Archivo: ${path.relative(RAIZ, ruta)}`);
console.log(`Paginas: ${paginas.length}\n`);
console.log('Pag.   Textos   Imagenes   Estado');
console.log('-'.repeat(46));

const vacias = [];
paginas.forEach((np, i) => {
  const o = objeto(np);
  const rc = /\/Contents\s+(\d+)\s+0\s+R/.exec(o.cuerpo);
  const ra = /\/Contents\s*\[([^\]]*)\]/.exec(o.cuerpo);
  let contenido = '';
  if (rc) contenido = flujo(Number(rc[1]));
  else if (ra) for (const s of ra[1].match(/(\d+)\s+0\s+R/g) || []) contenido += flujo(Number(s.match(/\d+/)[0]));

  const textos = (contenido.match(/(?:^|\s)(?:Tj|TJ)(?=\s|$)/g) || []).length;
  const imagenes = (contenido.match(/\/\w+\s+Do(?=\s|$)/g) || []).length;

  let estado = 'con contenido';
  if (textos === 0 && imagenes === 0) { estado = '>>> VACIA <<<'; vacias.push(i + 1); }
  else if (textos === 0) estado = `solo imagen (${imagenes})`;

  console.log(`${String(i + 1).padStart(4)}   ${String(textos).padStart(6)}   ${String(imagenes).padStart(8)}   ${estado}`);
});

console.log('');
console.log(vacias.length ? `PAGINAS VACIAS: ${vacias.join(', ')}` : '✓ Ninguna pagina vacia');
