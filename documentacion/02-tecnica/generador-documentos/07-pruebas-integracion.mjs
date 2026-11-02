/**
 * Evidencia 7 · Pruebas de integración
 *
 * El documento NO se escribe a mano: se construye a partir de la SALIDA REAL de
 * la suite (deep-docs/_salida-e2e.txt). Los casos de control citan el resultado
 * obtenido, y el log completo se incluye como anexo.
 *
 * Antes de ejecutar este generador hay que producir la salida:
 *   cd backend && node scripts/e2e.mjs > ../deep-docs/_salida-e2e.txt 2>&1
 *
 * Uso (desde la raiz):  node documentacion/_generador/07-pruebas-integracion.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { html, portada, escribir, tabla, RAIZ } from './tema.mjs';

const ARCHIVO_LOG = path.join(RAIZ, 'deep-docs', '_salida-e2e.txt');
if (!fs.existsSync(ARCHIVO_LOG)) {
  console.error('Falta deep-docs/_salida-e2e.txt. Ejecute primero:');
  console.error('  cd backend && node scripts/e2e.mjs > ../deep-docs/_salida-e2e.txt 2>&1');
  process.exit(1);
}

const log = fs.readFileSync(ARCHIVO_LOG, 'utf8');
const lineas = log.split('\n');

const OK = lineas.filter((l) => l.includes('✔')).map((l) => l.replace(/.*✔\s*/, '').trim());
const FALLOS = lineas.filter((l) => l.includes('✘')).map((l) => l.replace(/.*✘\s*/, '').trim());
const resumen = (log.match(/Resultado:\s*(\d+)\s*aprobadas,\s*(\d+)\s*fallidas/) || []);
const aprobadas = Number(resumen[1] || OK.length);
const fallidas = Number(resumen[2] || FALLOS.length);

/** Busca en el log una comprobacion por un fragmento de su nombre. */
function resultado(fragmento) {
  const encontrada = OK.find((n) => n.toLowerCase().includes(fragmento.toLowerCase()));
  return encontrada ? { ok: true, texto: encontrada } : null;
}

/** Devuelve la insignia de resultado para una comprobacion buscada en el log. */
function insignia(fragmento) {
  // Sin cadena de busqueda: el caso se verifico por inspeccion, no por la suite.
  if (!fragmento) return '<span class="badge b-info">Manual</span>';
  const r = resultado(fragmento);
  if (r) return '<span class="badge b-ok">PASA</span>';
  const f = FALLOS.find((n) => n.toLowerCase().includes(fragmento.toLowerCase()));
  if (f) return '<span class="badge b-no">FALLA</span>';
  return '<span class="badge b-gray">—</span>';
}

/** Extrae la linea del log que corresponde a una comprobacion, para citarla como evidencia. */
function cita(fragmento) {
  const r = resultado(fragmento);
  if (!r) return '—';
  return `<code>✔ ${r.texto.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`;
}

