/**
 * Evidencia 1 · Modelo Entidad-Relación (MER)
 *
 * Dibuja el diagrama como SVG a partir del esquema REAL extraido de la base de
 * datos (deep-docs/_esquema.json): entidades, atributos, PK, FK y cardinalidades.
 * No se inventa ninguna entidad: las 12 tablas y la vista son las que existen.
 *
 * Uso (desde la raiz):  node documentacion/_generador/01-mer.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { html, portada, escribir, tabla, RAIZ } from './tema.mjs';

// RAIZ es una ruta nativa de Windows, así que se combina con path.join (no con new URL).
const esquema = JSON.parse(fs.readFileSync(path.join(RAIZ, 'deep-docs', '_esquema.json'), 'utf8'));

// ============================================================
// 1. Construir el modelo a partir del esquema
// ============================================================
const tablas = [...new Set(esquema.columnas.map((c) => c.table_name))];
const pk = (t) => esquema.pks.find((p) => p.table_name === t)?.column_name;
const fkDe = (t) => esquema.fks.filter((f) => f.table_name === t);
const esFk = (t, c) => fkDe(t).some((f) => f.column_name === c);

// Notacion de las relaciones que no se leen directamente de la FK
// (una FK dice "muchos hijos"; el "0..1" o "padre obligatorio" hay que declararlo).
const CARD = {
  'usuarios.rol_id': 'N:1',                       // muchos usuarios por rol
  'usuario_cliente.cliente_id': '1:0..1',         // cliente_id es UNICO -> como mucho una cuenta
  'pedidos.cliente_id': '1:N',
  'detalle_pedido.pedido_id': '1:1..N',           // un pedido sin lineas no tendria sentido
  'detalle_pedido.producto_id': 'N:1',
  'facturas.pedido_id': '1:0..N',                 // varias facturas, una sola ACTIVA
  'facturas.cliente_id': '1:N',
  'facturas.usuario_anulacion': 'N:0..1',
  'pagos.factura_id': '1:N',
  'pagos.usuario_id': 'N:0..1',
  'pagos.usuario_cliente_id': 'N:0..1',
  'notas_credito.factura_id': '1:N',
  'notas_credito.cliente_id': '1:N',
  'notas_credito.usuario_id': 'N:0..1',
  'notas_credito.usuario_anulacion': 'N:0..1',
  'recuperaciones_clave.usuario_cliente_id': '1:N',
};

// Entidades destacadas (las del nucleo del negocio) frente a las de apoyo.
const NUCLEO = ['clientes', 'pedidos', 'detalle_pedido', 'facturas', 'pagos', 'productos'];
const APOYO = ['usuarios', 'usuario_cliente', 'notas_credito', 'roles', 'auditoria', 'recuperaciones_clave'];

const ETIQUETA = {
  roles: 'Catálogo de roles',
  usuarios: 'Personal interno',
  clientes: 'Clientes',
  usuario_cliente: 'Acceso del cliente al portal',
  productos: 'Catálogo de productos',
  pedidos: 'Pedidos',
  detalle_pedido: 'Líneas del pedido',
  facturas: 'Facturas',
  pagos: 'Pagos',
  notas_credito: 'Notas de crédito',
  auditoria: 'Auditoría',
  recuperaciones_clave: 'Solicitudes OTP',
};

// Disposicion en 4 columnas, pensada para que las lineas sean cortas y legibles.
let columnas = [
  ['roles', 'usuarios', 'usuario_cliente', 'clientes'],
  ['productos', 'detalle_pedido', 'pedidos'],
  ['facturas', 'notas_credito'],
  ['pagos', 'auditoria', 'recuperaciones_clave'],
];
const COL = { x: [30, 300, 570, 840], w: 240 };
const cabecera = 30;
const altoFila = 15;
const relleno = 10;

const geo = {};
for (let i = 0; i < columnas.length; i++) {
  let y = 20;
  for (const t of columnas[i]) {
    const cols = esquema.columnas.filter((c) => c.table_name === t);
    const h = cabecera + relleno + cols.length * altoFila + 6;
    geo[t] = { x: COL.x[i], y, w: COL.w, h, cols };
    y += h + 24;
  }
}

const ANCHO = 1100;
// La altura se calcula a partir de la columna mas larga: asi no queda un hueco vacio.
const altoColumnas = columnas.map((col) => col.reduce((s, t) => s + geo[t].h + 24, 0));
const ALTO = Math.ceil(Math.max(...altoColumnas)) + 120;

// Diagnostico: si alguna entidad no quedo situada, el diagrama saldria roto.
{
  const faltan = tablas.filter((t) => !geo[t]);
  if (faltan.length) throw new Error(`Sin geometria: ${faltan.join(', ')}`);
  console.log(`  diagrama: ${Object.keys(geo).length} entidades situadas, alto ${ALTO}`);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Entidades ----------
function dibujarEntidad(t) {
  const g = geo[t];
  const esNucleo = NUCLEO.includes(t);
  const color = esNucleo ? '#1e3a8a' : '#64748b';
  const p = [];
  p.push('<g>');
  // Caja. Se dibuja la cabecera como un rectangulo recto pegado al borde superior:
  // usar un <path> con arcos se perdia al rasterizar.
  p.push(`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="7" fill="#ffffff" stroke="${color}" stroke-width="${esNucleo ? 2 : 1.2}"/>`);
  p.push(`<rect x="${g.x + 1}" y="${g.y + 1}" width="${g.w - 2}" height="${cabecera - 1}" rx="6" fill="${color}"/>`);
  p.push(`<rect x="${g.x + 1}" y="${g.y + cabecera - 8}" width="${g.w - 2}" height="7" fill="${color}"/>`);
  p.push(`<text x="${g.x + 10}" y="${g.y + 20}" font-size="11.5" font-weight="700" fill="#ffffff" dominant-baseline="middle">${esc(t)}</text>`);
  p.push(`<text x="${g.x + g.w - 9}" y="${g.y + 20}" font-size="7.6" fill="#e2e8f0" text-anchor="end" dominant-baseline="middle">${esc(ETIQUETA[t] || '')}</text>`);

  let y = g.y + cabecera + relleno;
  for (const c of g.cols) {
    const esPk = c.column_name === pk(t);
    const esFkCol = esFk(t, c.column_name);
    if (esPk) p.push(`<rect x="${g.x + 1.5}" y="${y - 8.5}" width="${g.w - 3}" height="15" fill="#dbeafe" opacity="0.8"/>`);
    if (esPk || esFkCol) {
      const colorMarca = esPk ? '#1e3a8a' : '#6d28d9';
      p.push(`<text x="${g.x + 8}" y="${y}" font-size="7.2" font-weight="700" fill="${colorMarca}" dominant-baseline="middle">${esPk ? 'PK' : 'FK'}</text>`);
    }
    p.push(`<text x="${g.x + 26}" y="${y}" font-size="8.6" fill="#0f172a" font-family="Cascadia Mono,Consolas,monospace" dominant-baseline="middle" ${esPk ? 'font-weight="700"' : ''}>${esc(c.column_name)}</text>`);
    p.push(`<text x="${g.x + g.w - 8}" y="${y}" font-size="7.2" fill="#94a3b8" text-anchor="end" font-family="Cascadia Mono,Consolas,monospace" dominant-baseline="middle">${esc(tipoCorto(c))}</text>`);
    y += altoFila;
  }
  p.push('</g>');
  return p.join('\n');
}

function tipoCorto(c) {
  const d = c.data_type;
  if (d === 'integer') return 'int';
  if (d === 'character varying') return `varchar(${c.character_maximum_length})`;
  if (d === 'numeric') return `num(${c.numeric_precision},${c.numeric_scale})`;
  if (d === 'timestamp with time zone') return 'timestamptz';
  if (d === 'boolean') return 'bool';
  if (d === 'date') return 'date';
  if (d === 'text') return 'text';
  return d;
}

// ---------- Anclas para las lineas ----------
/**
 * Punto de anclaje en el borde izquierdo o derecho de una entidad.
 *
 * `indice`/`total` reparten las anclas a distintas alturas para que varias
 * relaciones que salen de la misma entidad no se dibujen encima unas de otras.
 */
