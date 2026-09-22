import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2 } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'NotasCrédito';

// GET /api/notas-credito?q=&estado=&clienteId=&facturaId=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', clienteId = '', facturaId = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(nc.numero_nota ILIKE $${params.length} OR f.numero_factura ILIKE $${params.length} OR c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`nc.estado = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`nc.cliente_id = $${params.length}`); }
    if (facturaId) { params.push(facturaId); conds.push(`nc.factura_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT nc.nota_credito_id, nc.numero_nota, nc.factura_id, nc.cliente_id, nc.fecha, nc.valor::float8,
              nc.motivo, nc.estado, nc.fecha_anulacion, nc.motivo_anulacion,
              f.numero_factura, c.nombre_razon_social, c.numero_identificacion
       FROM notas_credito nc
       JOIN facturas f ON f.factura_id = nc.factura_id
       JOIN clientes c ON c.cliente_id = nc.cliente_id
       ${where} ORDER BY nc.fecha DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/notas-credito/:id
router.get('/:id', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT nc.*, nc.valor::float8, f.numero_factura, c.nombre_razon_social, c.numero_identificacion
       FROM notas_credito nc
       JOIN facturas f ON f.factura_id = nc.factura_id
       JOIN clientes c ON c.cliente_id = nc.cliente_id
       WHERE nc.nota_credito_id = $1`,
      [Number(req.params.id)]
    );
    if (!rows.rowCount) throw new HttpError(404, 'Nota de crédito no encontrada');
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/notas-credito — { facturaId, valor, motivo }
// Reglas: factura ACTIVA · motivo obligatorio · el devuelto no supera lo pagado
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { facturaId, valor, motivo } = req.body || {};

    await client.query('BEGIN');
    if (!facturaId) throw new HttpError(400, 'Debe indicar la factura');
    if (!(Number(valor) > 0)) throw new HttpError(400, 'El valor de la nota crédito debe ser mayor que cero');
    if (!motivo || !String(motivo).trim()) throw new HttpError(400, 'Debe indicar el motivo de la devolución');

    const f = await client.query(
      `SELECT f.factura_id, f.numero_factura, f.cliente_id, f.estado,
              COALESCE(SUM(p.valor), 0)::float8 AS pagado,
              COALESCE(SUM(CASE WHEN nc.estado = 'ACTIVA' THEN nc.valor END), 0)::float8 AS notas_previas
       FROM facturas f
       LEFT JOIN pagos p ON p.factura_id = f.factura_id
       LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id
       WHERE f.factura_id = $1
       GROUP BY f.factura_id`,
      [facturaId]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se pueden crear notas crédito sobre facturas activas');

    const pagado = Number(f.rows[0].pagado);
    const notasPrevias = Number(f.rows[0].notas_previas);
    const disponible = round2(pagado - notasPrevias);
    const valorNum = round2(Number(valor));
    if (disponible <= 0) throw new HttpError(409, 'No hay pagos disponibles para devolver en esta factura');
    if (valorNum > disponible) throw new HttpError(400, `El valor supera lo pagado disponible ($ ${disponible.toLocaleString('en-US')})`);

    const ins = await client.query(
      `INSERT INTO notas_credito (factura_id, cliente_id, valor, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING nota_credito_id`,
      [facturaId, f.rows[0].cliente_id, valorNum, String(motivo).trim(), req.user.usuarioId ?? null]
    );
    const notaId = ins.rows[0].nota_credito_id;
    const numero = `NC-${String(notaId).padStart(6, '0')}`;
    await client.query('UPDATE notas_credito SET numero_nota = $1 WHERE nota_credito_id = $2', [numero, notaId]);

    const nuevoSaldo = round2(pagado - notasPrevias - valorNum);
    await client.query('COMMIT');

    await audit({
      usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: numero,
      descripcion: `Nota crédito ${numero} de $${valorNum} sobre ${f.rows[0].numero_factura}: ${motivo}`,
    });
    res.status(201).json({ nota_credito_id: notaId, numero_nota: numero, valor: valorNum, saldo_restante_devolver: nuevoSaldo });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// POST /api/notas-credito/:id/anular — { motivo } · anulación lógica
router.post('/:id/anular', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { motivo } = req.body || {};
    if (!motivo || !String(motivo).trim()) throw new HttpError(400, 'Debe indicar el motivo de anulación');

    const n = await pool.query(
      `SELECT nc.numero_nota, nc.estado, f.numero_factura, c.nombre_razon_social
       FROM notas_credito nc
       JOIN facturas f ON f.factura_id = nc.factura_id
       JOIN clientes c ON c.cliente_id = nc.cliente_id
       WHERE nc.nota_credito_id = $1`,
      [id]
    );
    if (!n.rowCount) throw new HttpError(404, 'Nota de crédito no encontrada');
    if (n.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'La nota de crédito ya no está activa');

    await pool.query(
      `UPDATE notas_credito SET estado = 'ANULADA', fecha_anulacion = NOW(), usuario_anulacion = $1, motivo_anulacion = $2
       WHERE nota_credito_id = $3`,
      [req.user.usuarioId ?? null, String(motivo).trim(), id]
    );
    await audit({
      usuario: req.user.correo, modulo: MODULO, operacion: 'ANULAR', registro: n.rows[0].numero_nota,
      descripcion: `Anulación de ${n.rows[0].numero_nota} (${n.rows[0].numero_factura}): ${motivo}`,
    });
    res.json({ ok: true, estado: 'ANULADA' });
  } catch (e) { next(e); }
});

export default router;