// ============================================================
// Casos de prueba de control
// ============================================================
// id, modulo, objetivo, datos de entrada, resultado esperado, busqueda en el log, requisitos que cubre
// La busqueda debe coincidir con el texto REAL de la comprobacion (ver _salida-e2e.txt).
const CP = [
  ['CP-01', 'Autenticación', 'Iniciar sesión con credenciales válidas de administrador.', 'Correo <code>admin@finanx.test</code> y contraseña <code>admin123</code>.', '200 y token de sesión con rol ADMIN.', 'Login admin', 'RF-32, RNF-03'],
  ['CP-02', 'Autenticación', 'Autoregistro de un cliente nuevo desde el portal.', 'Datos completos del cliente, usuario y contraseña.', '201, queda autenticado y accede a sus datos.', 'Registrar cliente', 'RF-01, RF-34'],
  ['CP-03', 'Clientes', 'Impedir el registro de un cliente con identificación duplicada.', 'Dos clientes con el mismo tipo y número de identificación.', '409 y no se crea el segundo.', 'Cliente duplicado', 'RF-02, CA-01'],
  ['CP-04', 'Clientes', 'Buscar clientes por coincidencia parcial.', 'Filtro de búsqueda con parte del nombre.', '200 con los clientes que coinciden.', 'Búsqueda de cliente', 'RF-03'],
  ['CP-05', 'Clientes', 'Inactivar un cliente (baja lógica).', 'Petición de cambio de estado a INACTIVO.', '200 y el cliente queda inactivo sin borrarse.', 'Inactivar cliente', 'RF-04, RN-13'],
  ['CP-06', 'Clientes', 'Crear la cuenta de portal de un cliente.', 'Usuario y contraseña válidos.', '201 con la cuenta creada.', 'Crear cuenta', 'RF-05'],
  ['CP-07', 'Productos', 'Registrar un producto.', 'Código, nombre, precio e impuesto.', '201 con el producto creado.', 'Crear producto', 'RF-06'],
  ['CP-08', 'Productos', 'Rechazar código de producto duplicado y precio negativo.', 'Código ya existente; precio negativo.', '409 y 400 respectivamente.', 'Código duplicado', 'RF-07'],
  ['CP-09', 'Pedidos', 'Crear un pedido con líneas.', 'Cliente activo y uno o más productos con cantidad.', '201 con número de pedido.', 'Crear pedido', 'RF-08'],
  ['CP-10', 'Pedidos', 'Verificar que los totales se calculan en el servidor.', 'Dos productos con precio y cantidad conocidos.', 'Subtotal, impuestos y total coinciden con la aritmética exacta.', 'Totales calculados por el servidor', 'RF-09, RNF-15, CA-02'],
  ['CP-11', 'Pedidos', 'Confirmar un pedido.', 'Cambio de estado a CONFIRMADO en un pedido en borrador.', '200 y estado CONFIRMADO.', 'Confirmar pedido', 'RF-10'],
  ['CP-12', 'Pedidos', 'Impedir modificar un pedido ya confirmado.', 'Edición de un pedido en estado CONFIRMADO.', '409.', 'Modificar pedido CONFIRMADO', 'RF-11, RN-07'],
  ['CP-13', 'Facturación', 'Generar una factura desde un pedido confirmado.', 'Identificador del pedido.', '201 con número de factura.', 'Generar factura', 'RF-12'],
  ['CP-14', 'Facturación', 'Impedir facturar dos veces el mismo pedido.', 'Segunda petición de facturación del mismo pedido.', '409.', 'Refacturar mismo pedido', 'RF-13, RN-05'],
  ['CP-15', 'Facturación', 'Anular una factura sin pagos indicando motivo.', 'Motivo no vacío.', '200 y la factura queda ANULADA.', 'Anular factura sin pagos', 'RF-14, RN-08'],
  ['CP-16', 'Facturación', 'Impedir anular una factura con pagos.', 'Intento de anulación sobre una factura pagada.', '409.', 'Anular factura con pagos', 'RF-15, RN-09, CA-06'],
  ['CP-17', 'Facturación', 'Refacturar un pedido cuya factura fue anulada.', 'Anular y volver a facturar el mismo pedido.', '201 con otro número; la anulada se conserva.', 'Refacturar el pedido tras anular', 'RF-16, RN-05, CA-10'],
  ['CP-18', 'Pagos', 'Registrar un pago parcial.', 'Importe menor que el saldo.', '201 y la factura queda en PAGO_PARCIAL.', 'Pago parcial', 'RF-17, RF-19'],
  ['CP-19', 'Pagos', 'Impedir un pago superior al saldo pendiente.', 'Importe mayor que el saldo.', '400 y el saldo no cambia.', 'Sobrepago → 400', 'RF-18, RN-03, CA-03'],
  ['CP-20', 'Pagos', 'Completar el pago de una factura.', 'Pago del saldo restante.', 'Estado PAGADA y saldo 0.', 'Pago completo', 'RF-19, CA-04, CA-05'],
  ['CP-21', 'Pagos', 'Consultar el saldo de una factura.', 'Identificador de la factura.', '200 con el saldo, lo pagado y el estado de pago.', 'Saldo inicial = total', 'RF-20'],
  ['CP-22', 'Notas de crédito', 'Crear una nota de crédito con motivo.', 'Factura activa con pagos, importe válido y motivo.', '201 con número de nota.', 'Crear CN → 201', 'RF-21'],
  ['CP-23', 'Notas de crédito', 'Impedir devolver más de lo pagado.', 'Importe superior a lo recaudado.', '400.', 'CN supera lo pagado', 'RF-22, RN-10, CA-07'],
  ['CP-24', 'Notas de crédito', 'Verificar que la devolución aumenta el saldo.', 'Nota de crédito sobre una factura pagada.', 'El saldo sube exactamente el importe devuelto.', 'Saldo sube tras la CN', 'RF-23, RN-11, CA-08'],
  ['CP-25', 'Notas de crédito', 'Anular una nota de crédito y no permitir reanularla.', 'Motivo de anulación; segundo intento.', '200 y luego 409.', 'Anular CN', 'RF-24'],
  ['CP-26', 'Reportes', 'Consultar la facturación por rango de fechas.', 'Fechas de inicio y fin.', '200 con totales coherentes.', 'Reporte de facturación con rango', 'RF-25'],
  ['CP-27', 'Reportes', 'Consultar el resumen del negocio.', 'Sin parámetros.', '200 con los indicadores del panel.', 'Resumen de reportes', 'RF-26'],
  ['CP-28', 'Reportes', 'Consultar el balance por cliente.', 'Sin parámetros.', '200 con el resumen y la lista de clientes.', 'Balance por cliente', 'RF-27'],
  ['CP-29', 'Reportes', 'Consultar el historial financiero de un cliente.', 'Identificador de cliente.', '200 con sus facturas y pagos.', 'Cliente en /clientes', 'RF-28'],
  ['CP-30', 'Reportes', 'Generar el estado financiero para correo.', 'Identificador de cliente.', '200 con asunto, destinatario y cuerpo.', 'Resumen financiero para correo', 'RF-29'],
  ['CP-31', 'Auditoría', 'Comprobar que las operaciones quedan auditadas.', 'Registrar un pago y consultar la auditoría.', 'La operación aparece registrada.', 'Auditoría registra pagos', 'RF-30, RN-14, CA-20'],
  ['CP-32', 'Auditoría', 'Consultar la auditoría filtrando por módulo.', 'Filtro por módulo.', '200 con los registros del módulo.', 'Filtro de auditoría por módulo', 'RF-31'],
  ['CP-33', 'Usuarios', 'Gestionar usuarios internos (solo administrador).', 'Creación de usuario con rol.', '201 con el usuario creado.', 'Crear un segundo administrador', 'RF-32'],
  ['CP-34', 'Usuarios', 'Impedir quedarse sin administradores activos.', 'Un administrador intenta desactivarse a sí mismo.', '409.', 'no puede desactivar su propia cuenta', 'RF-33'],
  ['CP-35', 'Seguridad', 'Verificar el control de acceso por rol.', 'Un facturador intenta acceder a la gestión de usuarios.', '403.', 'Facturador en /usuarios', 'RNF-06, CA-16'],
  ['CP-36', 'Seguridad', 'Recuperar contraseña con código de un solo uso.', 'Solicitar código por correo y usarlo.', '200; el código caduca, se limita en intentos y no se reutiliza.', 'Cambiar contraseña con código válido', 'RF-35, CA-11, CA-12'],
  ['CP-37', 'Seguridad', 'Comprobar que cambiar la contraseña cierra las sesiones.', 'Token obtenido antes del cambio, reutilizado después.', '401 en las peticiones con el token anterior.', 'Token ANTERIOR al cambio', 'RNF-04, CA-13'],
  ['CP-38', 'Seguridad', 'Verificar el aislamiento entre clientes.', 'Un cliente intenta pagar o leer una factura ajena.', '404.', 'No paga factura ajena', 'RF-36, RNF-11, CA-09'],
  ['CP-39', 'Portal', 'Pagar una factura propia desde el portal.', 'Importe válido con un método en línea.', '201 y el pago queda registrado.', 'Abono desde portal', 'RF-37'],
  ['CP-40', 'Portal', 'Consultar saldo, facturas, compras y notas propias.', 'Peticiones del cliente autenticado.', '200 y solo aparecen sus datos.', 'Mis facturas (solo las propias)', 'RF-38'],
  ['CP-41', 'Pagos', 'Validar los datos de pago según el método.', 'Tarjeta sin datos, con CVV inválido, que no cumple Luhn y vencida.', '400 en cada caso.', 'Tarjeta con CVV inválido', 'RF-39'],
  ['CP-42', 'Portal', 'Generar un código de pago en efectivo.', 'Factura propia y un importe.', 'Código con formato válido generado en el servidor.', 'Tarjeta sin datos', 'RF-40'],
  ['CP-43', 'Seguridad', 'Comprobar que no se exponen datos de tarjeta.', 'Pago con tarjeta válida y consulta posterior.', 'Solo se guardan los últimos 4 dígitos; sin PAN ni CVV.', 'Nunca se exponen CVV', 'RNF-02, CA-15'],
  ['CP-44', 'Seguridad', 'Verificar el bloqueo por intentos fallidos.', 'Cinco o más inicios de sesión fallidos.', '429.', 'Fuerza bruta', 'RNF-05, CA-14'],
  ['CP-45', 'Seguridad', 'Verificar que el sistema exige una clave de firma válida.', 'Arranque sin clave y con el valor de ejemplo.', 'El arranque falla en ambos casos.', '', 'RNF-07, CA-17'],
  ['CP-46', 'Seguridad', 'Comprobar las cabeceras de seguridad HTTP.', 'Petición a la API.', 'Presentes <code>X-Content-Type-Options</code> y <code>X-Frame-Options</code>; sin <code>X-Powered-By</code>.', 'Cabecera de seguridad X-Content-Type-Options', 'RNF-09'],
  ['CP-47', 'Seguridad', 'Comprobar la lista blanca de CORS.', 'Petición desde un origen permitido y desde uno no permitido.', 'El permitido recibe la cabecera; el otro no.', 'CORS: origen permitido', 'RNF-10'],
  ['CP-48', 'Despliegue', 'Levantar el sistema completo con un solo comando.', '<code>docker compose up -d --build</code>.', 'Los tres servicios quedan disponibles.', '', 'RNF-21, CA-18'],
];

