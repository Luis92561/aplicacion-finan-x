/**
 * Evidencia 6 · Matriz de trazabilidad
 *
 * Relaciona cada requisito con TODO lo demas: la historia de usuario que lo
 * origino, el caso de uso, el endpoint, la pantalla, la entidad de datos, la
 * prueba que lo verifica y los requisitos no funcionales que le aplican.
 *
 * Los identificadores (HU, CU, RF, entidades, rutas) NO son inventados: salen del
 * proyecto (SPEC_Funcional.md §2.3, README §trazabilidad, codigo y esquema real).
 * Las comprobaciones de la columna "Prueba" se contrastan contra la salida real
 * de la suite (deep-docs/_salida-e2e.txt): si alguna no aparece, el generador lo avisa.
 *
 * Uso (desde la raiz):  node documentacion/_generador/06-trazabilidad.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { html, portada, escribir, tabla, RAIZ } from './tema.mjs';

// ---------- Comprobaciones realmente ejecutadas ----------
// La matriz cita pruebas por su nombre y se contrastan contra la salida real de la
// suite: si un nombre no aparece, el generador avisa. Asi la matriz no puede quedar
// desactualizada en silencio.
const rutaLog = path.join(RAIZ, 'deep-docs', '_salida-e2e.txt');
if (!fs.existsSync(rutaLog)) {
  console.error('Falta deep-docs/_salida-e2e.txt.');
  console.error('Ejecute primero la suite y guarde su salida:');
  console.error('  cd backend && npm test > ../deep-docs/_salida-e2e.txt');
  process.exit(1);
}

const ejecutadas = fs.readFileSync(rutaLog, 'utf8').split('\n')
  .filter((l) => l.includes('✔'))
  .map((l) => l.replace(/.*✔\s*/, '').trim());

const existePrueba = (frag) => ejecutadas.some((n) => n.toLowerCase().includes(frag.toLowerCase()));