function anclaY(t, lado, indice, total) {
  const g = geo[t];
  if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.w)) {
    throw new Error(`Geometria no definida para la entidad "${t}"`);
  }
  const margen = 14;
  const util = Math.max(g.h - margen * 2, 1);
  const n = Number.isFinite(total) && total > 1 ? total : 1;
  const i = Number.isFinite(indice) ? indice : 0;
  const y = g.y + margen + (n <= 1 ? util / 2 : (util * i) / (n - 1));
  const x = lado === 'izq' ? g.x : g.x + g.w;
  return { x, y };
}

function ruta(a, b) {
  // Curva suave: los puntos de control salen en horizontal para que las lineas
  // no atraviesen las cajas.
  const dx = Math.max(Math.abs(b.x - a.x) * 0.45, 24);
  const haciaA = b.x >= a.x ? dx : -dx;
  const haciaB = b.x >= a.x ? -dx : dx;
  return `M${a.x} ${a.y} C${a.x + haciaA} ${a.y} ${b.x + haciaB} ${b.y} ${b.x} ${b.y}`;
}

// ---------- Simbolos de cardinalidad (notacion pata de gallo) ----------
function pataGallo(p, angulo) {
  // Tres lineas divergentes desde el punto de anclaje
  const g = [];
  for (const off of [-5, 0, 5]) {
    const rad = ((angulo + off) * Math.PI) / 180;
    const x2 = p.x + Math.cos(rad) * 13;
    const y2 = p.y + Math.sin(rad) * 13;
    g.push(`<line x1="${p.x}" y1="${p.y}" x2="${x2}" y2="${y2}" stroke="#334155" stroke-width="1.3"/>`);
  }
  return g.join('');
}