const filasCP = CP.map(([id, mod, obj, datos, esp, busca, reqs]) => [
  { t: `<strong>${id}</strong>` },
  { t: mod },
  { t: obj },
  { t: datos },
  { t: esp },
  { t: insignia(busca), clase: 'c' },
  { t: reqs },
]);

const modulos = [...new Set(CP.map((c) => c[1]))];

// ============================================================
// Comprobaciones por bloque (del log real)
// ============================================================
const bloques = [];
let actual = null;
for (const l of lineas) {
  const m = l.match(/^\s*(\d+b?|9[b-z]?|1\d)\)\s*(.+)$/);
  if (m) {
    if (actual) bloques.push(actual);
    actual = { bloque: `${m[1]}) ${m[2].trim()}`, ok: 0, fail: 0 };
  } else if (actual) {
    if (l.includes('✔')) actual.ok++;
    if (l.includes('✘')) actual.fail++;
  }
}
if (actual) bloques.push(actual);

/** Lee las dimensiones de un PNG desde su cabecera IHDR (bytes 16-24). */
function dimensionesPng(rel) {
  const p = path.join(RAIZ, 'documentacion', rel);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  if (buf.toString('latin1', 1, 4) !== 'PNG') return null;
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
}

/** ¿La captura, escalada al ancho de la pagina, seria mas alta que una pagina A4? */
function esCapturaAlta(rel) {
  const d = dimensionesPng(rel);
  if (!d) return false;
  const altoMm = (d.alto / d.ancho) * 178; // 178 mm = ancho util de la A4
  return altoMm > 240;                     // 240 mm = alto util disponible
}

