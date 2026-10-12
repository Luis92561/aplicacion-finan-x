import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, idNumerico, validarPassword } from '../utils.js';

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
    validarPassword(password);
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
  const client = await pool.connect();
  try {
    const id = idNumerico(req.params.id);
    const { estado, password } = req.body || {};

    // `estado` se validaba contra nada: la columna no tiene CHECK, así que se podía guardar
    // cualquier cadena y dejar la cuenta en un estado que el login no sabe interpretar.
    // Clientes y productos ya usan esta misma lista.
    if (estado !== undefined && !['ACTIVO', 'INACTIVO'].includes(estado)) {
      throw new HttpError(400, 'Estado inválido (use ACTIVO o INACTIVO)');
    }
    // La contraseña se cambiaba sin exigir longitud mínima, a diferencia del registro y de la
    // recuperación por OTP, que sí piden 6 caracteres.
    if (password !== undefined && String(password).length < 6) {
      throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
    }

    await client.query('BEGIN');

    const usu = await client.query('SELECT correo FROM usuarios WHERE usuario_id = $1', [id]);
    if (!usu.rowCount) throw new HttpError(404, 'Usuario no encontrado');

    if (estado) {
      // Salvaguardas al desactivar: sin esto, un ADMIN podía dejar el sistema sin ningún
      // administrador activo (desactivándose a sí mismo, o al último que quedaba) y ya no
      // habría forma de gestionar usuarios desde la aplicación.
      if (estado === 'INACTIVO') {
        if (Number(req.user.usuarioId) === id) {
          throw new HttpError(409, 'No puede desactivar su propia cuenta. Pida a otro administrador que lo haga.');
        }
        const admins = await client.query(
          `SELECT COUNT(*)::int AS total
           FROM usuarios u JOIN roles r ON r.rol_id = u.rol_id
           WHERE r.nombre = 'ADMIN' AND u.estado = 'ACTIVO' AND u.usuario_id <> $1`,
          [id]
        );
        if (admins.rows[0].total === 0) {
          throw new HttpError(409, 'No puede desactivar al último administrador activo: el sistema quedaría sin acceso a la gestión de usuarios.');
        }
      }

      await client.query('UPDATE usuarios SET estado = $1 WHERE usuario_id = $2', [estado, id]);
      // Al desactivar la cuenta se invalidan sus sesiones abiertas (A7): un usuario
      // bloqueado no debe seguir usando el token que ya tenía.
      if (estado === 'INACTIVO') {
        await client.query('UPDATE usuarios SET token_version = token_version + 1 WHERE usuario_id = $1', [id]);
      }
      await audit({
        client,
        usuario: req.user.correo, modulo: 'Usuarios', operacion: 'ESTADO', registro: id,
        descripcion: `Usuario ${usu.rows[0].correo} → ${estado}`,
      });
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      // Cambiar la contraseña cierra las sesiones anteriores.
      await client.query(
        'UPDATE usuarios SET password_hash = $1, token_version = token_version + 1 WHERE usuario_id = $2',
        [hash, id]
      );
      await audit({
        client,
        usuario: req.user.correo, modulo: 'Usuarios', operacion: 'CLAVE', registro: id,
        descripcion: 'Cambio de contraseña (sesiones anteriores invalidadas)',
      });
    }

    // Los dos UPDATE y sus auditorías se confirman juntos: antes iban sueltos y un fallo
    // a mitad dejaba el estado inconsistente y sin traza.
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

export default router;