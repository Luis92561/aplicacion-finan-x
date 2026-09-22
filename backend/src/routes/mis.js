import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireCliente } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2, validarDatosPago } from '../utils.js';

const router = Router();

// Todas las rutas del portal requieren sesión de cliente.
// El clienteId SIEMPRE se toma del token autenticado (aislamiento por cliente).
router.use(requireAuth, requireCliente);

// GET /api/mis-datos
router.get('/mis-datos', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT cliente_id, tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social,
              telefono, correo, direccion, ciudad, estado
       FROM clientes WHERE cliente_id = $1`,
      [req.user.clienteId]
    );
    if (!rows.rowCount) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/mis-pedidos
router.get('/mis-pedidos', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT p.pedido_id, p.numero_pedido, p.fecha, p.subtotal::float8, p.impuestos::float8, p.total::float8, p.estado,
              (SELECT numero_factura FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS numero_factura
       FROM pedidos p WHERE p.cliente_id = $1 ORDER BY p.pedido_id DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/mis-pedidos/:id — detalle (verifica pertenencia)
router.get('/mis-pedidos/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ped = await pool.query(
      `SELECT p.pedido_id, p.numero_pedido, p.fecha, p.subtotal::float8, p.impuestos::float8, p.total::float8, p.estado, p.observaciones
       FROM pedidos p WHERE p.pedido_id = $1 AND p.cliente_id = $2`,
      [id, req.user.clienteId]
    );
    if (!ped.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const lineas = await pool.query(
      `SELECT d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8, pr.nombre AS producto_nombre, pr.codigo
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [id]
    );
    res.json({ ...ped.rows[0], lineas: lineas.rows });
  } catch (e) { next(e); }
});

