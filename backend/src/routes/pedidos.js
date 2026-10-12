import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2, idNumerico } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Pedidos';

// GET /api/pedidos?q=&estado=&clienteId=&desde=&hasta=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', clienteId = '', desde = '', hasta = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(p.numero_pedido ILIKE $${params.length} OR c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`p.estado = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`p.cliente_id = $${params.length}`); }
    if (desde) { params.push(desde); conds.push(`p.fecha >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`p.fecha <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT p.pedido_id, p.numero_pedido, p.fecha, p.subtotal::float8, p.impuestos::float8, p.total::float8,
              p.estado, p.observaciones, c.cliente_id, c.nombre_razon_social, c.numero_identificacion,
              (SELECT numero_factura FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS numero_factura
       FROM pedidos p JOIN clientes c ON c.cliente_id = p.cliente_id
       ${where} ORDER BY p.pedido_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/pedidos/:id  — detalle con líneas y factura
router.get('/:id', async (req, res, next) => {
  try {
    const id = idNumerico(req.params.id, 'id');
    const ped = await pool.query(
      `SELECT p.*, p.subtotal::float8, p.impuestos::float8, p.total::float8,
              c.nombre_razon_social, c.numero_identificacion,
              (SELECT factura_id FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS factura_id,
              (SELECT numero_factura FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS numero_factura
       FROM pedidos p JOIN clientes c ON c.cliente_id = p.cliente_id WHERE p.pedido_id = $1`,
      [id]
    );
    if (!ped.rowCount) throw new HttpError(404, 'Pedido no encontrado');
    const lineas = await pool.query(
      `SELECT d.detalle_id, d.producto_id, d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8,
              pr.codigo, pr.nombre AS producto_nombre, pr.impuesto::float8
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [id]
    );
    res.json({ ...ped.rows[0], lineas: lineas.rows });
  } catch (e) { next(e); }
});

// POST /api/pedidos — los cálculos se hacen en el servidor
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { clienteId, observaciones = '', items = [] } = req.body || {};
    if (!clienteId) throw new HttpError(400, 'Debe indicar un cliente');
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Debe agregar al menos un producto');

    await client.query('BEGIN');

    const cli = await client.query('SELECT cliente_id FROM clientes WHERE cliente_id = $1 AND estado = $2', [clienteId, 'ACTIVO']);
    if (!cli.rowCount) throw new HttpError(400, 'El cliente no existe o está inactivo');

    const ins = await client.query('INSERT INTO pedidos (cliente_id, observaciones) VALUES ($1, $2) RETURNING pedido_id', [clienteId, observaciones || null]);
    const pedidoId = ins.rows[0].pedido_id;

    let subtotal = 0;
    let impuestos = 0;

    for (const item of items) {
      const cantidad = Number(item.cantidad);
      if (!item.productoId || !(cantidad > 0)) throw new HttpError(400, 'Cada línea requiere producto y cantidad mayor que cero');

      const prod = await client.query('SELECT * FROM productos WHERE producto_id = $1 AND estado = $2', [item.productoId, 'ACTIVO']);
      if (!prod.rowCount) throw new HttpError(400, `Producto ${item.productoId} no existe o está inactivo`);

      const precioUnitario = Number(prod.rows[0].precio);
      const lineaSubtotal = round2(precioUnitario * cantidad);
      const lineaImpuesto = round2(lineaSubtotal * (Number(prod.rows[0].impuesto) / 100));
      subtotal = round2(subtotal + lineaSubtotal);
      impuestos = round2(impuestos + lineaImpuesto);

      await client.query(
        `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)`,
        [pedidoId, item.productoId, cantidad, precioUnitario, lineaSubtotal]
      );
    }

    const total = round2(subtotal + impuestos);
    const numero = `PED-${String(pedidoId).padStart(6, '0')}`;
    await client.query(
      `UPDATE pedidos SET numero_pedido = $1, subtotal = $2, impuestos = $3, total = $4 WHERE pedido_id = $5`,
      [numero, subtotal, impuestos, total, pedidoId]
    );

    // Dentro de la transacción: el pedido no debe existir sin su registro de auditoría.
    await audit({
      client,
      usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: numero,
      descripcion: `Pedido ${numero} por $${total}`,
    });

    await client.query('COMMIT');
    res.status(201).json({ pedido_id: pedidoId, numero_pedido: numero, total });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// PUT /api/pedidos/:id  — solo en estado BORRADOR
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = idNumerico(req.params.id, 'id');
    const { observaciones = '', items = [] } = req.body || {};

    await client.query('BEGIN');
    const ped = await client.query('SELECT estado, numero_pedido FROM pedidos WHERE pedido_id = $1', [id]);
    if (!ped.rowCount) throw new HttpError(404, 'Pedido no encontrado');
    if (ped.rows[0].estado !== 'BORRADOR') throw new HttpError(409, 'Solo se puede modificar un pedido en estado BORRADOR');
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Debe agregar al menos un producto');

    await client.query('DELETE FROM detalle_pedido WHERE pedido_id = $1', [id]);

    let subtotal = 0;
    let impuestos = 0;
    for (const item of items) {
      const cantidad = Number(item.cantidad);
      if (!item.productoId || !(cantidad > 0)) throw new HttpError(400, 'Cada línea requiere producto y cantidad mayor que cero');
      const prod = await client.query('SELECT * FROM productos WHERE producto_id = $1 AND estado = $2', [item.productoId, 'ACTIVO']);
      if (!prod.rowCount) throw new HttpError(400, `Producto ${item.productoId} no existe o está inactivo`);
      const precioUnitario = Number(prod.rows[0].precio);
      const lineaSubtotal = round2(precioUnitario * cantidad);
      const lineaImpuesto = round2(lineaSubtotal * (Number(prod.rows[0].impuesto) / 100));
      subtotal = round2(subtotal + lineaSubtotal);
      impuestos = round2(impuestos + lineaImpuesto);
      await client.query(
        `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)`,
        [id, item.productoId, cantidad, precioUnitario, lineaSubtotal]
      );
    }

    const total = round2(subtotal + impuestos);
    await client.query(
      `UPDATE pedidos SET observaciones = $1, subtotal = $2, impuestos = $3, total = $4 WHERE pedido_id = $5`,
      [observaciones || null, subtotal, impuestos, total, id]
    );
    await audit({
      client,
      usuario: req.user.correo, modulo: MODULO, operacion: 'ACTUALIZAR', registro: ped.rows[0].numero_pedido,
      descripcion: `Modificación del pedido por $${total}`,
    });

    await client.query('COMMIT');
    res.json({ ok: true, total });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// PATCH /api/pedidos/:id/estado  — { estado: 'CONFIRMADO' | 'CANCELADO' }
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = idNumerico(req.params.id, 'id');
    const { estado } = req.body || {};
    const ped = await pool.query('SELECT estado, numero_pedido FROM pedidos WHERE pedido_id = $1', [id]);
    if (!ped.rowCount) throw new HttpError(404, 'Pedido no encontrado');
    const actual = ped.rows[0].estado;
    const permitido =
      (estado === 'CONFIRMADO' && actual === 'BORRADOR') ||
      (estado === 'CANCELADO' && ['BORRADOR', 'CONFIRMADO'].includes(actual));
    if (!permitido) throw new HttpError(409, `Transición ${actual} → ${estado} no permitida`);

    await pool.query('UPDATE pedidos SET estado = $1 WHERE pedido_id = $2', [estado, id]);
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ESTADO', registro: ped.rows[0].numero_pedido, descripcion: `Pedido → ${estado}` });
    res.json({ ok: true, estado });
  } catch (e) { next(e); }
});

export default router;