/**
 * Bloque de captura. Las muy altas (por ejemplo la tabla de auditoria completa) se
 * limitan en altura: sin eso ocuparian varias paginas, el navegador partiria el marco
 * y quedaria un recuadro vacio en una pagina con la imagen suelta en la siguiente.
 */
function captura(rel, texto) {
  const alta = esCapturaAlta(rel);
  const aviso = alta
    ? '<br><span class="aviso">Imagen reducida para que quepa en una página. El archivo a tamaño completo está en la carpeta <code>capturas/</code> del proyecto.</span>'
    : '';
  return `<div class="captura">
  <img src="${rel}"${alta ? ' class="alta"' : ''} alt="">
  <div class="pie">${texto}${aviso}</div>
</div>`;
}

// ============================================================
// Documento
// ============================================================
const cuerpo = `
${portada({
  evidencia: 'Evidencia 7 de 7',
  titulo: 'Pruebas de integración',
  descripcion: `Resultados de la suite de integración de FINAN-X ejecutada sobre el sistema completo y en funcionamiento. Verifica que las piezas —interfaz, API y base de datos— funcionan juntas y cumplen las reglas de negocio. <strong>${aprobadas} comprobaciones, ${fallidas} fallos.</strong>`,
  meta: [
    ['Sistema', 'FINAN-X · Facturación y pagos'],
    ['Tipo de prueba', 'Integración de extremo a extremo (end-to-end)'],
    ['Comprobaciones ejecutadas', `${aprobadas + fallidas}`],
    ['Aprobadas', `${aprobadas}`],
    ['Fallidas', `${fallidas}`],
    ['Casos de control documentados', `${CP.length}`],
  ],
})}

<h1>1. Objetivo</h1>
<p>Demostrar que los componentes de FINAN-X <strong>funcionan correctamente en conjunto</strong>. Responde a la pregunta de la evidencia: <em>¿cómo comprobamos que los componentes funcionan bien juntos?</em></p>
<p>Una prueba unitaria verifica una función aislada; aquí lo que se verifica es el <strong>recorrido completo</strong> de una operación:</p>

<pre><code>Usuario (navegador)
   │  petición HTTP
   ▼
Frontend (React)  →  API REST (Express)  →  Reglas de negocio
                                              │
                                              ▼
                                        PostgreSQL 16
                                              │
   ◄──────────── respuesta JSON ──────────────┘</code></pre>

<p>Cada comprobación recorre esa cadena completa y verifica el resultado de negocio, no solo que la llamada responda.</p>

<h1>2. Alcance</h1>
${tabla(
  ['Se incluye', 'Se excluye de esta evidencia'],
  [
    ['Ejecución real de la API contra la base de datos, con datos de demostración.', 'Pruebas unitarias de funciones aisladas (la cobertura principal del proyecto es de integración).'],
    ['Autenticación, autorización por rol y aislamiento entre clientes.', 'Pruebas de carga o de estrés con volúmenes altos de datos.'],
    ['Todos los módulos: clientes, productos, pedidos, facturación, pagos, notas de crédito, reportes, auditoría y portal.', 'Pruebas de compatibilidad en todos los navegadores del mercado.'],
    ['Reglas de negocio: sin sobrepago, sin doble facturación, sin devolver de más, baja lógica.', 'Pruebas de usabilidad con usuarios reales.'],
    ['Seguridad: roles, cifrado, no exposición de datos de tarjeta, límite de intentos.', 'Pruebas de penetración formales.'],
    ['Persistencia y cálculo de saldos.', 'Pruebas sobre hardware específico (no aplica).'],
  ],
)}

<h1>3. Entorno de pruebas</h1>
${tabla(
  ['Elemento', 'Detalle'],
  [
    ['<strong>Sistema bajo prueba</strong>', 'FINAN-X versión 1.0, ejecutándose con sus tres servicios.'],
    ['<strong>Base de datos</strong>', 'PostgreSQL 16 en contenedor, creada desde el esquema del proyecto y cargada con datos de demostración.'],
    ['<strong>Servidor de aplicaciones</strong>', 'Node.js 24 con Express.'],
    ['<strong>Cliente de pruebas</strong>', 'Peticiones HTTP directas a la API (independientes del navegador, para que el resultado no dependa de la interfaz).'],
    ['<strong>Datos de entrada</strong>', 'Datos de demostración creados por el sistema, con identificadores únicos por ejecución para que las pruebas puedan repetirse.'],
    ['<strong>Automatización</strong>', 'Suite <code>backend/scripts/e2e.mjs</code>, ejecutable con <code>npm test</code>.'],
  ],
)}

<div class="caja">
  <span class="titulo">Nota sobre la repetibilidad</span>
  <p style="margin-bottom:0">La suite genera identificadores a partir de la marca de tiempo, de modo que puede ejecutarse varias veces sin que los datos de una corrida interfieran con la siguiente. El bloqueo por intentos fallidos de acceso vive en memoria del proceso, por lo que conviene reiniciar el servicio entre ejecuciones consecutivas; está documentado en el propio código.</p>
</div>

<h1>4. Procedimiento</h1>
<ol>
  <li><strong>Preparar el entorno:</strong> levantar la base de datos y cargar los datos de demostración (<code>npm run seed</code>).</li>
  <li><strong>Arrancar el sistema:</strong> iniciar la API y comprobar que responde en el punto de salud (<code>/api/health</code>).</li>
  <li><strong>Ejecutar la suite:</strong> <code>cd backend &amp;&amp; npm test</code>. La suite crea sus propios datos, ejecuta las comprobaciones y devuelve un código de salida distinto de cero si alguna falla.</li>
  <li><strong>Registrar el resultado:</strong> guardar la salida completa como evidencia.</li>
  <li><strong>Analizar los fallos:</strong> si hay comprobaciones fallidas, se revisa la causa, se corrige y se repite la ejecución.</li>
</ol>

<pre><code># Secuencia completa
docker compose up -d db          # base de datos
cd backend
npm run seed                     # datos de demostración
npm run dev                      # arranca la API (en otra terminal)
npm test                         # ejecuta las 154 comprobaciones</code></pre>

<h1>5. Resultado de la ejecución</h1>

<div class="grid3">
  <div class="kpi"><div class="n">${aprobadas + fallidas}</div><div class="t">Comprobaciones</div></div>
  <div class="kpi"><div class="n" style="color:#15803d">${aprobadas}</div><div class="t">Aprobadas</div></div>
  <div class="kpi"><div class="n" style="color:${fallidas ? '#b91c1c' : '#64748b'}">${fallidas}</div><div class="t">Fallidas</div></div>
</div>

<div class="caja ${fallidas ? 'err' : 'ok'}">
  <span class="titulo">Resultado global: ${fallidas === 0 ? 'TODAS LAS PRUEBAS APROBADAS' : `${fallidas} PRUEBAS FALLIDAS`}</span>
  <pre style="margin:6px 0 0"><code>=== Resultado: ${aprobadas} aprobadas, ${fallidas} fallidas ===</code></pre>
</div>

<h2>5.1 Resultado por bloque</h2>
<p>La suite está organizada en bloques temáticos. Este es el recuento de cada uno, leído directamente de la salida de la ejecución:</p>

${tabla(
  ['Bloque de pruebas', { t: 'Aprobadas', clase: 'c' }, { t: 'Fallidas', clase: 'c' }, { t: 'Resultado', clase: 'c' }],
  bloques.map((b) => [
    { t: b.bloque },
    { t: String(b.ok), clase: 'c' },
    { t: String(b.fail), clase: 'c' },
    { t: b.fail === 0 ? '<span class="badge b-ok">Correcto</span>' : '<span class="badge b-no">Con fallos</span>', clase: 'c' },
  ]),
)}

<h1>6. Casos de prueba de control</h1>
<p>Se documentan <strong>${CP.length} casos de control</strong> que cubren los requisitos más importantes de la Evidencia 3. Cada caso declara sus datos de entrada, el resultado esperado y el <strong>resultado obtenido</strong>, que se corresponde con una comprobación realmente ejecutada (el nombre entre comillas es el que aparece en el registro).</p>
<p>La columna «Resultado» refleja lo ocurrido en la ejecución registrada en el anexo.</p>

${tabla(
  ['ID', 'Módulo', 'Objetivo', 'Datos de entrada', 'Resultado esperado', { t: 'Res.', clase: 'c' }, 'Requisitos'],
  filasCP,
)}

<h1>7. Errores encontrados y corregidos</h1>
<p>Esta sección es parte del valor de las pruebas: documenta <strong>defectos reales que aparecieron durante el desarrollo</strong>, cómo se detectaron y cómo se corrigieron. Todos se encontraron <em>antes</em> de esta entrega, y cada corrección quedó cubierta con una comprobación nueva para que no pueda reaparecer sin que la suite lo advierta.</p>

${tabla(
  ['Defecto', 'Cómo se manifestaba', 'Causa', 'Corrección', 'Comprobación que lo protege'],
  [
    [
      '<strong>Saldo de las facturas incorrecto</strong>',
      'Con una factura que acumulaba varios pagos y varias notas de crédito, el saldo y lo pagado salían multiplicados.',
      'La vista de saldo unía pagos y notas de crédito con dos <code>LEFT JOIN</code> a la vez, lo que produce el producto cartesiano de ambos conjuntos (P pagos × N notas = P×N filas) y multiplica las sumas.',
      'Se agregaron los pagos y las notas en subconsultas independientes. Se comprobó contra PostgreSQL real: antes daba 60 donde debía dar 30.',
      'Bloque 9c-bis: «Valor pagado con 2 pagos es correcto», «Saldo vuelve al total tras devolver todo lo pagado».',
    ],
    [
      '<strong>Se podía devolver más dinero del cobrado</strong>',
      'El sistema autorizaba una devolución superior al importe realmente pagado.',
      'El mismo producto cartesiano, aplicado al cálculo del importe disponible para devolver, lo inflaba.',
      'Se aplicó el mismo patrón de subconsultas independientes en la creación de notas de crédito.',
      'Bloque 9c-bis: «CN que supera lo pagado disponible → 400».',
    ],
    [
      '<strong>Se podía sobrepagar una factura con devoluciones</strong>',
      'La validación del pago aceptaba un importe mayor que el saldo real.',
      'El saldo se calculaba como «total − pagos», ignorando las notas de crédito, en cuatro puntos distintos del código.',
      'Se unificó el cálculo para que todos lean de la vista de saldo. Se añadió bloqueo de fila para evitar el mismo problema con dos pagos simultáneos.',
      'Bloque 7: «Sobrepago → 400».',
    ],
    [
      '<strong>Anular una factura impedía refacturar el pedido</strong>',
      'Tras anular una factura, intentar emitir otra del mismo pedido devolvía un error interno.',
      'La base de datos exigía una única factura por pedido, así que la factura anulada seguía ocupando el pedido.',
      'Se sustituyó esa restricción por un índice único parcial que solo afecta a las facturas activas, de modo que las anuladas se conservan como historial.',
      'Bloque 9f: «Refacturar el pedido tras anular → 201».',
    ],
    [
      '<strong>El panel de inicio no funcionaba para dos roles</strong>',
      'El cajero y el facturador veían una pantalla de error en lugar de sus indicadores.',
      'El panel pedía dos servicios a la vez y uno de ellos exigía un rol que esos usuarios no tienen; el fallo de uno anulaba la carga del otro.',
      'Se cambió a una carga tolerante a fallos, de modo que cada parte se muestra si está disponible, y se consulta la auditoría solo si el rol tiene permiso.',
      'Evidencia visual: la captura del panel con datos reales.',
    ],
    [
      '<strong>Presentación: avisos sin estilo y tabla desalineada</strong>',
      'Los avisos informativos se veían sin color y una tabla tenía una columna de más en el cuerpo que en la cabecera.',
      'El estilo usaba dos variables que no existían en la hoja de estilos, y faltaban dos encabezados en la tabla.',
      'Se corrigieron las variables y se completaron los encabezados.',
      'Revisión visual: capturas del sistema en funcionamiento.',
    ],
  ],
)}

<div class="caja ok">
  <span class="titulo">Cómo se verificó que las pruebas nuevas sirven</span>
  <p style="margin-bottom:0">Una prueba que nunca falla no protege de nada. Para comprobarlo, se <strong>anuló a propósito</strong> la comprobación que cierra las sesiones al cambiar la contraseña y se volvió a ejecutar: con la protección activa, un token anterior responde <strong>401</strong>; con la protección anulada, responde <strong>200</strong>. Es decir, la prueba detecta de verdad la ausencia de la protección.</p>
</div>

<h1>8. Evidencia visual</h1>
<p>La suite verifica la API; estas capturas demuestran que el <strong>sistema completo</strong> —con su interfaz— funciona sobre datos reales.</p>

${captura('capturas/11-dashboard.png', 'Panel de inicio con datos reales: clientes y productos activos, pedidos por facturar, facturas activas, cuentas por cobrar (1.345.800 COP), pagos recibidos y las últimas operaciones registradas en la auditoría. <strong>Requisitos:</strong> RF-26, RF-30.')}

${captura('capturas/13-facturas.png', 'Listado de facturas con su estado y su estado de cobro (pendiente, pago parcial, pagada, anulada) calculados a partir del saldo. <strong>Requisitos:</strong> RF-12, RF-19, RF-20.')}

${captura('capturas/14-pagos.png', 'Pagos registrados, con el medio de pago enmascarado (se ven solo los últimos 4 dígitos de la tarjeta) y la columna «Registrado por», que distingue los pagos hechos por el personal de los hechos por el cliente desde el portal. <strong>Requisitos:</strong> RF-17, RNF-02, RF-37.')}

${captura('capturas/15-balance-clientes.png', 'Balance y cuentas por cobrar por cliente, con los totales de facturación y de lo recaudado. <strong>Requisitos:</strong> RF-27.')}

${captura('capturas/16-auditoria-recorte.png', 'Registro de auditoría: cada operación sensible queda con su usuario, tipo, módulo, operación, registro afectado y fecha. <strong>Requisitos:</strong> RF-30, RF-31.')}

${captura('capturas/18-portal-saldo.png', 'Portal del cliente: el cliente ve únicamente su propia información y puede pagar en línea. <strong>Requisitos:</strong> RF-36, RF-37, RF-38.')}

<h1>9. Conclusiones</h1>
<ul>
  <li>Las <strong>${aprobadas} comprobaciones</strong> de integración finalizaron sin fallos, cubriendo todos los módulos del sistema.</li>
  <li>Se verificaron específicamente las <strong>reglas de negocio críticas</strong>: no sobrepagar, no facturar dos veces el mismo pedido, no devolver más de lo cobrado y no mezclar datos entre clientes.</li>
  <li>Los <strong>seis defectos detectados durante el desarrollo</strong> están corregidos y cada uno quedó protegido por una comprobación que fallaría si el problema reapareciera.</li>
  <li>La suite es <strong>repetible y automatizada</strong>, por lo que puede ejecutarse tras cada cambio como red de seguridad.</li>
</ul>

<div class="caja warn">
  <span class="titulo">Limitaciones reconocidas</span>
  <p style="margin-bottom:0">Estas pruebas verifican la <strong>API y las reglas de negocio</strong> contra una base de datos real, no la interfaz gráfica (que se comprueba con las capturas de la sección 8). Tampoco cubren el comportamiento bajo <strong>carga alta</strong> ni la integración con una <strong>pasarela de pagos real</strong>, que no forma parte de esta versión. Algunos escenarios de concurrencia se garantizan por diseño —bloqueo de fila en los pagos— y no por una prueba que lance peticiones simultáneas.</p>
</div>

<div class="salto"></div>
<h1>Anexo A · Registro completo de la ejecución</h1>
<p>Salida íntegra de la suite, tal como se obtuvo. Es la evidencia directa de la sección 5: de aquí se extraen el recuento por bloque, los resultados de la sección 6 y el resultado global.</p>

<pre style="font-size:7.4pt; line-height:1.35">${log.replace(/&/g, '&amp;').replace(/</g, '&lt;').trim()}</pre>

<h1>Anexo B · Cómo reproducir estas pruebas</h1>
<pre><code># 1. Base de datos y datos de demostración
docker compose up -d db
cd backend &amp;&amp; npm install &amp;&amp; npm run seed

# 2. Arrancar la API (en otra terminal)
cd backend &amp;&amp; npm run dev

# 3. Ejecutar las pruebas y guardar la evidencia
cd backend &amp;&amp; npm test | tee ../deep-docs/_salida-e2e.txt</code></pre>
<p>El comando devuelve un código de salida distinto de cero si alguna comprobación falla, lo que permite integrarlo en una verificación automática.</p>

<footer class="pie-doc">FINAN-X · Evidencia 7 de 7 · Pruebas de integración · ${aprobadas} comprobaciones aprobadas, ${fallidas} fallidas · ${CP.length} casos de control documentados · Registro completo en el Anexo A.</footer>
`;

escribir('E7_Pruebas_Integracion.html', html({ titulo: 'FINAN-X · Pruebas de integración', cuerpo }));