// GET /api/mis-facturas
router.get('/mis-facturas', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT v.factura_id, v.cliente_id, v.numero_factura, v.pedido_id, v.fecha_emision, v.fecha_vencimiento,
              v.total::float8, v.valor_pagado::float8, v.saldo::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 ORDER BY v.fecha_emision DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/mis-facturas/:id
router.get('/mis-facturas/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const f = await pool.query(
      `SELECT v.*, v.total::float8, v.valor_pagado::float8, v.saldo::float8, p.numero_pedido
       FROM factura_saldo v JOIN pedidos p ON p.pedido_id = v.pedido_id
       WHERE v.factura_id = $1 AND v.cliente_id = $2`,
      [id, req.user.clienteId]
    );
    if (!f.rowCount) return res.status(404).json({ error: 'Factura no encontrada' });
    const lineas = await pool.query(
      `SELECT d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8, pr.nombre AS producto_nombre, pr.codigo
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [f.rows[0].pedido_id]
    );
    const pagos = await pool.query(
      `SELECT numero_pago, fecha, valor::float8, metodo_pago, referencia
       FROM pagos WHERE factura_id = $1 ORDER BY fecha`,
      [id]
    );
    res.json({ ...f.rows[0], lineas: lineas.rows, pagos: pagos.rows });
  } catch (e) { next(e); }
});

// GET /api/mis-pagos
router.get('/mis-pagos', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT pg.pago_id, pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.referencia, pg.observaciones,
              pg.banco, pg.titular, pg.tipo_tarjeta, pg.ultimos_digitos_tarjeta, pg.vencimiento_tarjeta, pg.numero_cuenta,
              f.numero_factura, f.estado
       FROM pagos pg JOIN facturas f ON f.factura_id = pg.factura_id
       WHERE f.cliente_id = $1 ORDER BY pg.fecha DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// Código de pago Efecty: determinístico por factura + valor.
// 14 dígitos (factura 4 + valor en centavos 10) + 2 dígitos de verificación (ISO 7064 mod 97-10).
function codigoEfecty(facturaId, valor) {
  const cents = Math.max(1, Math.round(Number(valor) * 100));
  const base = `${String(facturaId).padStart(4, '0')}${String(cents).padStart(10, '0').slice(-10)}`;
  const c = 98n - ((BigInt(base) * 100n) % 97n); // 1..97
  return `EFY-${base}${c < 10n ? `0${c}` : String(c)}`;
}

// GET /api/mis-pagos/efecty-codigo?facturaId=&valor=
// Genera el código para pagar en efectivo en un punto Efecty. El efectivo NO se
// registra en el portal: el cliente paga físicamente con este código (vigencia 24 h).
router.get('/mis-pagos/efecty-codigo', async (req, res, next) => {
  try {
    const facturaId = Number(req.query.facturaId);
    if (!facturaId) throw new HttpError(400, 'Indique el número de factura (facturaId)');

    const f = await pool.query(
      `SELECT f.factura_id, f.numero_factura, f.total, f.estado,
              COALESCE(SUM(p.valor), 0)::float8 AS pagado
       FROM facturas f LEFT JOIN pagos p ON p.factura_id = f.factura_id
       WHERE f.factura_id = $1 AND f.cliente_id = $2
       GROUP BY f.factura_id`,
      [facturaId, req.user.clienteId]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se generan códigos para facturas activas');

    const saldo = round2(Number(f.rows[0].total) - Number(f.rows[0].pagado));
    if (saldo <= 0) throw new HttpError(409, 'La factura ya está pagada');
    const valor = round2(req.query.valor ? Number(req.query.valor) : saldo);
    if (!(valor > 0) || valor > saldo) {
      throw new HttpError(400, `El valor debe estar entre $0.01 y el saldo pendiente ($ ${saldo.toLocaleString('en-US')})`);
    }

    const codigo = codigoEfecty(facturaId, valor);
    await audit({
      usuario: req.user.username, usuarioTipo: 'CLIENTE', modulo: 'Pagos', operacion: 'CODIGO_EFECTY',
      registro: f.rows[0].numero_factura,
      descripcion: `Código Efecty ${codigo} generado por $${valor} (saldo $${saldo})`,
    });

    res.json({
      codigo,
      factura_id: facturaId,
      numero_factura: f.rows[0].numero_factura,
      valor,
      saldo,
      vigencia_horas: 24,
      mensaje: 'Presenta este código en cualquier punto Efecty para pagar en efectivo. El sistema lo validará contra tu factura.',
    });
  } catch (e) { next(e); }
});

// GET /api/mi-saldo
router.get('/mi-saldo', async (req, res, next) => {
  try {
    const resumen = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN v.estado = 'ACTIVA' AND v.saldo > 0 THEN v.saldo ELSE 0 END), 0)::float8 AS saldo_pendiente,
        COALESCE(SUM(CASE WHEN v.estado = 'ACTIVA' THEN v.total ELSE 0 END), 0)::float8 AS total_activo,
        COALESCE(SUM(CASE WHEN v.estado = 'ACTIVA' THEN v.valor_pagado ELSE 0 END), 0)::float8 AS total_pagado,
        COUNT(*) FILTER (WHERE v.estado = 'ACTIVA' AND v.saldo > 0)::int AS facturas_pendientes,
        COUNT(*) FILTER (WHERE v.estado_pago = 'PAGADA')::int AS facturas_pagadas
       FROM factura_saldo v WHERE v.cliente_id = $1`,
      [req.user.clienteId]
    );
    const detalle = await pool.query(
      `SELECT v.factura_id, v.numero_factura, v.fecha_emision, v.total::float8, v.valor_pagado::float8, v.saldo::float8, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 AND v.estado = 'ACTIVA' AND v.saldo > 0
       ORDER BY v.fecha_emision DESC`,
      [req.user.clienteId]
    );
    res.json({ ...resumen.rows[0], facturas: detalle.rows });
  } catch (e) { next(e); }
});