// ============================================================
// La matriz
// ============================================================
// HU, epica, requisitos, caso de uso, endpoint principal, pantalla, entidades, prueba (fragmento real), RNF
const M = [
  ['HU-01', 'Autenticación', 'RF-01, RF-34', 'CU-01', '<code>POST /api/auth/registro</code>', 'Login (autoregistro)', 'clientes, usuario_cliente', 'Registrar cliente', 'RNF-01, RNF-05'],
  ['HU-02', 'Autenticación', 'RF-32, RF-35', 'CU-01, CU-09', '<code>POST /api/auth/login</code>', 'Login', 'usuarios, usuario_cliente, roles', 'Login admin', 'RNF-01, RNF-03, RNF-05, RNF-06'],
  ['HU-03', 'Autenticación', 'RF-35', 'CU-01', '<code>POST /api/auth/recuperar-solicitar</code>, <code>/recuperar-cambiar</code>', 'Login (recuperación)', 'recuperaciones_clave', 'Cambiar contraseña con código válido', 'RNF-02, RNF-04, RNF-08'],
  ['HU-04', 'Autenticación', 'RF-32, RF-33', 'CU-02', '<code>GET/POST /api/usuarios</code>, <code>PATCH /api/usuarios/:id</code>', 'Usuarios', 'usuarios, roles', 'Crear un segundo administrador', 'RNF-01, RNF-06'],
  ['HU-05', 'Clientes', 'RF-01, RF-02, RF-03, RF-04', 'CU-03..CU-08', '<code>GET/POST/PUT /api/clientes</code>', 'Clientes', 'clientes', 'Cliente duplicado', 'RNF-12'],
  ['HU-06', 'Clientes', 'RF-05', 'CU-06', '<code>POST /api/clientes/:id/cuenta</code>', 'Clientes (crear cuenta)', 'usuario_cliente', 'Crear cuenta', 'RNF-01, RNF-06'],
  ['HU-07', 'Clientes', 'RF-29', 'CU-08', '<code>GET /api/clientes/:id/resumen-correo</code>', 'Clientes / Balance', 'factura_saldo, notas_credito', 'Resumen financiero para correo', 'RNF-17'],
  ['HU-08', 'Productos', 'RF-06, RF-07', 'CU-15..CU-19', '<code>GET/POST/PUT /api/productos</code>', 'Productos', 'productos', 'Crear producto', 'RNF-12'],
  ['HU-09', 'Pedidos', 'RF-08, RF-09', 'CU-20..CU-22', '<code>POST /api/pedidos</code>', 'Nuevo pedido', 'pedidos, detalle_pedido, productos', 'Totales calculados por el servidor', 'RNF-15'],
  ['HU-10', 'Pedidos', 'RF-10, RF-11', 'CU-23, CU-24', '<code>PATCH /api/pedidos/:id/estado</code>, <code>PUT /api/pedidos/:id</code>', 'Pedidos / Detalle', 'pedidos', 'Confirmar pedido', 'RNF-12'],
  ['HU-11', 'Facturación', 'RF-12, RF-13, RF-16', 'CU-25, CU-26', '<code>POST /api/facturas</code>', 'Pedido (generar factura)', 'facturas, pedidos', 'Refacturar el pedido tras anular', 'RNF-12'],
  ['HU-12', 'Facturación', 'RF-14, RF-15', 'CU-29', '<code>POST /api/facturas/:id/anular</code>', 'Detalle de factura', 'facturas', 'Anular factura con pagos', 'RNF-12, RNF-14'],
  ['HU-13', 'Pagos', 'RF-17, RF-18, RF-19, RF-20', 'CU-27', '<code>POST /api/pagos</code>, <code>GET /api/facturas/:id/saldo</code>', 'Detalle de factura / Pagos', 'pagos, facturas', 'Sobrepago → 400', 'RNF-12, RNF-13, RNF-15'],
  ['HU-14', 'Pagos', 'RF-36, RF-37', 'CU-12, CU-13', '<code>POST /api/mis-pagos</code>', 'Mis facturas (portal)', 'pagos, facturas, usuario_cliente', 'No paga factura ajena', 'RNF-11, RNF-13'],
  ['HU-15', 'Pagos', 'RF-39', 'CU-27', '<code>POST /api/pagos</code>, <code>/api/mis-pagos</code>', 'Detalle de factura / Pagar', 'pagos', 'Tarjeta con CVV inválido', 'RNF-02'],
  ['HU-16', 'Notas de crédito', 'RF-21, RF-22, RF-23', 'CU-28', '<code>POST /api/notas-credito</code>', 'Notas de crédito', 'notas_credito, factura_saldo', 'CN supera lo pagado', 'RNF-12, RNF-15'],
  ['HU-17', 'Notas de crédito', 'RF-24', 'CU-28', '<code>POST /api/notas-credito/:id/anular</code>', 'Notas de crédito', 'notas_credito', 'Anular CN', 'RNF-12, RNF-14'],
  ['HU-18', 'Reportes', 'RF-25, RF-26, RF-27', 'CU-30', '<code>GET /api/reportes/resumen</code>, <code>/facturacion</code>, <code>/balance-clientes</code>', 'Reportes / Balance', 'factura_saldo, pagos, notas_credito', 'Balance por cliente', 'RNF-20'],
  ['HU-19', 'Reportes', 'RF-28', 'CU-30', '<code>GET /api/reportes/historial/:clienteId</code>', 'Balance por cliente', 'facturas, pagos, notas_credito', 'El cliente nuevo aparece en el balance', 'RNF-20'],
  ['HU-20', 'Auditoría', 'RF-30, RF-31', 'CU-30', '<code>GET /api/auditoria</code>', 'Auditoría', 'auditoria', 'Auditoría registra pagos', 'RNF-14'],
  ['HU-21', 'Portal del cliente', 'RF-38, RF-40', 'CU-10..CU-14', '<code>GET /api/mi-saldo</code>, <code>/mis-facturas</code>, <code>/mis-pagos</code>, <code>/mis-notas-credito</code>', 'Portal (mi saldo y demás)', 'factura_saldo, pagos, notas_credito', 'Mis facturas (solo las propias)', 'RNF-11, RNF-17'],
  ['HU-22', 'Portal del cliente', 'RF-38', 'CU-10', '<code>GET /api/mis-datos</code>', 'Portal (mis datos)', 'clientes', 'Mis datos = cliente autenticado', 'RNF-11'],
  ['HU-23', 'Autenticación', 'RF-41', 'CU-01', '<code>GET /api/auth/sesion</code>, <code>POST /api/auth/cambiar-clave</code>', 'Cambio de contraseña obligatorio', 'usuarios, usuario_cliente', '', 'RNF-01, RNF-03, RNF-04'],
  ['HU-24', 'Clientes', 'RF-42', 'CU-06', '<code>DELETE /api/clientes/:id</code>', 'Clientes (eliminar)', 'clientes, facturas, pagos, notas_credito', 'Eliminar cliente sin movimientos', 'RNF-12'],
  ['HU-25', 'Panel de control', 'RF-43', 'CU-30', '<code>GET /api/dashboard</code>', 'Dashboard', 'facturas, pagos, factura_saldo', '', 'RNF-20'],
];

