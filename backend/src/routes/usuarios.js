import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN'));

// GET /api/usuarios
router.get('/', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.correo, u.estado, u.fecha_creacion, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.rol_id = u.rol_id
       ORDER BY u.usuario_id`
    );
    res.json(rows.rows.map((u) => ({ ...u, fecha_creacion: u.fecha_creacion })));
  } catch (e) { next(e); }
});

// GET /api/usuarios/roles
router.get('/roles', async (req, res, next) => {
  try {
    const rows = await pool.query('SELECT rol_id, nombre FROM roles ORDER BY rol_id');
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/usuarios
router.post('/', async (req, res, next) => {
  try {
    const { nombre, correo, rol, password } = req.body || {};
    if (!nombre || !correo || !rol || !password) throw new HttpError(400, 'nombre, correo, rol y password son obligatorios');
    const rolRes = await pool.query('SELECT rol_id FROM roles WHERE nombre = $1', [rol]);
    if (!rolRes.rowCount) throw new HttpError(400, `Rol inválido: ${rol}`);
    const dup = await pool.query('SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER($1)', [correo]);
    if (dup.rowCount) throw new HttpError(409, 'Ya existe un usuario con ese correo');
    const hash = await bcrypt.hash(password, 10);
    const resInsert = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol_id) VALUES ($1, $2, $3, $4) RETURNING usuario_id`,
      [nombre, correo, hash, rolRes.rows[0].rol_id]
    );
    await audit({ usuario: req.user.correo, modulo: 'Usuarios', operacion: 'CREAR', registro: resInsert.rows[0].usuario_id, descripcion: `Creación del usuario ${correo} (${rol})` });
    res.status(201).json({ usuario_id: resInsert.rows[0].usuario_id });
  } catch (e) { next(e); }
});

// PATCH /api/usuarios/:id  — estado y/o contraseña
router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado, password } = req.body || {};
    const usu = await pool.query('SELECT correo FROM usuarios WHERE usuario_id = $1', [id]);
    if (!usu.rowCount) throw new HttpError(404, 'Usuario no encontrado');

    if (estado) {
      await pool.query('UPDATE usuarios SET estado = $1 WHERE usuario_id = $2', [estado, id]);
      await audit({ usuario: req.user.correo, modulo: 'Usuarios', operacion: 'ESTADO', registro: id, descripcion: `Usuario ${usu.rows[0].correo} → ${estado}` });
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE usuarios SET password_hash = $1 WHERE usuario_id = $2', [hash, id]);
      await audit({ usuario: req.user.correo, modulo: 'Usuarios', operacion: 'CLAVE', registro: id, descripcion: 'Cambio de contraseña' });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;