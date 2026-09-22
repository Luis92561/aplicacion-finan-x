import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'SUPERVISOR'));

// GET /api/auditoria?modulo=&usuario=&operacion=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { modulo = '', usuario = '', operacion = '', limit = 200 } = req.query;
    const conds = [];
    const params = [];
    if (modulo) { params.push(modulo); conds.push(`a.modulo ILIKE $${params.length}`); }
    if (usuario) { params.push(`%${usuario}%`); conds.push(`a.usuario ILIKE $${params.length}`); }
    if (operacion) { params.push(operacion); conds.push(`a.operacion = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await pool.query(
      `SELECT a.auditoria_id, a.usuario, a.usuario_tipo, a.fecha_hora, a.modulo, a.operacion, a.registro_afectado, a.descripcion
       FROM auditoria a ${where} ORDER BY a.auditoria_id DESC LIMIT ${Math.min(Number(limit) || 200, 500)}`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

export default router;