function uno(p, angulo) {
  // Barra perpendicular: "exactamente uno"
  const rad = (angulo * Math.PI) / 180;
  const dx = Math.cos(rad) * 8;
  const dy = Math.sin(rad) * 8;
  const px = -dy * 0.55;
  const py = dx * 0.55;
  return `<line x1="${p.x - px}" y1="${p.y - py}" x2="${p.x + px}" y2="${p.y + py}" stroke="#334155" stroke-width="1.6"/>`;
}

function circulo(p) {
  return `<circle cx="${p.x}" cy="${p.y}" r="3.6" fill="#ffffff" stroke="#334155" stroke-width="1.3"/>`;
}

// ---------- Relaciones ----------
// Se declaran a mano los extremos para que el trazado sea legible (el MER es un
// diagrama de diseno, no un volcado automatico del catalogo).
const RELACIONES = [
  { de: 'roles', a: 'usuarios', card: '1:N', nota: 'un rol agrupa a varios usuarios' },
  { de: 'clientes', a: 'usuario_cliente', card: '1:0..1', nota: 'el cliente puede tener una cuenta de portal' },
  { de: 'clientes', a: 'pedidos', card: '1:N', nota: 'un cliente hace varios pedidos' },
  { de: 'pedidos', a: 'detalle_pedido', card: '1:1..N', nota: 'un pedido tiene una o más líneas' },
  { de: 'productos', a: 'detalle_pedido', card: '1:N', nota: 'un producto aparece en varias líneas' },
  { de: 'pedidos', a: 'facturas', card: '1:0..N', nota: 'solo una factura ACTIVA a la vez' },
  { de: 'clientes', a: 'facturas', card: '1:N', nota: 'un cliente acumula facturas' },
  { de: 'facturas', a: 'pagos', card: '1:N', nota: 'una factura recibe varios pagos' },
  { de: 'facturas', a: 'notas_credito', card: '1:N', nota: 'una factura puede tener devoluciones' },
  { de: 'clientes', a: 'notas_credito', card: '1:N', nota: 'la devolución también apunta al cliente' },
  { de: 'usuario_cliente', a: 'recuperaciones_clave', card: '1:N', nota: 'solicitudes de OTP de esa cuenta' },
  { de: 'usuario_cliente', a: 'pagos', card: '1:0..N', nota: 'pagos hechos desde el portal (puede no haber ninguno)' },
];

