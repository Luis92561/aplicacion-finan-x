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
    // Antes era `a.modulo ILIKE $1` sin comodines, lo que en la práctica era una igualdad
    // exacta (sin distinguir mayúsculas): buscar "Pagos" funcionaba, pero no encontrar nada
    // por un trozo del nombre. Ahora se comporta como el filtro de usuario.
    if (modulo) { params.push(`%${modulo}%`); conds.push(`a.modulo ILIKE $${params.length}`); }
    if (usuario) { params.push(`%${usuario}%`); conds.push(`a.usuario ILIKE $${params.length}`); }
    if (operacion) { params.push(operacion); conds.push(`a.operacion = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    // El LIMIT era el único sitio del backend que interpolaba un valor en el SQL. Estaba
    // saneado con Number(), pero un valor negativo generaba SQL inválido (error 500). Ahora
    // va como parámetro, acotado entre 1 y 500.
    const limite = Math.min(Math.max(Number(limit) || 200, 1), 500);

    const rows = await pool.query(
      `SELECT a.auditoria_id, a.usuario, a.usuario_tipo, a.fecha_hora, a.modulo, a.operacion, a.registro_afectado, a.descripcion
       FROM auditoria a ${where} ORDER BY a.auditoria_id DESC LIMIT $${params.length + 1}`,
      [...params, limite]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

export default router;