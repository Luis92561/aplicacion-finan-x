/**
 * Evidencia 2 · Diccionario de datos
 *
 * Documenta cada campo de la base de datos con: tipo, longitud, si es clave
 * primaria o foránea, si es obligatorio y su descripción.
 *
 * Los datos (tipo, longitud, PK, FK, obligatoriedad) se EXTRAEN de PostgreSQL,
 * y las descripciones de negocio se mantienen en deep-docs/_descripciones.json.
 * Así el diccionario coincide con el MER y con la base implementada, que es lo
 * que exige la evidencia.
 *
 * Uso (desde la raiz):  node documentacion/_generador/02-diccionario.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { html, portada, escribir, tabla, RAIZ } from './tema.mjs';

const esquema = JSON.parse(fs.readFileSync(path.join(RAIZ, 'deep-docs', '_esquema.json'), 'utf8'));
const DESC = JSON.parse(fs.readFileSync(path.join(RAIZ, 'deep-docs', '_descripciones.json'), 'utf8'));

const tablas = [...new Set(esquema.columnas.map((c) => c.table_name))];

const ORDEN = [
  'roles', 'usuarios', 'clientes', 'usuario_cliente', 'productos',
  'pedidos', 'detalle_pedido', 'facturas', 'pagos', 'notas_credito',
  'auditoria', 'recuperaciones_clave',
];
const ordenadas = [...tablas].sort((a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b));

const esPk = (t, c) => esquema.pks.some((p) => p.table_name === t && p.column_name === c);
const fkDe = (t, c) => esquema.fks.find((f) => f.table_name === t && f.column_name === c);

/** Longitud legible: varchar(150), numeric(14,2), o — si no aplica. */
function longitud(c) {
  if (c.data_type === 'character varying') return String(c.character_maximum_length);
  if (c.data_type === 'numeric') return `${c.numeric_precision},${c.numeric_scale}`;
  if (c.data_type === 'integer') return '—';
  if (c.data_type === 'text') return '—';
  if (c.data_type === 'boolean') return '—';
  if (c.data_type === 'date') return '—';
  if (c.data_type === 'timestamp with time zone') return '—';
  return '—';
}

function tipoLegible(c) {
  const m = {
    integer: 'INT',
    'character varying': 'VARCHAR',
    numeric: 'NUMERIC',
    text: 'TEXT',
    boolean: 'BOOLEAN',
    date: 'DATE',
    'timestamp with time zone': 'TIMESTAMPTZ',
  };
  return m[c.data_type] || c.data_type.toUpperCase();
}

const totalColumnas = esquema.columnas.length;
const totalPk = esquema.pks.length;
const totalFk = esquema.fks.length;
const totalObligatorias = esquema.columnas.filter((c) => c.is_nullable === 'NO').length;

// ---------- Secciones por entidad ----------
function seccionEntidad(t, indice) {
  const cols = esquema.columnas.filter((c) => c.table_name === t);
  const filas = cols.map((c) => {
    const pk = esPk(t, c.column_name);
    const fk = fkDe(t, c.column_name);
    const ref = fk ? ` <code>${fk.tabla_referenciada}.${fk.columna_referenciada}</code>` : '';
    return [
      { t: `<code>${c.column_name}</code>` },
      { t: tipoLegible(c) },
      { t: longitud(c), clase: 'c' },
      { t: pk ? '<span class="badge b-info">Sí</span>' : '<span class="badge b-gray">No</span>', clase: 'c' },
      { t: fk ? `<span class="badge b-purple">Sí</span>${ref}` : '<span class="badge b-gray">No</span>', clase: fk ? '' : 'c' },
      { t: c.is_nullable === 'NO' ? '<span class="badge b-warn">Sí</span>' : '<span class="badge b-gray">No</span>', clase: 'c' },
      { t: DESC[`${t}.${c.column_name}`] || '—' },
    ];
  });

  return `
<h3>${indice}. <code>${t}</code></h3>
<p>${DESC[`__tabla__.${t}`] || ''}</p>
${tabla(
    ['Campo', 'Tipo', { t: 'Long.', clase: 'c' }, { t: 'PK', clase: 'c' }, { t: 'FK', clase: 'c' }, { t: 'Oblig.', clase: 'c' }, 'Descripción'],
    filas,
    { compacta: true },
  )}`;
}

// ---------- Índice de entidades ----------
const filasIndice = ordenadas.map((t) => {
  const cols = esquema.columnas.filter((c) => c.table_name === t);
  const pks = cols.filter((c) => esPk(t, c.column_name)).map((c) => c.column_name);
  const fks = esquema.fks.filter((f) => f.table_name === t).length;
  return [
    { t: `<code>${t}</code>` },
    { t: DESC[`__tabla__.${t}`] || '—' },
    { t: String(cols.length), clase: 'c' },
    { t: pks.map((p) => `<code>${p}</code>`).join(', ') },
    { t: String(fks), clase: 'c' },
    { t: String(cols.filter((c) => c.is_nullable === 'NO').length), clase: 'c' },
  ];
});