// Emparejamos cada relacion con su FK para saber que columna la origina.
function buscarFk(de, a) {
  return esquema.fks.find((f) => f.table_name === a && f.tabla_referenciada === de);
}

function dibujarRelaciones() {
  // Se agrupan las relaciones por (entidad, lado). Dentro de cada grupo se reparten
  // verticalmente para que las lineas no se dibujen unas encima de otras.
  const porLado = new Map();
  const clave = (t, lado) => `${t}|${lado}`;

  const items = RELACIONES.map((r) => {
    const desde = geo[r.de];
    const hasta = geo[r.a];
    if (!desde || !hasta) throw new Error(`Relacion con entidad desconocida: ${r.de} -> ${r.a}`);
    const ladoDe = desde.x < hasta.x ? 'der' : 'izq';
    const ladoA = desde.x < hasta.x ? 'izq' : 'der';
    const fk = buscarFk(r.de, r.a);
    const item = { r, ladoDe, ladoA, fk, iDe: 0, iA: 0 };
    for (const [t, lado] of [[r.de, ladoDe], [r.a, ladoA]]) {
      const k = clave(t, lado);
      if (!porLado.has(k)) porLado.set(k, []);
      porLado.get(k).push(item);
    }
    return item;
  });

  // Asignar indice dentro de cada grupo
  for (const [k, lista] of porLado) {
    const [t, lado] = k.split('|');
    lista.forEach((item, i) => {
      if (lado === 'der') { if (item.r.de === t && item.ladoDe === 'der') item.iDe = i; if (item.r.a === t && item.ladoA === 'der') item.iA = i; }
      if (lado === 'izq') { if (item.r.de === t && item.ladoDe === 'izq') item.iDe = i; if (item.r.a === t && item.ladoA === 'izq') item.iA = i; }
    });
  }

  const svg = [];
  // Las lineas van primero para que queden por debajo de las cajas.
  for (const it of items) {
    const nDe = porLado.get(clave(it.r.de, it.ladoDe)).length;
    const nA = porLado.get(clave(it.r.a, it.ladoA)).length;
    const a = anclaY(it.r.de, it.ladoDe, it.iDe, nDe);
    const b = anclaY(it.r.a, it.ladoA, it.iA, nA);
    const puntos = [a.x, a.y, b.x, b.y];
    if (!puntos.every(Number.isFinite)) {
      throw new Error(`Anclas invalidas en ${it.r.de} -> ${it.r.a}: ${JSON.stringify({ a, b, nDe, nA })}`);
    }

    const d = ruta(a, b);
    if (/NaN|undefined|null/.test(d)) throw new Error(`Ruta invalida en ${it.r.de} -> ${it.r.a}: ${d}`);

    svg.push(`<path d="${d}" fill="none" stroke="#94a3b8" stroke-width="1.4"/>`);

    // Simbolos de cardinalidad en los dos extremos
    const anguloDe = it.ladoDe === 'der' ? 0 : 180;
    const anguloA = it.ladoA === 'der' ? 0 : 180;
    svg.push(uno(a, anguloDe));
    svg.push(pataGallo(b, anguloA));
    if (it.r.card.includes('0..')) {
      const signo = it.ladoA === 'izq' ? 1 : -1;
      svg.push(circulo({ x: b.x + signo * 17, y: b.y }));
    }

    // Etiqueta con la cardinalidad. Se centra en el punto medio pero se mantiene
    // dentro del lienzo: si no, las relaciones que salen de la primera columna
    // dejaban la etiqueta fuera del area visible.
    const mxBruto = (a.x + b.x) / 2;
    const mx = Math.min(Math.max(mxBruto, 26), ANCHO - 26);
    const my = (a.y + b.y) / 2 - 3;
    svg.push(`<rect x="${mx - 18}" y="${my - 8}" width="36" height="12" rx="3" fill="#ffffff" opacity="0.92"/>`);
    svg.push(`<text x="${mx}" y="${my + 1}" font-size="7.6" font-weight="700" fill="#1e3a8a" text-anchor="middle" dominant-baseline="middle">${it.r.card}</text>`);
  }
  return svg.join('\n');
}

