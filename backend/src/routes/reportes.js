import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'SUPERVISOR', 'FACTURADOR'));

// GET /api/reportes/resumen  — estadísticas del dashboard
router.get('/resumen', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM clientes WHERE estado = 'ACTIVO')::int  AS clientes_activos,
        (SELECT COUNT(*) FROM productos WHERE estado = 'ACTIVO')::int AS productos_activos,
        (SELECT COUNT(*) FROM pedidos)::int                          AS total_pedidos,
        (SELECT COUNT(*)::int FROM pedidos WHERE estado = 'CONFIRMADO')::int AS pedidos_por_facturar,
        (SELECT COUNT(*)::int FROM facturas WHERE estado = 'ACTIVA')::int AS facturas_activas,
        (SELECT COUNT(*)::int FROM facturas WHERE estado = 'ANULADA')::int AS facturas_anuladas,
        (SELECT COALESCE(SUM(valor),0)::float8 FROM pagos)            AS pagos_recibidos,
        (SELECT COALESCE(SUM(f.total - COALESCE((SELECT SUM(p.valor) FROM pagos p WHERE p.factura_id = f.factura_id), 0)), 0)::float8
         FROM facturas f WHERE f.estado = 'ACTIVA')                   AS saldo_pendiente_total`
    );
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/reportes/facturacion?desde=&hasta=
router.get('/facturacion', async (req, res, next) => {
  try {
    const { desde = '', hasta = '' } = req.query;
    const params = [];
    const conds = [];
    if (desde) { params.push(desde); conds.push(`f.fecha_emision >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`f.fecha_emision <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const facturas = await pool.query(
      `SELECT
        COUNT(*)::int AS total_facturas,
        COUNT(*) FILTER (WHERE f.estado = 'ACTIVA')::int AS activas,
        COUNT(*) FILTER (WHERE f.estado = 'ANULADA')::int AS anuladas,
        COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'ACTIVA'), 0)::float8 AS total_facturado,
        COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'ANULADA'), 0)::float8 AS total_anulado,
        COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'ACTIVA') -
          COALESCE((SELECT SUM(p.valor) FROM pagos p JOIN facturas f2 ON f2.factura_id = p.factura_id WHERE f2.estado = 'ACTIVA'), 0), 0)::float8 AS saldo_pendiente
       FROM facturas f ${where}`,
      params
    );
    const pagos = await pool.query(
      `SELECT COALESCE(SUM(valor), 0)::float8 AS total_pagado, COUNT(*)::int AS total_pagos,
              COUNT(*) FILTER (WHERE metodo_pago = 'EFECTIVO')::int AS efectivo,
              COUNT(*) FILTER (WHERE metodo_pago = 'TRANSFERENCIA')::int AS transferencia,
              COUNT(*) FILTER (WHERE metodo_pago = 'TARJETA')::int AS tarjeta,
              COUNT(*) FILTER (WHERE metodo_pago = 'CHEQUE')::int AS cheque
       FROM pagos p JOIN facturas f ON f.factura_id = p.factura_id ${where}`,
      params
    );
    res.json({ ...facturas.rows[0], ...pagos.rows[0] });
  } catch (e) { next(e); }
});

// GET /api/reportes/balance-clientes — dashboard de saldos por cliente
router.get('/balance-clientes', async (req, res, next) => {
  try {
    const ranges = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE saldo_pendiente > 0)::int AS clientes_con_saldo,
        SUM(saldo_pendiente)::float8 AS saldo_total,
        SUM(total_facturado)::float8 AS facturado_total,
        SUM(total_pagado)::float8 AS pagado_total
       FROM (
         SELECT c.cliente_id,
           COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_facturado,
           COALESCE(SUM(v.valor_pagado - v.notas_credito) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_pagado,
           COALESCE(SUM(v.saldo) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS saldo_pendiente
         FROM clientes c LEFT JOIN factura_saldo v ON v.cliente_id = c.cliente_id
         GROUP BY c.cliente_id
       ) t`
    );
    const rows = await pool.query(
      `SELECT c.cliente_id, c.tipo_identificacion, c.numero_identificacion, c.nombre_razon_social,
              c.correo, c.telefono, c.ciudad, c.estado,
              COUNT(v.factura_id) FILTER (WHERE v.estado = 'ACTIVA')::int AS facturas_activas,
              COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_facturado,
              COALESCE(SUM(v.valor_pagado - v.notas_credito) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_pagado,
              COALESCE(SUM(v.saldo) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS saldo_pendiente,
              (SELECT COUNT(*) FROM pedidos p2 WHERE p2.cliente_id = c.cliente_id)::int AS total_pedidos
       FROM clientes c LEFT JOIN factura_saldo v ON v.cliente_id = c.cliente_id
       GROUP BY c.cliente_id
       ORDER BY saldo_pendiente DESC, c.nombre_razon_social`
    );
    res.json({ resumen: ranges.rows[0], clientes: rows.rows });
  } catch (e) { next(e); }
});

// GET /api/reportes/historial/:clienteId  — historial financiero de un cliente
router.get('/historial/:clienteId', async (req, res, next) => {
  try {
    const clienteId = Number(req.params.clienteId);
    const cli = await pool.query(
      `SELECT cliente_id, nombre_razon_social, numero_identificacion, ciudad, estado FROM clientes WHERE cliente_id = $1`,
      [clienteId]
    );
    if (!cli.rowCount) throw new HttpError(404, 'Cliente no encontrado');

    const facturas = await pool.query(
      `SELECT v.factura_id, v.numero_factura, v.fecha_emision, v.total::float8, v.valor_pagado::float8, v.saldo::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 ORDER BY v.fecha_emision DESC`,
      [clienteId]
    );
    const pagos = await pool.query(
      `SELECT pg.pago_id, pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.referencia, f.numero_factura
       FROM pagos pg JOIN facturas f ON f.factura_id = pg.factura_id
       WHERE f.cliente_id = $1 ORDER BY pg.fecha DESC`,
      [clienteId]
    );
    res.json({ cliente: cli.rows[0], facturas: facturas.rows, pagos: pagos.rows });
  } catch (e) { next(e); }
});

export default router;