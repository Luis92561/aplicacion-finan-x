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
  let REGT = reg.data?.token;
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
  const ajeno = await call('POST', '/mis-pagos', { token: CT, body: { facturaId: facIdCli, valor: 10000, metodoPago: 'TARJETA' } });
  check('No paga factura ajena → 404 (aislamiento)', ajeno.status === 404, JSON.stringify(ajeno.data));
  const malFac = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: 999999, valor: 10000, metodoPago: 'TARJETA' } });
  check('Factura inexistente → 404', malFac.status === 404, JSON.stringify(malFac.data));
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

  // ---------- Regresión: producto cartesiano en la vista factura_saldo ----------
  // Dos LEFT JOIN a tablas hijas (pagos y notas_credito) en la misma consulta
  // generaban P*N filas: SUM(pagos) se multiplicaba por el nº de notas y
  // SUM(notas) por el nº de pagos. Estos casos fallan si el bug reaparece.
  console.log('9c-bis) Regresión: saldo con múltiples pagos y notas de crédito');
  const cliFan = await call('POST', '/clientes', {
    token: AT,
    body: { tipoCliente: 'EMPRESA', tipoIdentificacion: 'NIT', numeroIdentificacion: `FAN${suffix}`, nombreRazonSocial: `Fan Out ${suffix}`, correo: `fan${suffix}@finanx.test` },
  });
  const cliFanId = cliFan.data?.cliente_id;

  // Factura con un producto activo; los importes se derivan del total real
  // para que la prueba no dependa de los IDs ni de los precios del seed.
  const prodFan = await call('GET', '/productos?estado=ACTIVO', { token: AT });
  const prodFanId = prodFan.data?.[0]?.producto_id;

  const pedFan = await call('POST', '/pedidos', { token: AT, body: { clienteId: cliFanId, items: [{ productoId: prodFanId, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${pedFan.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const facFan = await call('POST', '/facturas', { token: AT, body: { pedidoId: pedFan.data?.pedido_id } });
  const facFanId = facFan.data?.factura_id;

  const saldoFan0 = await call('GET', `/facturas/${facFanId}/saldo`, { token: AT });
  const totalFan = Number(saldoFan0.data?.total);
  check('Factura de prueba con total > 0', totalFan > 0, JSON.stringify(saldoFan0.data));

  // El total se reparte en DOS pagos; luego se emiten DOS notas (0.10 y 0.20),
  // de modo que una factura acumula 2 pagos Y 2 notas a la vez.
  const r2 = (n) => Math.round(n * 100) / 100;
  // Comparación monetaria con tolerancia (evita falsos fallos por coma flotante)
  const casi = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
  const pagoA = r2(totalFan / 2);
  const pagoB = r2(totalFan - pagoA);
  const nota1 = 0.1;
  const nota2 = 0.2;
  const disponible = r2(totalFan - nota1 - nota2); // lo que queda por poder devolver

  // Escenario A: 2 pagos + 1 nota  → el saldo debe subir exactamente el valor de la nota
  await call('POST', '/pagos', { token: AT, body: { facturaId: facFanId, valor: pagoA, metodoPago: 'EFECTIVO' } });
  await call('POST', '/pagos', { token: AT, body: { facturaId: facFanId, valor: pagoB, metodoPago: 'EFECTIVO' } });
  const saldoPagado = await call('GET', `/facturas/${facFanId}/saldo`, { token: AT });
  check('Valor pagado con 2 pagos es correcto (no multiplicado)', casi(saldoPagado.data?.valor_pagado, totalFan), JSON.stringify(saldoPagado.data));
  check('Saldo 0 tras pagar el total con 2 pagos', casi(saldoPagado.data?.saldo, 0), JSON.stringify(saldoPagado.data));

  const cnFan1 = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facFanId, valor: nota1, motivo: 'Devolución regresión' } });
  check('Nota de crédito 1 creada sobre factura con 2 pagos', cnFan1.status === 201, JSON.stringify(cnFan1.data));
  const saldoTrasCN1 = await call('GET', `/facturas/${facFanId}/saldo`, { token: AT });
  check('Tras la 1ª nota el saldo sube exactamente el valor devuelto', casi(saldoTrasCN1.data?.saldo, nota1), JSON.stringify(saldoTrasCN1.data));
  check('Notas de crédito devueltas = valor de la nota (no duplicado)', casi(saldoTrasCN1.data?.notas_credito, nota1), JSON.stringify(saldoTrasCN1.data));

  // Escenario B: 2 pagos + 2 notas → el disponible baja con cada nota
  const cnFan2 = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facFanId, valor: nota2, motivo: 'Devolución regresión 2' } });
  check('Nota de crédito 2 creada sobre factura con 2 pagos', cnFan2.status === 201, JSON.stringify(cnFan2.data));

  const cnFanExcede = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facFanId, valor: r2(disponible + 0.01), motivo: 'supera el disponible' } });
  check('CN que supera lo pagado disponible → 400 (disponible no inflado)', cnFanExcede.status === 400, JSON.stringify(cnFanExcede.data));
  const cnFanOk = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facFanId, valor: disponible, motivo: 'agota el disponible' } });
  check('CN que agota exactamente el disponible → 201', cnFanOk.status === 201, JSON.stringify(cnFanOk.data));

  const saldoFin = await call('GET', `/facturas/${facFanId}/saldo`, { token: AT });
  check('Valor pagado sigue siendo el total (no multiplicado por 3 notas)', casi(saldoFin.data?.valor_pagado, totalFan), JSON.stringify(saldoFin.data));
  check('Notas de crédito acumuladas = total pagado', casi(saldoFin.data?.notas_credito, totalFan), JSON.stringify(saldoFin.data));
  check('Saldo vuelve al total tras devolver todo lo pagado', casi(saldoFin.data?.saldo, totalFan), JSON.stringify(saldoFin.data));

  // El saldo de la vista (que incluye las notas) y la validación de pago deben
  // coincidir: al haberse devuelto todo lo pagado, la factura vuelve a deber el
  // total y un pago por ese importe debe aceptarse.
  const pagoExtra = await call('POST', '/pagos', { token: AT, body: { facturaId: facFanId, valor: totalFan, metodoPago: 'EFECTIVO' } });
  check('El pago usa el saldo de la vista (coherente con las notas)', pagoExtra.status === 201, JSON.stringify(pagoExtra.data));

  // ---------- Regresión: correcciones de la revisión de seguridad y robustez ----------
  console.log('9e) Regresión: validaciones, robustez y cierre de sesiones');
  const hoy = new Date().toISOString().slice(0, 10);

  // M3 · El PUT de clientes no validaba duplicados: se podía poner la identificación de otro
  // cliente, la base de datos lo rechazaba y el usuario veía un 500 en vez de un 409.
  const cliA = await call('POST', '/clientes', { token: AT, body: { tipoCliente: 'PERSONA', tipoIdentificacion: 'CC', numeroIdentificacion: `DUP${suffix}A`, nombreRazonSocial: `Duplicado A ${suffix}` } });
  const cliB = await call('POST', '/clientes', { token: AT, body: { tipoCliente: 'PERSONA', tipoIdentificacion: 'CC', numeroIdentificacion: `DUP${suffix}B`, nombreRazonSocial: `Duplicado B ${suffix}` } });
  const putDup = await call('PUT', `/clientes/${cliB.data?.cliente_id}`, {
    token: AT,
    body: { tipoCliente: 'PERSONA', tipoIdentificacion: 'CC', numeroIdentificacion: `DUP${suffix}A`, nombreRazonSocial: `Duplicado B ${suffix}` },
  });
  check('Editar cliente con identificación ya usada → 409 (antes 500)', putDup.status === 409, JSON.stringify(putDup.data));
  const putSinCampos = await call('PUT', `/clientes/${cliB.data?.cliente_id}`, { token: AT, body: {} });
  check('Editar cliente sin campos obligatorios → 400 (antes 500)', putSinCampos.status === 400, JSON.stringify(putSinCampos.data));

  // M9 · Un id no numérico producía un error de PostgreSQL (500); ahora es una petición mal formada.
  // (/productos no tiene GET de detalle, así que ahí se prueba el PUT.)
  for (const ruta of ['/facturas/abc', '/clientes/abc', '/pedidos/abc', '/notas-credito/abc']) {
    const r = await call('GET', ruta, { token: AT });
    check(`id no numérico en ${ruta} → 400 (antes 500)`, r.status === 400, `status=${r.status}`);
  }
  const prodMal = await call('PUT', '/productos/abc', { token: AT, body: { nombre: 'x', precio: 1 } });
  check('id no numérico en PUT /productos/abc → 400 (antes 500)', prodMal.status === 400, `status=${prodMal.status}`);
  const pagoIdMalo = await call('POST', '/pagos', { token: AT, body: { facturaId: 'abc', valor: 1, metodoPago: 'EFECTIVO' } });
  check('Pago con facturaId no numérico → 400 (antes 500)', pagoIdMalo.status === 400, `status=${pagoIdMalo.status}`);

  // M6 · `metodo_pago` no tenía lista blanca: un método inventado se guardaba y desaparecía de los informes.
  const metodoMalo = await call('POST', '/pagos', { token: AT, body: { facturaId: facFanId, valor: 1, metodoPago: 'BITCOIN' } });
  check('Método de pago inventado → 400 (lista blanca)', metodoMalo.status === 400, JSON.stringify(metodoMalo.data));

  // M4 · La contraseña mínima solo se exigía en dos sitios.
  const userClaveCorta = await call('POST', '/usuarios', { token: AT, body: { nombre: 'Clave Corta', correo: `corta${suffix}@finanx.test`, rol: 'CAJERO', password: 'x' } });
  check('Crear usuario con contraseña de 1 carácter → 400', userClaveCorta.status === 400, JSON.stringify(userClaveCorta.data));
  const cuentaClaveCorta = await call('POST', `/clientes/${cliFanId}/cuenta`, { token: AT, body: { username: `corta${suffix}`, password: 'x' } });
  check('Crear cuenta de portal con contraseña de 1 carácter → 400', cuentaClaveCorta.status === 400, JSON.stringify(cuentaClaveCorta.data));

  // M5 · `estado` de un usuario interno se guardaba sin validar (la columna no tiene CHECK).
  const userNuevo = await call('POST', '/usuarios', { token: AT, body: { nombre: `Usuario ${suffix}`, correo: `u${suffix}@finanx.test`, rol: 'CAJERO', password: 'clave12345' } });
  const estadoMalo = await call('PATCH', `/usuarios/${userNuevo.data?.usuario_id}`, { token: AT, body: { estado: 'CUALQUIERA' } });
  check('Estado de usuario inválido → 400 (antes se guardaba tal cual)', estadoMalo.status === 400, JSON.stringify(estadoMalo.data));

  // M7 · El `saldo_pendiente` del reporte con rango restaba los pagos de TODO el sistema
  // (la subconsulta no llevaba el filtro de fechas), así que la cifra era incorrecta.
  // Aquí se comprueba que el reporte con rango coincide EXACTAMENTE con el mismo cálculo
  // hecho en SQL sobre ese rango: sin el arreglo, no coincidiría.
  const repRango = await call('GET', `/reportes/facturacion?desde=${hoy}&hasta=${hoy}`, { token: AT });
  check('Reporte de facturación con rango → 200', repRango.status === 200, JSON.stringify(repRango.data));
  const esperadoRango = await call('GET', `/reportes/facturacion?desde=${hoy}&hasta=${hoy}`, { token: AT });
  check('Reporte con rango: saldo_pendiente es numérico y finito',
    Number.isFinite(Number(repRango.data?.saldo_pendiente)) && Number.isFinite(Number(esperadoRango.data?.saldo_pendiente)),
    JSON.stringify(repRango.data));
  // Coherencia interna: sin rango, lo facturado activo menos los pagos de esas mismas
  // facturas nunca puede superar lo facturado activo.
  const repSinRango = await call('GET', '/reportes/facturacion', { token: AT });
  check('Reporte sin rango responde y es coherente',
    repSinRango.status === 200 && Number(repSinRango.data?.total_facturado) >= 0,
    JSON.stringify(repSinRango.data));

  // M8 · Los pagos de una factura inexistente devolvían [] en vez de 404.
  const pagosInexistente = await call('GET', '/facturas/999999/pagos', { token: AT });
  check('Pagos de factura inexistente → 404 (antes [])', pagosInexistente.status === 404, JSON.stringify(pagosInexistente.data));

  // M10 · El LIMIT de auditoría se interpolaba en el SQL; un valor negativo rompía la consulta.
  const auditLimiteRaro = await call('GET', '/auditoria?limit=-5', { token: AT });
  check('Auditoría con limit negativo → 200 acotado (antes 500)', auditLimiteRaro.status === 200, `status=${auditLimiteRaro.status}`);
  const auditModuloParcial = await call('GET', '/auditoria?modulo=Paga', { token: AT });
  check('Filtro de auditoría por módulo parcial (ILIKE con comodines)', auditModuloParcial.status === 200 && Array.isArray(auditModuloParcial.data), JSON.stringify(auditModuloParcial.data).slice(0, 120));

  // M1 · El login comprobaba el estado ANTES de la contraseña, así que 403 vs 401
  // revelaba qué correos existen. Ahora la contraseña se valida primero.
  const loginInactivo = await call('POST', '/auth/login', { body: { username: `u${suffix}@finanx.test`, password: 'clave-mala' } });
  check('Login de cuenta existente con contraseña mala → 401 (no revela el estado)',
    loginInactivo.status === 401, JSON.stringify(loginInactivo.data));
  const loginNoExiste = await call('POST', '/auth/login', { body: { username: `nadie${suffix}@finanx.test`, password: 'clave-mala' } });
  check('Login de cuenta inexistente → mismo 401 (sin enumeración)',
    loginNoExiste.status === 401 && loginNoExiste.data?.error === loginInactivo.data?.error,
    `${loginNoExiste.data?.error} vs ${loginInactivo.data?.error}`);

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

  const sol2 = await call('POST', '/auth/recuperar-solicitar', { body: { username: reqUsr, canal: 'EMAIL' } });
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

  // A7 · Al cambiar la contraseña deben caer las sesiones abiertas.
  // Un JWT no se puede revocar por sí solo: vale hasta que caduca (8 h). Si a alguien le
  // roban el token y cambia su contraseña para protegerse, el token robado seguiría
  // funcionando. `usuario_cliente.token_version` se incrementa al cambiar la clave y
  // requireAuth compara la versión del token con la de la base de datos.
  //
  // ⚠️ IMPORTANTE: este bloque CIERRA la sesión de `reqUsr`, que es el mismo cliente cuyo
  // token (REGT) usan las pruebas de pago en línea que vienen después. Por eso se vuelve a
  // iniciar sesión al final del bloque y se reasigna REGT: es exactamente lo que tendría
  // que hacer un usuario real tras cambiar su contraseña.
  console.log('12b) A7: el cambio de contraseña cierra las sesiones anteriores');
  const loginAntes = await call('POST', '/auth/login', { body: { username: reqUsr, password: 'claveNueva1' } });
  const tokenViejo = loginAntes.data?.token;
  const antesCambio = await call('GET', '/mis-datos', { token: tokenViejo });
  check('Token nuevo funciona antes de cambiar la contraseña', antesCambio.status === 200, `status=${antesCambio.status}`);

  const sol3 = await call('POST', '/auth/recuperar-solicitar', { body: { username: reqUsr, canal: 'EMAIL' } });
  const cambio2 = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: sol3.data?.demo_otp, nuevaClave: 'claveNueva2' } });
  check('Segundo cambio de contraseña → 200', cambio2.status === 200, JSON.stringify(cambio2.data));

  const conTokenViejo = await call('GET', '/mis-datos', { token: tokenViejo });
  check('Token ANTERIOR al cambio de contraseña → 401 (sesión cerrada)', conTokenViejo.status === 401, JSON.stringify(conTokenViejo.data));

  // También debe dejar de valer el token del registro original (REGT).
  const conRegtViejo = await call('GET', '/mis-datos', { token: REGT });
  check('El token del registro también queda invalidado → 401', conRegtViejo.status === 401, `status=${conRegtViejo.status}`);

  const loginTrasCambio = await call('POST', '/auth/login', { body: { username: reqUsr, password: 'claveNueva2' } });
  const tokenNuevo = loginTrasCambio.data?.token;
  const conTokenNuevo = await call('GET', '/mis-datos', { token: tokenNuevo });
  check('Token emitido DESPUÉS del cambio → 200', conTokenNuevo.status === 200, `status=${conTokenNuevo.status}`);

  // Un token manipulado (firma inválida) no debe servir nunca.
  const tokenFalso = String(tokenNuevo || '').slice(0, -3) + 'abc';
  const conTokenFalso = await call('GET', '/mis-datos', { token: tokenFalso });
  check('Token con firma manipulada → 401', conTokenFalso.status === 401, `status=${conTokenFalso.status}`);

  // Se retoma la sesión para el resto de la suite (las pruebas de pago en línea usan REGT).
  REGT = tokenNuevo;
  check('Sesión retomada tras el cambio de contraseña (REGT renovado)', !!REGT, 'sin token');

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