const leyenda = `
<g>
  <rect x="30" y="${ALTO - 96}" width="${ANCHO - 60}" height="86" rx="7" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="45" y="${ALTO - 76}" font-size="10" font-weight="700" fill="#1e3a8a" font-family="Segoe UI,Arial">Notación</text>
  <text x="45" y="${ALTO - 58}" font-size="8.6" fill="#334155" font-family="Segoe UI,Arial">
    <tspan font-weight="700" fill="#1e3a8a">PK</tspan> clave primaria · <tspan font-weight="700" fill="#6d28d9">FK</tspan> clave foránea · las entidades en azul oscuro son el núcleo del negocio y las grises dan soporte
  </text>
  <text x="45" y="${ALTO - 41}" font-size="8.6" fill="#334155" font-family="Segoe UI,Arial">
    <tspan font-weight="700">1</tspan> = exactamente uno (barra) · <tspan font-weight="700">N</tspan> = muchos (pata de gallo) · <tspan font-weight="700">0..1</tspan> = opcional · <tspan font-weight="700">0..N</tspan> = puede no existir ninguno
  </text>
  <text x="45" y="${ALTO - 24}" font-size="8.6" fill="#334155" font-family="Segoe UI,Arial">
    <tspan font-weight="700">1:0..1</tspan> clientes → usuario_cliente: el cliente puede tener cuenta de portal o no · <tspan font-weight="700">1:0..N</tspan> pedidos → facturas: varias facturas históricas, pero una sola ACTIVA
  </text>
</g>`;

const svgMER = `<svg viewBox="0 0 ${ANCHO} ${ALTO}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI,Arial">
  <rect width="${ANCHO}" height="${ALTO}" fill="#ffffff"/>
  <text x="30" y="14" font-size="12" font-weight="700" fill="#172554">Modelo Entidad-Relación · FINAN-X</text>
  ${dibujarRelaciones()}
  ${tablas.map(dibujarEntidad).join('\n')}
  ${leyenda}
</svg>`;

// ============================================================
// 2. Tablas de apoyo del documento
// ============================================================
const filasRelaciones = esquema.fks.map((f) => {
  const card = CARD[`${f.table_name}.${f.column_name}`] || 'N:1';
  return [
    { t: `<code>${f.table_name}</code>`, clase: '' },
    { t: `<code>${f.column_name}</code>` },
    { t: `${card}` },
    { t: `<code>${f.tabla_referenciada}</code>.<code>${f.columna_referenciada}</code>` },
    { t: f.delete_rule === 'CASCADE' ? '<span class="badge b-warn">ON DELETE CASCADE</span>' : '<span class="badge b-gray">restrictiva</span>' },
    { t: RELACIONES.find((r) => r.de === f.tabla_referenciada && r.a === f.table_name)?.nota || '—' },
  ];
});

const DESCRIPCION_TABLA = {
  roles: 'Catálogo de roles del personal interno; define los permisos (RBAC).',
  usuarios: 'Personal interno (administrador, facturador, cajero, supervisor).',
  clientes: 'Personas o empresas a las que se factura. Entidad central del negocio.',
  usuario_cliente: 'Credenciales de acceso del cliente al portal de autoservicio.',
  productos: 'Catálogo de artículos y servicios que se pueden vender.',
  pedidos: 'Documento interno con lo que pidió un cliente, antes de facturarse.',
  detalle_pedido: 'Líneas del pedido: resuelve el N:M entre pedidos y productos y congela el precio aplicado.',
  facturas: 'Documento de cobro generado desde un pedido confirmado.',
  pagos: 'Abonos contra una factura; nunca se borran ni se editan.',
  notas_credito: 'Devoluciones; una nota activa aumenta el saldo de la factura.',
  auditoria: 'Bitácora de operaciones sensibles.',
  recuperaciones_clave: 'Solicitudes de código de un solo uso (OTP) para recuperar la contraseña.',
};

const filasEntidades = tablas.map((t) => [
  { t: `<code>${t}</code>` },
  { t: ETIQUETA[t] },
  { t: String(esquema.columnas.filter((c) => c.table_name === t).length), clase: 'c' },
  { t: NUCLEO.includes(t) ? '<span class="badge b-info">núcleo</span>' : '<span class="badge b-gray">soporte</span>' },
  { t: fkDe(t).length ? fkDe(t).map((f) => `<code>${f.column_name}</code>`).join(', ') : '—' },
  { t: DESCRIPCION_TABLA[t] },
]);