// ---------- Vista ----------
const colsVista = [
  ['factura_id', 'INT', '—', 'Clave primaria de la vista (la de la factura)'],
  ['numero_factura', 'VARCHAR', '20', 'Número legible de la factura'],
  ['pedido_id', 'INT', '—', 'Pedido del que nació la factura'],
  ['cliente_id', 'INT', '—', 'Cliente al que se le cobra'],
  ['fecha_emision', 'TIMESTAMPTZ', '—', 'Fecha de emisión'],
  ['fecha_vencimiento', 'DATE', '—', 'Fecha límite de pago'],
  ['subtotal', 'FLOAT8', '—', 'Subtotal de la factura'],
  ['impuestos', 'FLOAT8', '—', 'Impuestos de la factura'],
  ['total', 'FLOAT8', '—', 'Total facturado'],
  ['valor_pagado', 'FLOAT8', '—', 'Suma de todos los pagos recibidos'],
  ['saldo', 'FLOAT8', '—', 'total − valor_pagado + notas de crédito activas'],
  ['estado', 'VARCHAR', '20', 'ACTIVA o ANULADA'],
  ['estado_pago', 'VARCHAR', '—', 'Calculado: PENDIENTE, PAGO_PARCIAL, PAGADA o ANULADA'],
  ['motivo_anulacion', 'TEXT', '—', 'Motivo, si la factura está anulada'],
  ['fecha_anulacion', 'TIMESTAMPTZ', '—', 'Fecha de anulación, si procede'],
  ['notas_credito', 'FLOAT8', '—', 'Suma de las notas de crédito ACTIVAS'],
];