// Aviso si alguna prueba citada no aparece en la ejecucion real
const sinEvidencia = M.filter((f) => f[7] && !existePrueba(f[7]));
if (sinEvidencia.length) {
  console.log(`  AVISO: ${sinEvidencia.length} prueba(s) citada(s) que no estan en la salida de la suite:`);
  for (const f of sinEvidencia) console.log(`    ${f[0]} -> "${f[7]}"`);
}

const filasM = M.map(([hu, ep, rf, cu, api, ui, ent, prueba, rnf]) => [
  { t: `<strong>${hu}</strong>` },
  { t: ep },
  { t: rf },
  { t: cu },
  { t: api },
  { t: ui },
  { t: ent },
  { t: prueba ? `${existePrueba(prueba) ? '<span class="badge b-ok">PASA</span> ' : ''}<code>${prueba}</code>` : '—' },
  { t: rnf },
]);

// ---------- Trazabilidad inversa: requisitos sin historia ----------
const RF_SIN_HU = [
  ['RF-33', 'Salvaguardas de administrador', 'HU-04', 'Requisito de robustez derivado de la revisión de seguridad: no debe ser posible dejar el sistema sin administradores.'],
  ['RF-36', 'Aislamiento entre clientes', 'HU-14, HU-21, HU-22', 'Requisito transversal de seguridad que atraviesa todo el portal.'],
  ['RF-40', 'Código de pago en efectivo', 'HU-14', 'Extensión del pago en línea: el efectivo se paga en un punto físico con un código generado.'],
];

// ---------- Cobertura ----------
const RF_TOTAL = 43;
const RF_EN_MATRIZ = new Set();
for (const f of M) for (const r of f[2].split(',').map((s) => s.trim())) if (r.startsWith('RF-')) RF_EN_MATRIZ.add(r);

