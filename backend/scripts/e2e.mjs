/**
 * FINAN-X · Pruebas end-to-end de la API
 * Requiere: backend corriendo en http://localhost:4000 y base con seed.
 *
 * Ejecutar:  node scripts/e2e.mjs   (o  npm test)
 * Salida:    0 = OK, 1 = falló alguna prueba
 */
import 'dotenv/config';

const BASE = process.env.API_BASE || 'http://localhost:4000/api';
let passed = 0;
let failed = 0;
const errors = [];

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    errors.push(`${name} ${extra}`);
    console.error(`  ✘ ${name} ${extra}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* vacío */ }
  return { status: res.status, data };
}

const suffix = Date.now().toString().slice(-6);

async function main() {
  console.log('\n=== FINAN-X · Pruebas end-to-end ===\n');

  // ---------- Autenticación ----------
  console.log('1) Autenticación');
  const bad = await call('POST', '/auth/login', { body: { username: 'x@x.com', password: 'mala' } });
  check('Login inválido → 401', bad.status === 401);
  const sinToken = await call('GET', '/clientes');
  check('Sin token → 401', sinToken.status === 401);

  const admin = await call('POST', '/auth/login', { body: { username: 'admin@finanx.test', password: 'admin123' } });
  check('Login admin → 200', admin.status === 200 && admin.data?.user?.rol === 'ADMIN');
  const clienteLogin = await call('POST', '/auth/login', { body: { username: 'cliente@finanx.test', password: 'cliente123' } });
  check('Login cliente → 200', clienteLogin.status === 200 && clienteLogin.data?.user?.tipo === 'cliente');
  const AT = admin.data?.token;
  const CT = clienteLogin.data?.token;

  // ---------- Autoregistro de clientes ----------
  console.log('1b) Autoregistro de clientes');
  const regSuf = `R${suffix}`;
  const reg = await call('POST', '/auth/registro', {
    body: {
      nombreRazonSocial: `Cliente Nuevo ${suffix}`,
      numeroIdentificacion: `1122${regSuf}`,
      correo: `nuevo${regSuf}@mail.co`,
      ciudad: 'Pereira',
      username: `nuevo${regSuf}`,
      password: 'secreto1',
    },
  });
  check('Registrar cliente → 201 con token', reg.status === 201 && !!reg.data?.token && reg.data?.user?.tipo === 'cliente', JSON.stringify(reg.data));
  const REGT = reg.data?.token;
  const dupIdent = await call('POST', '/auth/registro', {
    body: { nombreRazonSocial: 'Duplicado', numeroIdentificacion: `1122${regSuf}`, username: `otro${regSuf}`, password: 'secreto1' },
  });
  check('Identificación duplicada → 409', dupIdent.status === 409, JSON.stringify(dupIdent.data));
  const dupUser = await call('POST', '/auth/registro', {
    body: { nombreRazonSocial: 'Otro', numeroIdentificacion: `2211${regSuf}`, username: `nuevo${regSuf}`, password: 'secreto1' },
  });
  check('Usuario duplicado → 409', dupUser.status === 409, JSON.stringify(dupUser.data));
  const corta = await call('POST', '/auth/registro', {
    body: { nombreRazonSocial: 'Corta', numeroIdentificacion: `3311${regSuf}`, username: `ab${regSuf}`, password: '123' },
  });
  check('Contraseña corta → 400', corta.status === 400);
  const sinNombre = await call('POST', '/auth/registro', { body: { numeroIdentificacion: `4411${regSuf}`, username: `sn${regSuf}`, password: 'secreto1' } });
  check('Faltan datos obligatorios → 400', sinNombre.status === 400);
  const misNuevo = await call('GET', '/mis-facturas', { token: REGT });
  check('Cliente registrado entra al portal aislado', misNuevo.status === 200 && Array.isArray(misNuevo.data));

  // ---------- Autorización por rol ----------
  console.log('2) Autorización por rol');
  const facturador = await call('POST', '/auth/login', { body: { username: 'facturador@finanx.test', password: 'facturador123' } });
  const FT = facturador.data?.token;
  const adminOnly = await call('GET', '/usuarios', { token: FT });
  check('Facturador en /usuarios → 403', adminOnly.status === 403);
  const clienteEnInternas = await call('GET', '/clientes', { token: CT });
  check('Cliente en /clientes → 403', clienteEnInternas.status === 403);

  // ---------- Clientes ----------
  console.log('3) Gestión de clientes (RF-C01..C06)');
  const nc = await call('POST', '/clientes', {
    token: AT,
    body: { tipoCliente: 'EMPRESA', tipoIdentificacion: 'NIT', numeroIdentificacion: `900${suffix}`, nombreRazonSocial: `Empresa Prueba ${suffix}`, correo: `prueba${suffix}@corp.co`, ciudad: 'Cali' },
  });
  check('Crear cliente → 201', nc.status === 201, JSON.stringify(nc.data));
  const cid = nc.data?.cliente_id;
  const dup = await call('POST', '/clientes', {
    token: AT,
    body: { tipoIdentificacion: 'NIT', numeroIdentificacion: `900${suffix}`, nombreRazonSocial: 'Duplicado' },
  });
  check('Cliente duplicado → 409', dup.status === 409, JSON.stringify(dup.data));
  const lista = await call('GET', `/clientes?q=${suffix}`, { token: AT });
  check('Búsqueda de cliente', lista.status === 200 && lista.data.some((c) => c.cliente_id === cid));
  const activo = await call('PATCH', `/clientes/${cid}/estado`, { token: AT, body: { estado: 'INACTIVO' } });
  check('Inactivar cliente', activo.status === 200);

  // ---------- Productos ----------
  console.log('4) Gestión de productos (CU-15..CU-19)');
  const np = await call('POST', '/productos', {
    token: AT,
    body: { codigo: `PROD-T${suffix}`, nombre: 'Producto de prueba', precio: 250000, impuesto: 19, categoria: 'Prueba' },
  });
  check('Crear producto → 201', np.status === 201, JSON.stringify(np.data));
  const pid = np.data?.producto_id;
  const pdup = await call('POST', '/productos', { token: AT, body: { codigo: `PROD-T${suffix}`, nombre: 'X', precio: 10 } });
  check('Código duplicado → 409', pdup.status === 409);
  const pneg = await call('POST', '/productos', { token: AT, body: { codigo: `PROD-N${suffix}`, nombre: 'Y', precio: -5 } });
  check('Precio negativo → 400', pneg.status === 400);

  // ---------- Pedido (cálculos en servidor) ----------
  console.log('5) Pedidos (CU-20..CU-24) — cálculo en servidor');
  const oped = await call('POST', '/pedidos', {
    token: AT,
    body: {
      clienteId: 1,
      observaciones: 'Pedido e2e',
      items: [
        { productoId: pid, cantidad: 3 },
        { productoId: 2, cantidad: 2 },
      ],
    },
  });
  check('Crear pedido → 201 con total calculado', oped.status === 201 && Number(oped.data?.total) > 0, JSON.stringify(oped.data));
  const pedidoId = oped.data?.pedido_id;
  const t2 = await call('GET', `/pedidos/${pedidoId}`, { token: AT });
  const expectLinea1 = 250000 * 3;           // producto e2e 19% → 750000, imp 142500
  const expectLinea2 = 120000 * 2;           // mouse 19%   → 240000, imp 45600
  const subtotalEsp = expectLinea1 + expectLinea2;
  const impEsp = expectLinea1 * 0.19 + expectLinea2 * 0.19;
  const totEsp = Math.round((subtotalEsp + impEsp) * 100) / 100;
  check(
    'Totales calculados por el servidor',
    Math.abs(t2.data?.subtotal - subtotalEsp) < 0.01 && Math.abs(t2.data?.impuestos - impEsp) < 0.01 && Math.abs(t2.data?.total - totEsp) < 0.01,
    `subtotal=${t2.data?.subtotal} esp=${subtotalEsp} imp=${t2.data?.impuestos} esp=${impEsp}`
  );
  const conf = await call('PATCH', `/pedidos/${pedidoId}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  check('Confirmar pedido', conf.status === 200);
  // Modificar un pedido confirmado debe fallar
  const mod = await call('PUT', `/pedidos/${pedidoId}`, { token: AT, body: { items: [{ productoId: pid, cantidad: 1 }] } });
  check('Modificar pedido CONFIRMADO → 409', mod.status === 409);

  // ---------- Facturación ----------
  console.log('6) Facturación (CU-25..CU-30)');
  const factCompleta = await call('POST', '/facturas', { token: AT, body: { pedidoId } });
  check('Generar factura → 201', factCompleta.status === 201, JSON.stringify(factCompleta.data));
  const fid = factCompleta.data?.factura_id;
  const refac = await call('POST', '/facturas', { token: AT, body: { pedidoId } });
  check('Refacturar mismo pedido → 409', refac.status === 409);
  const saldo = await call('GET', `/facturas/${fid}/saldo`, { token: AT });
  check('Saldo inicial = total (PENDIENTE)', saldo.data?.estado_pago === 'PENDIENTE' && Number(saldo.data?.saldo) === Number(saldo.data?.total));

  // ---------- Pagos ----------
  console.log('7) Pagos (RF-04..RF-06)');
  const medio = await call('POST', '/pagos', { token: AT, body: { facturaId: fid, valor: 100000, metodoPago: 'EFECTIVO' } });
  check('Pago parcial → PAGO_PARCIAL', medio.status === 201 && medio.data?.estado_pago === 'PAGO_PARCIAL', JSON.stringify(medio.data));
  const over = await call('POST', '/pagos', { token: AT, body: { facturaId: fid, valor: Number(saldo.data?.total) * 2 } });
  check('Sobrepago → 400', over.status === 400, JSON.stringify(over.data));
  const completo = await call('POST', '/pagos', { token: AT, body: { facturaId: fid, valor: Number(saldo.data?.total) - 100000, metodoPago: 'TRANSFERENCIA', referencia: 'E2E-GIRO', banco: 'BancoDemo', numeroCuenta: '9876543210' } });
  check('Pago completo → PAGADA', completo.status === 201 && completo.data?.estado_pago === 'PAGADA', JSON.stringify(completo.data));
  const saldo2 = await call('GET', `/facturas/${fid}/saldo`, { token: AT });
  check('Saldo final = 0', Number(saldo2.data?.saldo) === 0);

  // ---------- Anulación ----------
  console.log('8) Anulación (RF-03)');
  // Pedido nuevo → factura sin pagos → anular
  const ped2 = await call('POST', '/pedidos', { token: AT, body: { clienteId: 1, items: [{ productoId: pid, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${ped2.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const fac2 = await call('POST', '/facturas', { token: AT, body: { pedidoId: ped2.data?.pedido_id } });
  const anu = await call('POST', `/facturas/${fac2.data?.factura_id}/anular`, { token: AT, body: { motivo: 'Prueba e2e' } });
  check('Anular factura sin pagos → OK', anu.status === 200, JSON.stringify(anu.data));
  const anuPagos = await call('POST', `/facturas/${fid}/anular`, { token: AT, body: { motivo: 'x' } });
  check('Anular factura con pagos → 409', anuPagos.status === 409, JSON.stringify(anuPagos.data));
  const anuSinMotivo = await call('POST', `/facturas/${fac2.data?.factura_id}/anular`, { token: AT, body: {} });
  check('Anular sin motivo → 400', anuSinMotivo.status === 400);

  // ---------- Portal del cliente / aislamiento ----------
  console.log('9) Portal del cliente (CU-09..CU-14) — aislamiento');
  const mis = await call('GET', '/mis-facturas', { token: CT });
  check('Mis facturas (solo las propias)', mis.status === 200, JSON.stringify(mis.data));
  const ajenas = mis.data.filter((f) => f.cliente_id !== clienteLogin.data?.user?.clienteId);
  check('Ninguna factura de otro cliente', ajenas.length === 0);
  const saldoCli = await call('GET', '/mi-saldo', { token: CT });
  check('Mi saldo disponible', saldoCli.status === 200 && typeof saldoCli.data?.saldo_pendiente === 'number');
  const datos = await call('GET', '/mis-datos', { token: CT });
  check('Mis datos = cliente autenticado', datos.data?.cliente_id === clienteLogin.data?.user?.clienteId);

  // ---------- Pago desde el portal del cliente ----------
  console.log('9b) Pago desde el portal del cliente');
  const cliNuevoId = reg.data?.user?.clienteId;
  // Área admin: pedido + factura para el cliente recién registrado
  const pedCli = await call('POST', '/pedidos', { token: AT, body: { clienteId: cliNuevoId, items: [{ productoId: 2, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${pedCli.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const facCli = await call('POST', '/facturas', { token: AT, body: { pedidoId: pedCli.data?.pedido_id } });
  const facIdCli = facCli.data?.factura_id;
  check('Factura creada para cliente nuevo', facCli.status === 201, JSON.stringify(facCli.data));
  const ajeno = await call('POST', '/mis-pagos', { token: CT, body: { facturaId: facIdCli, valor: 10000 } });
  check('No paga factura ajena → 404 (aislamiento)', ajeno.status === 404, JSON.stringify(ajeno.data));
  const malFac = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: 999999, valor: 10000 } });
  check('Factura inexistente → 404', malFac.status === 404);
  const pagoCli = await call('POST', '/mis-pagos', { token: REGT, body: {
    facturaId: facIdCli, valor: 50000, metodoPago: 'TARJETA', referencia: 'PORTAL-E2E',
    numeroTarjeta: '4111111111111111', codigoSeguridad: '123', vencimientoTarjeta: '12/30',
    banco: 'BancoDemo', titularTarjeta: 'Cliente E2E',
  } });
  check('Abono desde portal → 201 PAGO_PARCIAL', pagoCli.status === 201 && pagoCli.data?.estado_pago === 'PAGO_PARCIAL', JSON.stringify(pagoCli.data));
  const sobreCli = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facIdCli, valor: 5000000 } });
  check('Sobrepago desde portal → 400', sobreCli.status === 400, JSON.stringify(sobreCli.data));
  const misP = await call('GET', '/mis-pagos', { token: REGT });
  check('Pago visible en «mis pagos»', misP.status === 200 && misP.data.some((p) => p.numero_factura === facCli.data?.numero_factura && Number(p.valor) === 50000));
  const saldoNuevo = await call('GET', '/mi-saldo', { token: REGT });
  check('Saldo del cliente refleja el abono', saldoNuevo.status === 200 && Number(saldoNuevo.data?.saldo_pendiente) > 0);
  const portalSinToken = await call('POST', '/mis-pagos', { body: { facturaId: facIdCli, valor: 100 } });
  check('Pago desde portal sin token → 401', portalSinToken.status === 401);

  // ---------- Notas de crédito (devoluciones) ----------
  console.log('9c) Notas de crédito');
  const cnAnulada = await call('POST', '/notas-credito', { token: AT, body: { facturaId: fac2.data?.factura_id, valor: 100, motivo: 'x' } });
  check('CN sobre factura anulada → 409', cnAnulada.status === 409, JSON.stringify(cnAnulada.data));
  const ped3 = await call('POST', '/pedidos', { token: AT, body: { clienteId: 1, items: [{ productoId: 2, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${ped3.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const fac3 = await call('POST', '/facturas', { token: AT, body: { pedidoId: ped3.data?.pedido_id } });
  const cnSinPagos = await call('POST', '/notas-credito', { token: AT, body: { facturaId: fac3.data?.factura_id, valor: 1000, motivo: 'test' } });
  check('CN sin pagos disponibles → 409', cnSinPagos.status === 409, JSON.stringify(cnSinPagos.data));
  const cnSinMotivo = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 1000 } });
  check('CN sin motivo → 400', cnSinMotivo.status === 400);
  const cnValor0 = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 0, motivo: 'x' } });
  check('CN valor 0 → 400', cnValor0.status === 400);
  const cnOver = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 999999999, motivo: 'x' } });
  check('CN supera lo pagado → 400', cnOver.status === 400, JSON.stringify(cnOver.data));
  const cn = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 10000, motivo: 'Devolución e2e' } });
  check('Crear CN → 201 con número NC-', cn.status === 201 && String(cn.data?.numero_nota || '').startsWith('NC-'), JSON.stringify(cn.data));
  const cnId = cn.data?.nota_credito_id;
  const cnDetalle = await call('GET', `/notas-credito/${cnId}`, { token: AT });
  check('Detalle de CN', cnDetalle.status === 200 && cnDetalle.data?.numero_nota === cn.data?.numero_nota);
  const saldoTrasCN = await call('GET', `/facturas/${facIdCli}/saldo`, { token: AT });
  check('Saldo sube tras la CN (reversa el pago devuelto)', Number(saldoTrasCN.data?.saldo) === Number(saldoTrasCN.data?.total) - 50000 + 10000, JSON.stringify(saldoTrasCN.data));
  const listaCN = await call('GET', '/notas-credito?estado=ACTIVA', { token: AT });
  check('Lista de CN activas incluye la creada', listaCN.status === 200 && listaCN.data.some((x) => x.nota_credito_id === cnId));
  const misNCLogin = await call('GET', '/mis-notas-credito', { token: REGT });
  check('Portal: mis notas crédito (aislado al cliente)', misNCLogin.status === 200 && misNCLogin.data.some((x) => x.nota_credito_id === cnId));
  const anuCN = await call('POST', `/notas-credito/${cnId}/anular`, { token: AT, body: { motivo: 'Error de registro e2e' } });
  check('Anular CN → OK', anuCN.status === 200 && anuCN.data?.estado === 'ANULADA');
  const anuCN2 = await call('POST', `/notas-credito/${cnId}/anular`, { token: AT, body: { motivo: 'x' } });
  check('Reanular CN → 409', anuCN2.status === 409);
  const anuCNsin = await call('POST', `/notas-credito/${cnId}/anular`, { token: AT, body: {} });
  check('Anular CN sin motivo → 400', anuCNsin.status === 400);

  // ---------- Balance por cliente y envío por correo ----------
  console.log('9d) Balance por cliente y envío del estado financiero');
  const balance = await call('GET', '/reportes/balance-clientes', { token: AT });
  check('Balance por cliente → 200 con resumen y lista', balance.status === 200 && Array.isArray(balance.data?.clientes) && balance.data?.clientes.length > 0, JSON.stringify(balance.data).slice(0, 200));
  check('Resumen del balance coherente', Number(balance.data?.resumen?.saldo_total) >= 0 && Number(balance.data?.resumen?.clientes_con_saldo) >= 0);
  const balCli = balance.data?.clientes.find((c) => c.cliente_id === cliNuevoId);
  check('El cliente nuevo aparece en el balance', !!balCli && Number(balCli?.saldo_pendiente) > 0);
  const correoResumen = await call('GET', `/clientes/${cliNuevoId}/resumen-correo`, { token: AT });
  check('Resumen financiero para correo → asunto + cuerpo + destinatario',
    correoResumen.status === 200 && correoResumen.data?.asunto && !!correoResumen.data?.destinatario && correoResumen.data?.cuerpo.includes('FINAN-X'), JSON.stringify(correoResumen.data));
  check('Cuerpo incluye facturas y saldos', /FACTURAS|Saldo|saldo/i.test(correoResumen.data?.cuerpo || ''));
  const correoSinCliente = await call('GET', '/clientes/999999/resumen-correo', { token: AT });
  check('Resumen de cliente inexistente → 404', correoSinCliente.status === 404);

  // ---------- Reportes y auditoría ----------
  console.log('10) Reportes y auditoría');
  const resumen = await call('GET', '/reportes/resumen', { token: AT });
  check('Resumen de reportes', resumen.status === 200 && typeof resumen.data?.facturas_activas === 'number');
  const auditoria = await call('GET', '/auditoria?modulo=Pagos', { token: AT });
  check('Auditoría registra pagos', auditoria.status === 200 && auditoria.data.length >= 2);

  // ---------- Seguridad (cabeceras HTTP, CORS y límite de intentos) ----------
  console.log('11) Seguridad (cabeceras HTTP, CORS y rate limit)');
  const h = await fetch(`${BASE}/health`);
  check('Cabecera de seguridad X-Content-Type-Options: nosniff', h.headers.get('x-content-type-options') === 'nosniff');
  check('Cabecera de seguridad X-Frame-Options presente', !!h.headers.get('x-frame-options'));
  check('No se revela el motor web (sin X-Powered-By)', !h.headers.get('x-powered-by'));

  const corsOk = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:8080' } });
  check('CORS: origen permitido recibe la cabecera', corsOk.headers.get('access-control-allow-origin') === 'http://localhost:8080');
  const corsEvil = await fetch(`${BASE}/health`, { headers: { Origin: 'http://malicioso.example' } });
  check('CORS: origen no permitido es bloqueado', corsEvil.headers.get('access-control-allow-origin') === null);

  let ultimoIntento = null;
  for (let i = 0; i < 30; i++) {
    ultimoIntento = await call('POST', '/auth/login', { body: { username: `e2e-${Date.now()}-${i}@x.test`, password: 'mala' } });
    if (ultimoIntento.status === 429) break;
  }
  check('Fuerza bruta: intentos fallidos consecutivos → 429', ultimoIntento.status === 429, JSON.stringify(ultimoIntento.data));
  const okTrasBloqueo = await call('POST', '/auth/login', { body: { username: 'cliente@finanx.test', password: 'cliente123' } });
  check('Login correcto tras bloqueo → 200 (el acierto resetea el contador)', okTrasBloqueo.status === 200, JSON.stringify(okTrasBloqueo.data));
  const datosTrasTodo = await call('GET', '/mis-datos', { token: okTrasBloqueo.data?.token });
  check('Token renovado sigue aislado en el portal', datosTrasTodo.status === 200 && datosTrasTodo.data?.cliente_id === clienteLogin.data?.user?.clienteId);

  // ---------- Recuperación de contraseña (OTP) y datos de pago en línea ----------
  console.log('12) Recuperación de contraseña (OTP) y datos de pago en línea');
  const reqUsr = `nuevo${regSuf}`; // cliente autoregistrado en 1b (contraseña original 'secreto1')

  // --- Flujo de recuperación con código de un solo uso ---
  const sol = await call('POST', '/auth/recuperar-solicitar', { body: { username: reqUsr, canal: 'EMAIL' } });
  check('Solicitar código → 200 y en demo llega el OTP', sol.status === 200 && /^\d{6}$/.test(String(sol.data?.demo_otp || '')), JSON.stringify(sol.data));
  const solSinUsr = await call('POST', '/auth/recuperar-solicitar', { body: {} });
  check('Solicitud sin usuario → 400', solSinUsr.status === 400);
  const solInex = await call('POST', '/auth/recuperar-solicitar', { body: { username: 'noexiste-xyz-999' } });
  check('Cuenta inexistente no se revela (200 genérica sin OTP)', solInex.status === 200 && !solInex.data?.demo_otp, JSON.stringify(solInex.data));

  let ultimoWrong = null;
  for (let i = 0; i < 5; i++) {
    ultimoWrong = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: '000000', nuevaClave: 'claveNueva1' } });
  }
  check('Código incorrecto → 401 en cada intento y se bloquea a los 5', ultimoWrong.status === 401, JSON.stringify(ultimoWrong.data));
  const trasBloqueo = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: sol.data?.demo_otp, nuevaClave: 'claveNueva1' } });
  check('Con intentos agotados el código correcto ya no vale', trasBloqueo.status === 400 || trasBloqueo.status === 429, JSON.stringify(trasBloqueo.data));

  const sol2 = await call('POST', '/auth/recuperar-solicitar', { body: { username: reqUsr, canal: 'SMS' } });
  check('Nuevo código tras agotar el anterior', sol2.status === 200 && /^\d{6}$/.test(String(sol2.data?.demo_otp || '')), JSON.stringify(sol2.data));
  const codMal = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: '111111', nuevaClave: 'claveNueva1' } });
  check('Código incorrecto rechazado → 401', codMal.status === 401);
  const cambio = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: sol2.data?.demo_otp, nuevaClave: 'claveNueva1' } });
  check('Cambiar contraseña con código válido → 200', cambio.status === 200, JSON.stringify(cambio.data));
  const loginNueva = await call('POST', '/auth/login', { body: { username: reqUsr, password: 'claveNueva1' } });
  check('Login con la nueva contraseña → 200', loginNueva.status === 200 && loginNueva.data?.user?.tipo === 'cliente', JSON.stringify(loginNueva.data));
  const loginVieja = await call('POST', '/auth/login', { body: { username: reqUsr, password: 'secreto1' } });
  check('La contraseña anterior ya no sirve → 401', loginVieja.status === 401);
  const reuso = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: sol2.data?.demo_otp, nuevaClave: 'otraClave123' } });
  check('El código usado no se puede reutilizar', reuso.status === 400, JSON.stringify(reuso.data));

  // --- Datos de pago en línea (tarjeta / transferencia / cheque) ---
  const pedP = await call('POST', '/pedidos', { token: AT, body: { clienteId: cliNuevoId, items: [{ productoId: 2, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${pedP.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const facP = await call('POST', '/facturas', { token: AT, body: { pedidoId: pedP.data?.pedido_id } });
  const facPId = facP.data?.factura_id;
  check('Factura nueva para pruebas de pago en línea', facP.status === 201 && !!facPId, JSON.stringify(facP.data));

  const tjFaltan = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA' } });
  check('Tarjeta sin datos → 400 (campos obligatorios)', tjFaltan.status === 400, JSON.stringify(tjFaltan.data));
  const tjCv = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '12', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cliente E2E' } });
  check('Tarjeta con CVV inválido → 400', tjCv.status === 400, JSON.stringify(tjCv.data));
  const tjLuhn = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111112', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cliente E2E' } });
  check('Tarjeta que no pasa Luhn → 400', tjLuhn.status === 400, JSON.stringify(tjLuhn.data));
  const tjVencida = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '01/20', titularTarjeta: 'Cliente E2E' } });
  check('Tarjeta vencida → 400', tjVencida.status === 400, JSON.stringify(tjVencida.data));
  const tjOK = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cliente E2E' } });
  check('Pago con tarjeta válida → 201', tjOK.status === 201, JSON.stringify(tjOK.data));
  const trFaltan = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TRANSFERENCIA' } });
  check('Transferencia sin datos → 400', trFaltan.status === 400, JSON.stringify(trFaltan.data));
  const trOK = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TRANSFERENCIA', banco: 'BancoDemo', numeroCuenta: '1234567890', referencia: 'COMP-E2E-1' } });
  check('Pago por transferencia válido → 201', trOK.status === 201, JSON.stringify(trOK.data));
  const chFaltan = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'CHEQUE' } });
  check('Cheque sin banco → 400', chFaltan.status === 400, JSON.stringify(chFaltan.data));

  const tjIntFaltan = await call('POST', '/pagos', { token: AT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA' } });
  check('Interno: tarjeta sin datos → 400 (validación compartida)', tjIntFaltan.status === 400, JSON.stringify(tjIntFaltan.data));
  const tjIntOK = await call('POST', '/pagos', { token: AT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cajero' } });
  check('Interno: pago con tarjeta válida → 201', tjIntOK.status === 201, JSON.stringify(tjIntOK.data));
  const chequeInterno = await call('POST', '/pagos', { token: AT, body: { facturaId: facPId, valor: 1000, metodoPago: 'CHEQUE', banco: 'BancoDemo', referencia: 'CHQ-1001' } });
  check('Interno: cheque con banco y número → 201', chequeInterno.status === 201, JSON.stringify(chequeInterno.data));

  const listaP = await call('GET', '/mis-pagos', { token: REGT });
  const tjReg = listaP.data?.find((p) => p.pago_id === tjOK.data?.pago_id);
  check('Se guardan solo los últimos 4 dígitos y la marca de la tarjeta', !!tjReg && tjReg?.ultimos_digitos_tarjeta === '1111' && tjReg?.tipo_tarjeta === 'VISA', JSON.stringify(tjReg));
  const crudo = JSON.stringify(listaP.data);
  check('Nunca se exponen CVV ni número completo de tarjeta', !crudo.includes('codigoSeguridad') && !crudo.includes('4111111111111111'));

  // ---------- Resumen ----------
  console.log(`\n=== Resultado: ${passed} aprobadas, ${failed} fallidas ===\n`);
  if (failed > 0) {
    console.error('Pruebas fallidas:');
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Error ejecutando las pruebas:', err);
  process.exit(1);
});