const cuerpo = `
${portada({
  evidencia: 'Evidencia 2 de 7',
  titulo: 'Diccionario de datos',
  descripcion: `Definición precisa de los ${totalColumnas} campos que componen la base de datos de FINAN-X. Para cada uno se indica su tipo, longitud, si es clave primaria o foránea, si es obligatorio y qué representa en el negocio.`,
  meta: [
    ['Sistema', 'FINAN-X · Facturación y pagos'],
    ['Entidades documentadas', `${ordenadas.length} tablas + 1 vista`],
    ['Campos documentados', `${totalColumnas + colsVista.length}`],
    ['Claves primarias', `${totalPk}`],
    ['Claves foráneas', `${totalFk}`],
    ['Campos obligatorios (NOT NULL)', `${totalObligatorias}`],
  ],
})}

<h1>1. Propósito y método</h1>
<p>Este diccionario define <strong>cada campo</strong> que utiliza FINAN-X. Responde a la pregunta de la evidencia: <em>¿qué significa exactamente cada dato que guardamos?</em></p>
<p>Los datos técnicos —tipo, longitud, clave primaria, clave foránea y obligatoriedad— <strong>no se han escrito a mano</strong>: se extraen de la base de datos PostgreSQL en funcionamiento. Las descripciones de negocio se mantienen junto al código y se validan contra el esquema, de modo que <strong>no puede existir una columna sin documentar ni una descripción que hable de un campo inexistente</strong>. Si alguien añade una columna y no la describe, el generador avisa.</p>

<div class="caja">
  <span class="titulo">Convenciones de este documento</span>
  <ul style="margin-bottom:0">
    <li><strong>Tipo</strong>: tipo real en PostgreSQL. <code>NUMERIC(14,2)</code> equivale a un decimal con 14 dígitos, 2 de ellos decimales.</li>
    <li><strong>Long.</strong>: longitud máxima. Para <code>NUMERIC</code> se indica precisión y escala.</li>
    <li><strong>PK</strong>: forma parte de la clave primaria. <strong>FK</strong>: es clave foránea; se indica a qué campo apunta.</li>
    <li><strong>Oblig.</strong>: si el campo admite <code>NULL</code> o no.</li>
    <li>Los identificadores son <code>SERIAL</code>: enteros que genera automáticamente la base de datos.</li>
    <li>Las fechas son <code>TIMESTAMPTZ</code> (con zona horaria), salvo <code>fecha_vencimiento</code>, que es una fecha sin hora.</li>
  </ul>
</div>

<h1>2. Panorama de las entidades</h1>
${tabla(
  ['Entidad', 'Qué representa', { t: 'Campos', clase: 'c' }, 'Clave primaria', { t: 'FK', clase: 'c' }, { t: 'Oblig.', clase: 'c' }],
  filasIndice,
)}

<div class="grid3">
  <div class="kpi"><div class="n">${ordenadas.length}</div><div class="t">Tablas</div></div>
  <div class="kpi"><div class="n">${totalColumnas}</div><div class="t">Campos en tablas</div></div>
  <div class="kpi"><div class="n">${colsVista.length}</div><div class="t">Campos en la vista</div></div>
</div>

<div class="salto"></div>
<h1>3. Diccionario por entidad</h1>
<p>Las entidades aparecen en orden funcional: primero quién usa el sistema, después el ciclo de venta y cobro, y por último las tablas de soporte.</p>
${ordenadas.map((t, i) => seccionEntidad(t, `3.${i + 1}`)).join('\n')}

<div class="salto"></div>
<h1>4. La vista <code>factura_saldo</code></h1>
<p>No es una tabla: es una <strong>vista</strong>, un cálculo que la base de datos resuelve en el momento de consultarla. El estado de cobro de una factura <strong>no se almacena</strong> y por eso no puede quedar desincronizado con los pagos.</p>

<div class="caja purple">
  <span class="titulo">Fórmula del saldo</span>
  <pre><code>saldo = total − Σ(pagos) + Σ(notas de crédito ACTIVAS)</code></pre>
  <p style="margin-bottom:0">Las notas de crédito <strong>suman</strong> al saldo: al devolver dinero, ese pago se revierte y la factura vuelve a deberlo. El estado de pago (<code>estado_pago</code>) se deriva de la misma fórmula: si el saldo es cero o menos, está PAGADA; si no se ha pagado nada, PENDIENTE; en otro caso, PAGO_PARCIAL.</p>
</div>

${tabla(
  ['Campo', 'Tipo', { t: 'Long.', clase: 'c' }, 'Descripción'],
  colsVista.map(([c, t, l, d]) => [{ t: `<code>${c}</code>` }, { t }, { t: l, clase: 'c' }, { t: d }]),
  { compacta: true },
)}

<div class="caja warn">
  <span class="titulo">Detalle de implementación que conviene conocer</span>
  <p style="margin-bottom:0">Los pagos y las notas de crédito se agregan en <strong>subconsultas independientes</strong>. Hacerlo con dos <code>LEFT JOIN</code> a la vez sobre la misma factura produce el <em>producto cartesiano</em> de ambos conjuntos (P pagos × N notas = P×N filas) y multiplicaría las sumas, dejando el saldo mal. Este error existió y se corrigió; está documentado con su prueba en la Evidencia 7.</p>
</div>

<h1>5. Reglas de integridad asociadas a los campos</h1>
<p>El diccionario no describe solo nombres y tipos: cada restricción es una <strong>regla de negocio que la base de datos hace cumplir</strong>.</p>

${tabla(
  ['Tipo de restricción', 'Cuántas', 'Qué garantiza', 'Ejemplo del proyecto'],
  [
    [{ t: 'Clave primaria' }, { t: String(esquema.pks.length), clase: 'c' }, { t: 'Cada fila es identificable de forma única' }, { t: '<code>facturas.factura_id</code>' }],
    [{ t: 'Clave foránea' }, { t: String(esquema.fks.length), clase: 'c' }, { t: 'No puede haber un hijo sin su padre' }, { t: '<code>pagos.factura_id</code> → <code>facturas</code>' }],
    [{ t: 'UNIQUE' }, { t: String(esquema.uniques.length), clase: 'c' }, { t: 'Un valor no puede repetirse' }, { t: '<code>clientes</code>: tipo + número de identificación' }],
    [{ t: 'CHECK' }, { t: String(esquema.checks.length), clase: 'c' }, { t: 'Solo se admiten valores de una lista cerrada' }, { t: '<code>facturas.estado</code> ∈ (ACTIVA, ANULADA)' }],
    [{ t: 'NOT NULL' }, { t: String(totalObligatorias), clase: 'c' }, { t: 'El dato es imprescindible' }, { t: '<code>facturas.total</code>' }],
    [{ t: 'Índice único parcial' }, { t: '1', clase: 'c' }, { t: 'Una regla condicional sobre un subconjunto de filas' }, { t: 'Como mucho <strong>una factura ACTIVA</strong> por pedido' }],
  ],
)}

<h1>6. Coherencia con los demás documentos</h1>
<ul>
  <li><strong>Evidencia 1 · MER</strong>: mismas entidades y mismas claves. El diagrama y este diccionario salen del mismo esquema extraído.</li>
  <li><strong>Evidencia 3 · ERS</strong>: los requisitos se refieren a estos campos (por ejemplo, «el pago no puede superar el saldo» usa <code>factura_saldo.saldo</code>).</li>
  <li><strong>Evidencia 6 · Trazabilidad</strong>: cada requisito queda ligado a su entidad.</li>
  <li><strong>Evidencia 7 · Pruebas</strong>: las restricciones de la sección 5 se verifican contra el sistema real.</li>
</ul>

<div class="caja">
  <span class="titulo">Cómo regenerar este documento</span>
  <pre><code>cd backend &amp;&amp; node scripts/generar-esquema.mjs   # extrae el esquema de PostgreSQL
cd .. &amp;&amp; node documentacion/_generador/02-diccionario.mjs</code></pre>
  <p style="margin-bottom:0">Si se añade una columna sin descripción en <code>deep-docs/_descripciones.json</code>, el primer comando lo avisa.</p>
</div>

<footer class="pie-doc">FINAN-X · Evidencia 2 de 7 · Diccionario de datos · ${totalColumnas} campos en tablas + ${colsVista.length} en la vista, extraídos de PostgreSQL 16.</footer>
`;

escribir('E2_Diccionario_de_Datos.html', html({ titulo: 'FINAN-X · Diccionario de datos', cuerpo }));