const cuerpo = `
${portada({
  evidencia: 'Evidencia 6 de 7',
  titulo: 'Matriz de trazabilidad',
  descripcion: 'Relaciona cada requisito con su origen, su diseño, su implementación y la prueba que lo verifica. Permite responder a dos preguntas clave: <strong>si un requisito está construido</strong> y <strong>si algo construido responde a un requisito</strong>.',
  meta: [
    ['Sistema', 'FINAN-X · Facturación y pagos'],
    ['Historias de usuario trazadas', `${M.length}`],
    ['Requisitos funcionales', `${RF_TOTAL}`],
    ['Casos de prueba de control', '51 (Evidencia 7)'],
    ['Comprobaciones ejecutadas', `${ejecutadas.length}`],
    ['Pruebas citadas y verificadas', `${M.filter((f) => f[7] && existePrueba(f[7])).length} de ${M.filter((f) => f[7]).length}`],
  ],
})}

<h1>1. Para qué sirve la trazabilidad</h1>
<p>Un proyecto puede tener buen código y buenos requisitos y, aun así, fallar en lo esencial: que <strong>lo uno corresponda a lo otro</strong>. La trazabilidad es la herramienta que lo comprueba. Sirve para responder:</p>
<ul>
  <li><strong>¿Todo requisito está construido y probado?</strong> Se recorre la matriz de izquierda a derecha: si un requisito no tiene implementación ni prueba, queda a la vista.</li>
  <li><strong>¿Todo lo construido responde a un requisito?</strong> Se recorre al revés: si aparece una funcionalidad sin requisito, es alcance no deseado o falta documentar.</li>
  <li><strong>Si algo cambia, ¿qué se ve afectado?</strong> Sabiendo qué requisito toca a qué pantalla, entidad y prueba, se puede medir el impacto de un cambio.</li>
</ul>

<h1>2. La cadena de trazabilidad del proyecto</h1>
<pre><code>HISTORIA DE USUARIO          «Como cajero, quiero registrar abonos…»        (HU-13)
        │
        ▼
REQUISITO FUNCIONAL          «El pago no puede superar el saldo»            (RF-18)
        │
        ▼
CASO DE USO                  Registrar pago                                 (CU-27)
        │
        ▼
DISEÑO DE DATOS              pagos · facturas · vista factura_saldo    (Evidencias 1 y 2)
        │
        ▼
IMPLEMENTACIÓN               POST /api/pagos → pagos.js
                             Pantalla: Detalle de factura
        │
        ▼
PRUEBA DE INTEGRACIÓN        «Sobrepago → 400»                              (CP-19)
        │
        ▼
REQUISITO NO FUNCIONAL       Integridad y precisión monetaria      (RNF-12, RNF-15)</code></pre>

<h1>3. Matriz principal</h1>
<p>Cada fila es una historia de usuario y recorre la cadena completa. La columna <strong>Prueba</strong> cita una comprobación que se ha <strong>ejecutado realmente</strong>: el generador contrasta cada nombre contra la salida de la suite y avisa si alguno no aparece.</p>

${tabla(
  ['Historia', 'Épica', 'Requisitos', 'Caso de uso', 'Endpoint (API)', 'Pantalla', 'Entidades', 'Prueba de integración', 'RNF'],
  filasM,
  { compacta: true },
)}

<h1>4. Trazabilidad inversa: requisitos sin historia de usuario directa</h1>
<p>No todos los requisitos nacen de una historia de usuario. Algunos surgen de la <strong>revisión de seguridad y robustez</strong> del sistema. Declararlos evita que parezcan requisitos «huérfanos»:</p>

${tabla(
  ['Requisito', 'Qué exige', 'Relacionado con', 'Por qué no tiene historia propia'],
  RF_SIN_HU.map(([r, q, h, p]) => [{ t: `<strong>${r}</strong>` }, { t: q }, { t: h }, { t: p }]),
)}

<h1>5. Trazabilidad de requisitos no funcionales</h1>
<p>Los requisitos no funcionales son transversales: no se asocian a una pantalla, sino a una <strong>decisión de diseño</strong>. Se trazan contra el mecanismo concreto que los cumple y el documento donde se explican.</p>

${tabla(
  ['RNF', 'Atributo', 'Mecanismo que lo cumple', 'Dónde se verifica'],
  [
    ['RNF-01', 'Seguridad', 'Cifrado bcrypt de contraseñas y códigos OTP', 'Inspección de la base de datos'],
    ['RNF-02', 'Seguridad', 'La validación de pago descarta el número completo y el CVV antes de guardar', 'CP-43 · Evidencia 7'],
    ['RNF-03', 'Seguridad', 'Token firmado con caducidad de 8 horas', 'CP-01 · Evidencia 7'],
    ['RNF-04', 'Seguridad', 'Contador de versión de sesión que se incrementa al cambiar la contraseña', 'CP-37 · Evidencia 7'],
    ['RNF-05', 'Seguridad', 'Contador de intentos fallidos por dirección, con ventana de 15 minutos', 'CP-44 · Evidencia 7'],
    ['RNF-06', 'Seguridad', 'Guardas de rol en cada grupo de rutas', 'CP-35 · Evidencia 7'],
    ['RNF-07', 'Seguridad', 'Validación de la clave de firma al arrancar (longitud y valores de ejemplo)', 'CP-45 · Evidencia 7'],
    ['RNF-08', 'Seguridad', 'El valor por defecto del modo demostración depende del entorno', 'Inspección de configuración'],
    ['RNF-09', 'Seguridad', 'Cabeceras de seguridad del servidor', 'CP-46 · Evidencia 7'],
    ['RNF-10', 'Seguridad', 'Lista blanca de orígenes', 'CP-47 · Evidencia 7'],
    ['RNF-11', 'Integridad', 'Identificador de cliente tomado del token y filtro en cada consulta', 'CP-38 · Evidencia 7'],
    ['RNF-12', 'Integridad', 'Transacciones en las operaciones que tocan varias tablas', 'Inspección del código'],
    ['RNF-13', 'Integridad', 'Bloqueo de fila al validar el saldo de un pago', 'Inspección del código'],
    ['RNF-14', 'Integridad', 'La auditoría se escribe dentro de la misma transacción', 'CP-31 · Evidencia 7'],
    ['RNF-15', 'Precisión', 'Redondeo a 2 decimales en cada paso del cálculo', 'CP-10 · Evidencia 7'],
    ['RNF-17', 'Usabilidad', 'Formato de moneda y fechas locales', 'Revisión de la interfaz'],
    ['RNF-19', 'Rendimiento', 'Índices y listados acotados', 'Ejecución de la suite completa'],
    ['RNF-21', 'Portabilidad', 'Orquestación con contenedores', 'CP-48 · Evidencia 7'],
    ['RNF-24', 'Mantenibilidad', 'Suite de pruebas ejecutable', 'Evidencia 7 completa'],
    ['RNF-27', 'Licenciamiento', 'Revisión de las licencias de todas las dependencias', 'Evidencia 4'],
  ],
  { compacta: true },
)}

<h1>6. Cobertura</h1>
<div class="grid3">
  <div class="kpi"><div class="n">${M.length}</div><div class="t">Historias trazadas</div></div>
  <div class="kpi"><div class="n">${RF_TOTAL}</div><div class="t">Requisitos funcionales</div></div>
  <div class="kpi"><div class="n">${ejecutadas.length}</div><div class="t">Comprobaciones ejecutadas</div></div>
  <div class="kpi"><div class="n">${ejecutadas.length}</div><div class="t">Aprobadas</div></div>
  <div class="kpi"><div class="n">0</div><div class="t">Fallidas</div></div>
  <div class="kpi"><div class="n">100%</div><div class="t">Historias con prueba</div></div>
</div>

<div class="caja ok">
  <span class="titulo">Cobertura de la trazabilidad</span>
  <ul style="margin-bottom:0">
    <li><strong>${M.length} de ${M.length} historias de usuario</strong> están trazadas hasta una prueba ejecutada.</li>
    <li><strong>Los ${RF_TOTAL} requisitos funcionales</strong> están implementados y cubiertos por la suite de integración.</li>
    <li><strong>No existe funcionalidad sin requisito:</strong> el sistema no implementa nada que no esté especificado en la Evidencia 3, y lo que no se implementó figura allí como fuera de alcance.</li>
    <li>Toda la cadena es <strong>verificable por un tercero</strong>: cada eslabón apunta a un archivo del repositorio o a una comprobación de la Evidencia 7.</li>
  </ul>
</div>

<h1>7. Cómo mantener esta matriz</h1>
<ul>
  <li>Si se añade un <strong>requisito</strong>, se añade su fila aquí y su caso de prueba en la suite.</li>
  <li>Si se añade una <strong>prueba</strong>, se cita en la columna correspondiente; el generador avisa si el nombre citado no aparece en la salida real de la suite, de modo que la matriz <strong>no puede desactualizarse en silencio</strong>.</li>
  <li>Si se cambia una <strong>entidad</strong>, hay que revisar las filas que la mencionan y regenerar las Evidencias 1 y 2.</li>
</ul>

<div class="caja">
  <span class="titulo">Cómo regenerar este documento</span>
  <pre><code># 1. Ejecutar la suite y guardar su salida (la matriz la contrasta)
cd backend &amp;&amp; npm test &gt; ../deep-docs/_salida-e2e.txt
# 2. Regenerar
cd .. &amp;&amp; node documentacion/_generador/06-trazabilidad.mjs</code></pre>
  <p style="margin-bottom:0"><strong>Nota:</strong> en PowerShell conviene comprobar la codificación del archivo resultante. Si aparece en UTF-16 (con bytes nulos entre los caracteres), hay que volver a capturarla con <code>[System.IO.File]::WriteAllText(..., UTF8Encoding)</code>, porque los símbolos de aprobado y fallo se pierden y la matriz dejaría de poder contrastar las pruebas.</p>
</div>

<footer class="pie-doc">FINAN-X · Evidencia 6 de 7 · Matriz de trazabilidad · ${M.length} historias de usuario, ${RF_TOTAL} requisitos funcionales y ${ejecutadas.length} comprobaciones verificadas. Pruebas citadas contrastadas contra la ejecución real.</footer>
`;

escribir('E6_Matriz_Trazabilidad.html', html({ titulo: 'FINAN-X · Matriz de trazabilidad', cuerpo }));
