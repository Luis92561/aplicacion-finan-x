import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, idNumerico } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Facturas';

// GET /api/facturas?q=&estado=&estadoPago=&clienteId=&desde=&hasta=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', estadoPago = '', clienteId = '', desde = '', hasta = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(f.numero_factura ILIKE $${params.length} OR c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`f.estado = $${params.length}`); }
    if (estadoPago) { params.push(estadoPago); conds.push(`v.estado_pago = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`f.cliente_id = $${params.length}`); }
    if (desde) { params.push(desde); conds.push(`f.fecha_emision >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`f.fecha_emision <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT f.factura_id, f.numero_factura, f.pedido_id, f.fecha_emision, f.fecha_vencimiento,
              f.subtotal::float8, f.impuestos::float8, f.total::float8, f.estado,
              v.saldo::float8, v.valor_pagado::float8, v.notas_credito::float8, v.estado_pago,
              c.cliente_id, c.nombre_razon_social, c.numero_identificacion
       FROM facturas f
       JOIN clientes c ON c.cliente_id = f.cliente_id
       JOIN factura_saldo v ON v.factura_id = f.factura_id
       ${where} ORDER BY f.factura_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/facturas  — { pedidoId }: genera factura desde un pedido confirmado
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { pedidoId } = req.body || {};
    if (!pedidoId) throw new HttpError(400, 'Debe indicar el pedidoId');
    const pedidoIdNum = idNumerico(pedidoId, 'id de pedido');

    await client.query('BEGIN');

    // FOR UPDATE: si dos personas intentan facturar el mismo pedido a la vez, la segunda
    // espera y vuelve a leer el estado, en lugar de chocar contra el índice único.
    const ped = await client.query(
      `SELECT p.pedido_id, p.cliente_id, p.subtotal, p.impuestos, p.total, p.estado, p.numero_pedido
       FROM pedidos p WHERE p.pedido_id = $1
       FOR UPDATE`,
      [pedidoIdNum]
    );
    if (!ped.rowCount) throw new HttpError(404, 'El pedido no existe');
    const p = ped.rows[0];
    if (p.estado === 'CANCELADO') throw new HttpError(409, 'No se puede facturar un pedido cancelado');
    if (p.estado !== 'CONFIRMADO') throw new HttpError(409, 'El pedido debe estar CONFIRMADO antes de facturarse');

    // Un pedido puede haberse facturado antes y haber anulado esa factura: en ese caso se
    // emite una nueva y la anulada se conserva como historial. Lo que no puede haber es
    // DOS facturas ACTIVAS del mismo pedido (lo garantiza además el índice único parcial
    // uq_factura_activa_por_pedido).
    const yaFacturado = await client.query(
      `SELECT 1 FROM facturas WHERE pedido_id = $1 AND estado = 'ACTIVA'`,
      [pedidoIdNum]
    );
    if (yaFacturado.rowCount) throw new HttpError(409, 'El pedido ya tiene una factura activa');

    const cli = await client.query('SELECT nombre_razon_social FROM clientes WHERE cliente_id = $1', [p.cliente_id]);
    if (!cli.rowCount) throw new HttpError(400, 'El cliente del pedido no existe');

    const ins = await client.query(
      `INSERT INTO facturas (pedido_id, cliente_id, subtotal, impuestos, total, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5, NOW() + interval '30 days') RETURNING factura_id`,
      [pedidoIdNum, p.cliente_id, p.subtotal, p.impuestos, p.total]
    );
    const facturaId = ins.rows[0].factura_id;
    const numero = `FAC-${String(facturaId).padStart(6, '0')}`;
    await client.query('UPDATE facturas SET numero_factura = $1 WHERE factura_id = $2', [numero, facturaId]);
    await client.query(`UPDATE pedidos SET estado = 'FACTURADO' WHERE pedido_id = $1`, [pedidoIdNum]);

    // Dentro de la transacción: la factura no debe existir sin su registro de auditoría.
    await audit({
      req, client,
      usuario: req.user.correo, modulo: MODULO, operacion: 'GENERAR', registro: numero,
      descripcion: `Factura ${numero} generada del pedido ${p.numero_pedido} para ${cli.rows[0].nombre_razon_social}`,
    });

    await client.query('COMMIT');
    res.status(201).json({ factura_id: facturaId, numero_factura: numero });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// GET /api/facturas/:id — detalle con líneas del pedido y pagos
router.get('/:id', async (req, res, next) => {
  try {
    const id = idNumerico(req.params.id, 'id');
    const f = await pool.query(
      `SELECT f.*, f.subtotal::float8, f.impuestos::float8, f.total::float8,
              v.saldo::float8, v.valor_pagado::float8, v.estado_pago,
              p.numero_pedido, c.nombre_razon_social, c.numero_identificacion, c.direccion, c.ciudad,
              c.correo, c.telefono
       FROM facturas f
       JOIN factura_saldo v ON v.factura_id = f.factura_id
       JOIN pedidos p ON p.pedido_id = f.pedido_id
       JOIN clientes c ON c.cliente_id = f.cliente_id
       WHERE f.factura_id = $1`,
      [id]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');

    const lineas = await pool.query(
      `SELECT d.producto_id, d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8,
              pr.codigo, pr.nombre AS producto_nombre, pr.impuesto::float8
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [f.rows[0].pedido_id]
    );
    const pagos = await pool.query(
      `SELECT p.pago_id, p.numero_pago, p.fecha, p.valor::float8, p.metodo_pago, p.referencia, p.observaciones
       FROM pagos p WHERE p.factura_id = $1 ORDER BY p.fecha`,
      [id]
    );
    const notas = await pool.query(
      `SELECT nc.nota_credito_id, nc.numero_nota, nc.fecha, nc.valor::float8, nc.motivo, nc.estado, nc.motivo_anulacion
       FROM notas_credito nc WHERE nc.factura_id = $1 ORDER BY nc.fecha`,
      [id]
    );
    res.json({ ...f.rows[0], lineas: lineas.rows, pagos: pagos.rows, notas_credito: notas.rows });
  } catch (e) { next(e); }
});

