// Extrae y revisa el texto de los PDF generados: busca mojibake, placeholders sin
// resolver y restos de iconos. El texto de un PDF de Chrome esta comprimido, pero los
// titulos del marcador de pagina suelen quedar legibles; para una revision fiable se
// inspecciona el HTML de origen, que es lo que realmente se convirtio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const DOC = path.join(RAIZ, 'documentacion');

const EVID = [
  ['E1', 'E1_Modelo_Entidad_Relacion', 'MER'],
  ['E2', 'E2_Diccionario_de_Datos', 'Diccionario'],
  ['E3', 'E3_ERS_IEEE830', 'ERS'],
  ['E4', 'E4_Matriz_Propiedad_Intelectual', 'Propiedad intelectual'],
  ['E5', 'E5_Contrato_Licencia_Software', 'Contrato'],
  ['E6', 'E6_Matriz_Trazabilidad', 'Trazabilidad'],
  ['E7', 'E7_Pruebas_Integracion', 'Pruebas'],
];

const PROBLEMAS = [
  ['mojibake', /Ã|Â|â€/g],
  ['undefined', /(?<![A-Za-z])(undefined|NaN)(?![A-Za-z])/g],
  ['iconos del tema', /[📊👥📦🧾📄💳🔖⚖️📈🔐🛡️💰👤🛒🗂️📁✅⚠️🔴🟡🔵🐛]/g],
  ['etiqueta sin cerrar', /<\/?(?:div|table|tr|td|th|span|h1|h2|h3|p|pre|code)[^>]*$/gm],
];

console.log('Documento                       Mojibake  Sin resolver  Iconos  Marcadores');
console.log('─'.repeat(76));

let total = 0;
for (const [id, base, nombre] of EVID) {
  const h = fs.readFileSync(path.join(DOC, `${base}.html`), 'utf8');
  const res = PROBLEMAS.map(([, re]) => (h.match(re) || []).length);
  const marcadores = (h.match(/class="placeholder"/g) || []).length;
  total += res[0] + res[1] + res[2];
  console.log(
    `  ${id} ${nombre.padEnd(24)} ${String(res[0]).padStart(7)} ${String(res[1]).padStart(12)} ${String(res[2]).padStart(7)} ${String(marcadores).padStart(11)}`,
  );
}

console.log(`\n${total === 0 ? '✓ Ningún problema de texto en los 7 documentos' : `⚠ ${total} problema(s) de texto`}`);
process.exit(total ? 1 : 0);