const cuerpo = `
${portada({
  evidencia: 'Evidencia 1 de 7',
  titulo: 'Modelo Entidad-Relación (MER)',
  descripcion: 'Estructura de datos del sistema FINAN-X: entidades, atributos, claves primarias y foráneas, relaciones y cardinalidades. El modelo se ha extraído de la base de datos PostgreSQL realmente implementada, no de un diseño teórico.',
  meta: [
    ['Sistema', 'FINAN-X · Facturación y pagos'],
    ['Motor de base de datos', 'PostgreSQL 16'],
    ['Entidades (tablas)', `${tablas.length}`],
    ['Columnas documentadas', `${esquema.columnas.length}`],
    ['Claves foráneas', `${esquema.fks.length}`],
    ['Vistas', `${esquema.vistas.length} (factura_saldo)`],
  ],
})}

<h1>1. Introducción</h1>
<p>Este documento describe <strong>cómo se organiza y almacena la información</strong> que necesita FINAN-X. Responde a la pregunta guía de la evidencia: <em>¿cómo vamos a organizar y almacenar la información que necesita nuestra aplicación?</em></p>
<p>El modelo no es teórico: se ha <strong>extraído de la base de datos en funcionamiento</strong>. Las entidades, las columnas, las claves y las restricciones son exactamente las que existen en PostgreSQL 16, de modo que este MER, el diccionario de datos (Evidencia 2) y la implementación no pueden contradecirse.</p>

<div class="caja">
  <span class="titulo">Criterio de diseño aplicado</span>
  <p>No se ha creado ninguna entidad «para llenar el diagrama». Cada tabla responde a una necesidad concreta del negocio y se puede rastrear hasta un requisito funcional (ver la matriz de trazabilidad, Evidencia 6).</p>
</div>

<h1>2. Entidades</h1>
<p>El sistema tiene <strong>${tablas.length} tablas</strong> y <strong>1 vista</strong>. Se distinguen dos grupos:</p>
<ul>
  <li><strong>Núcleo del negocio</strong> (azul oscuro): el ciclo de venta y cobro — <code>clientes</code>, <code>productos</code>, <code>pedidos</code>, <code>detalle_pedido</code>, <code>facturas</code> y <code>pagos</code>.</li>
  <li><strong>Soporte</strong> (gris): lo que hace funcionar ese ciclo con seguridad y trazabilidad — <code>roles</code>, <code>usuarios</code>, <code>usuario_cliente</code>, <code>notas_credito</code>, <code>auditoria</code> y <code>recuperaciones_clave</code>.</li>
</ul>

${tabla(
  ['Entidad', 'Qué representa', { t: 'Cols.', clase: 'c' }, 'Grupo', 'Claves foráneas', 'Justificación en el sistema'],
  filasEntidades,
)}

<div class="caja purple">
  <span class="titulo">La vista <code>factura_saldo</code>: por qué el saldo no es una columna</span>
  <p>El estado de cobro de una factura <strong>no se almacena</strong>, se calcula. La vista lo deriva de los pagos y de las notas de crédito activas: <code>saldo = total − Σ pagos + Σ notas de crédito ACTIVAS</code>. Si el saldo fuera una columna habría que mantenerlo sincronizado con cada pago, cada devolución y cada anulación; derivarlo hace que <strong>no pueda desincronizarse</strong>. Es una decisión de diseño deliberada, no una omisión.</p>
</div>

<h1>3. Diagrama entidad-relación</h1>
<p>Notación <strong>pata de gallo</strong> (crow's foot). Las claves primarias aparecen resaltadas y marcadas con <span class="badge b-info">PK</span>; las foráneas, con <span class="badge b-purple">FK</span>.</p>

<div class="evitar-corte" style="border:1px solid #e2e8f0; border-radius:8px; padding:6px; margin:8px 0; background:#fff">
${svgMER}
</div>

<div class="salto"></div>
<h1>4. Relaciones y cardinalidades</h1>
<p>Se han documentado <strong>${esquema.fks.length} relaciones</strong> mediante claves foráneas. La columna «Cardinalidad» indica el sentido de la relación leído desde la entidad padre hacia la hija.</p>

${tabla(
  ['Entidad hija', 'Columna FK', { t: 'Card.', clase: 'c' }, 'Referencia a', 'Al borrar el padre', 'Qué significa'],
  filasRelaciones,
)}

<h2>4.1 Relaciones que no se deducen solo de la clave foránea</h2>
<p>Una clave foránea indica «muchos hijos», pero no si el hijo es obligatorio ni si el padre admite varios. Estas dos reglas se aplican en el código y merecen explicitarse:</p>

<div class="grid2">
  <div class="caja ok">
    <span class="titulo">clientes 1 : 0..1 usuario_cliente</span>
    <p>Un cliente <strong>puede</strong> tener cuenta en el portal o no (por eso «0..1»). Lo garantiza la restricción <code>UNIQUE</code> sobre <code>usuario_cliente.cliente_id</code>: la base de datos impide por sí sola que un cliente tenga dos cuentas.</p>
  </div>
  <div class="caja ok">
    <span class="titulo">pedidos 1 : 0..N facturas</span>
    <p>Un pedido puede tener varias facturas a lo largo del tiempo (si una se anula y se vuelve a emitir), pero <strong>solo una ACTIVA</strong>. Lo impone el índice único parcial <code>uq_factura_activa_por_pedido</code>, no solo el código de la aplicación.</p>
  </div>
</div>

<h1>5. Claves y restricciones</h1>
<p>Las claves no son solo identificadores: son <strong>reglas de negocio aplicadas por la base de datos</strong>. Si el código de la aplicación fallara, la base sigue impidiendo los datos incoherentes.</p>

<div class="grid3">
  <div class="kpi"><div class="n">${esquema.pks.length}</div><div class="t">Claves primarias</div></div>
  <div class="kpi"><div class="n">${esquema.fks.length}</div><div class="t">Claves foráneas</div></div>
  <div class="kpi"><div class="n">${esquema.uniques.length}</div><div class="t">Restricciones UNIQUE</div></div>
  <div class="kpi"><div class="n">${esquema.checks.length}</div><div class="t">Restricciones CHECK</div></div>
  <div class="kpi"><div class="n">${esquema.indices.length}</div><div class="t">Índices</div></div>
  <div class="kpi"><div class="n">${esquema.vistas.length}</div><div class="t">Vistas</div></div>
</div>

<h2>5.1 Restricciones CHECK: los valores válidos viven en la base</h2>
<p>Cada columna de estado tiene una lista cerrada de valores permitidos. Así es imposible guardar, por ejemplo, un pedido en un estado que el sistema no sepa interpretar (lo que rompería los filtros y los informes).</p>

${tabla(
  ['Tabla', 'Restricción', 'Valores permitidos'],
  esquema.checks.map((c) => {
    const m = c.definicion.match(/IN \(([^)]+)\)/);
    const valores = m ? m[1].split(',').map((v) => `<code>${v.trim().replace(/'/g, '')}</code>`).join(' · ') : c.definicion;
    return [{ t: `<code>${c.table_name}</code>` }, { t: `<code>${c.constraint_name}</code>` }, { t: valores }];
  }),
  { compacta: true },
)}

<h2>5.2 Restricciones UNIQUE: qué no puede repetirse</h2>
${tabla(
  ['Tabla', 'Columna', 'Restricción'],
  esquema.uniques.map((u) => [{ t: `<code>${u.table_name}</code>` }, { t: `<code>${u.column_name}</code>` }, { t: `<code>${u.constraint_name}</code>` }]),
  { compacta: true },
)}

<footer class="pie-doc">FINAN-X · Evidencia 1 de 7 · Modelo Entidad-Relación · Generado a partir del esquema real de PostgreSQL 16 (${tablas.length} tablas, ${esquema.columnas.length} columnas).</footer>
`;

escribir('E1_Modelo_Entidad_Relacion.html', html({ titulo: 'FINAN-X · Modelo Entidad-Relación', cuerpo }));