// GET /api/facturas/:id/pagos
router.get('/:id/pagos', async (req, res, next) => {
  try {
    const id = idNumerico(req.params.id, 'id');
    // Antes devolvía [] cuando la factura no existía, así que no se podía distinguir
    // "esta factura no tiene pagos" de "esta factura no existe". Los demás endpoints de
    // detalle (/facturas/:id y /facturas/:id/saldo) sí responden 404.
    const existe = await pool.query('SELECT 1 FROM facturas WHERE factura_id = $1', [id]);
    if (!existe.rowCount) throw new HttpError(404, 'Factura no encontrada');

    const rows = await pool.query(
      `SELECT pago_id, numero_pago, fecha, valor::float8, metodo_pago, referencia, observaciones
       FROM pagos WHERE factura_id = $1 ORDER BY fecha DESC`,
      [id]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/facturas/:id/saldo
router.get('/:id/saldo', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT v.numero_factura, v.total::float8, v.valor_pagado::float8, v.saldo::float8,
              v.notas_credito::float8, v.estado_pago, v.estado
       FROM factura_saldo v WHERE v.factura_id = $1`,
      [idNumerico(req.params.id, 'id')]
    );
    if (!rows.rowCount) throw new HttpError(404, 'Factura no encontrada');
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/facturas/:id/anular  — { motivo } · anulación lógica, solo sin pagos
// Solo ADMIN/SUPERVISOR: anular una factura es una decisión financiera, no operativa.
router.post('/:id/anular', requireRol('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = idNumerico(req.params.id, 'id');
    const { motivo } = req.body || {};
    if (!motivo || !motivo.trim()) throw new HttpError(400, 'Debe indicar el motivo de anulación');

    await client.query('BEGIN');

    // FOR UPDATE: impide que se registre un pago entre la comprobación y la anulación.
    const f = await client.query(
      `SELECT f.estado, f.numero_factura, f.pedido_id,
              (SELECT COUNT(*) FROM pagos WHERE factura_id = f.factura_id)::int AS pagos
       FROM facturas f WHERE f.factura_id = $1
       FOR UPDATE`,
      [id]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'La factura no está activa');
    if (f.rows[0].pagos > 0) throw new HttpError(409, 'No se puede anular una factura con pagos registrados (regla de negocio)');

    await client.query(
      `UPDATE facturas SET estado = 'ANULADA', motivo_anulacion = $1, fecha_anulacion = NOW(), usuario_anulacion = $2
       WHERE factura_id = $3`,
      [motivo, req.user.usuarioId, id]
    );

    // El pedido vuelve a CONFIRMADO para poder emitir una factura nueva.
    // Es posible porque `facturas.pedido_id` ya NO es UNIQUE y el índice único parcial
    // uq_factura_activa_por_pedido solo limita las ACTIVA: esta factura queda anulada en el
    // historial y el pedido puede facturarse otra vez.
    await client.query('UPDATE pedidos SET estado = $1 WHERE pedido_id = $2', ['CONFIRMADO', f.rows[0].pedido_id]);

    // La anulación y la reversión del pedido se confirman juntas: antes eran dos UPDATE
    // sueltos y, si fallaba el segundo, la factura quedaba anulada con el pedido en FACTURADO.
    await audit({
      req, client,
      usuario: req.user.correo, modulo: MODULO, operacion: 'ANULAR', registro: f.rows[0].numero_factura,
      descripcion: `Anulación de ${f.rows[0].numero_factura}: ${motivo}`,
    });

    await client.query('COMMIT');
    res.json({ ok: true, estado: 'ANULADA' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

export default router;