// GET /api/mis-notas-credito — notas crédito del cliente autenticado
router.get('/mis-notas-credito', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT nc.nota_credito_id, nc.numero_nota, nc.factura_id, nc.fecha, nc.valor::float8, nc.motivo,
              nc.estado, nc.fecha_anulacion, nc.motivo_anulacion, f.numero_factura
       FROM notas_credito nc JOIN facturas f ON f.factura_id = nc.factura_id
       WHERE nc.cliente_id = $1 ORDER BY nc.fecha DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/mi-historial
router.get('/mi-historial', async (req, res, next) => {
  try {
    const facturas = await pool.query(
      `SELECT v.numero_factura, v.fecha_emision, v.total::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 ORDER BY v.fecha_emision DESC`,
      [req.user.clienteId]
    );
    const pagos = await pool.query(
      `SELECT pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.banco, pg.tipo_tarjeta,
              pg.ultimos_digitos_tarjeta, pg.numero_cuenta, f.numero_factura
       FROM pagos pg JOIN facturas f ON f.factura_id = pg.factura_id
       WHERE f.cliente_id = $1 ORDER BY pg.fecha DESC`,
      [req.user.clienteId]
    );
    const notas = await pool.query(
      `SELECT nc.numero_nota, nc.fecha, nc.valor::float8, nc.motivo, nc.estado, f.numero_factura
       FROM notas_credito nc JOIN facturas f ON f.factura_id = nc.factura_id
       WHERE nc.cliente_id = $1 ORDER BY nc.fecha DESC`,
      [req.user.clienteId]
    );
    res.json({ facturas: facturas.rows, pagos: pagos.rows, notas: notas.rows });
  } catch (e) { next(e); }
});

// POST /api/mis-pagos — abono/pago de una factura propia desde el portal
// (aislamiento: la factura debe pertenecer al clienteId de la sesión)
router.post('/mis-pagos', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { facturaId, valor, metodoPago = 'EFECTIVO', referencia = '', observaciones = '' } = req.body || {};
    if (!facturaId || !(Number(valor) > 0)) throw new HttpError(400, 'Factura y valor (mayor que cero) son obligatorios');

    const f = await client.query(
      `SELECT f.factura_id, f.numero_factura, f.total, f.estado,
              COALESCE(SUM(p.valor), 0)::float8 AS pagado
       FROM facturas f LEFT JOIN pagos p ON p.factura_id = f.factura_id
       WHERE f.factura_id = $1 AND f.cliente_id = $2
       GROUP BY f.factura_id`,
      [facturaId, req.user.clienteId]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se pueden registrar pagos en facturas activas');

    const saldo = round2(Number(f.rows[0].total) - Number(f.rows[0].pagado));
    const valorNum = round2(Number(valor));
    if (valorNum > saldo) throw new HttpError(400, `El valor supera el saldo pendiente ($ ${saldo.toLocaleString('en-US')})`);

    // El efectivo no se registra desde el portal: se paga en un punto Efecty con un código generado.
    if (metodoPago === 'EFECTIVO') {
      throw new HttpError(400, 'El efectivo no se registra desde el portal: genera tu código de pago Efecty y paga en cualquier punto Efecty');
    }

    // Datos requeridos según el método (tarjeta/transferencia/cheque); nunca se guardan CVV ni número completo
    const datosPago = validarDatosPago(metodoPago, req.body);

    const ins = await client.query(
      `INSERT INTO pagos (factura_id, valor, metodo_pago, referencia, observaciones,
                          banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta, numero_cuenta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING pago_id`,
      [facturaId, valorNum, metodoPago, referencia || null, observaciones || null,
        datosPago.banco || null, datosPago.titular || null, datosPago.tipo_tarjeta || null,
        datosPago.ultimos_digitos_tarjeta || null, datosPago.vencimiento_tarjeta || null, datosPago.numero_cuenta || null]
    );
    const pagoId = ins.rows[0].pago_id;
    const numero = `PAG-${String(pagoId).padStart(6, '0')}`;
    await client.query('UPDATE pagos SET numero_pago = $1 WHERE pago_id = $2', [numero, pagoId]);

    const nuevoPagado = round2(Number(f.rows[0].pagado) + valorNum);
    const nuevoSaldo = round2(Number(f.rows[0].total) - nuevoPagado);
    const estadoPago = nuevoSaldo <= 0 ? 'PAGADA' : 'PAGO_PARCIAL';

    await client.query('COMMIT');
    await audit({
      usuario: req.user.username, usuarioTipo: 'CLIENTE', modulo: 'Pagos', operacion: 'PAGO_PORTAL',
      registro: numero, descripcion: `Pago desde el portal de $${valorNum} en ${f.rows[0].numero_factura} (${metodoPago}) · saldo $${nuevoSaldo}`,
    });
    res.status(201).json({ pago_id: pagoId, numero_pago: numero, valor: valorNum, saldo: nuevoSaldo, estado_pago: estadoPago });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

export default router;