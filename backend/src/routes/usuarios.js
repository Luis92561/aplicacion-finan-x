import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, idNumerico, validarPassword, generarClaveTemporal } from '../utils.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN'));

const USUARIO_VALIDO = /^[a-z0-9._-]{3,32}$/i;

function validarUsuario(valor) {
  const usuario = String(valor ?? '').trim().toLowerCase();
  if (!USUARIO_VALIDO.test(usuario)) {
    throw new HttpError(400, 'El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo');
  }
  return usuario;
}

// GET /api/usuarios
router.get('/', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.correo, u.username, u.estado, u.fecha_creacion,
              u.debe_cambiar_clave, u.clave_actualizada_en, r.nombre AS rol
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

// POST /api/usuarios — crear usuario interno con cambio obligatorio
router.post('/', async (req, res, next) => {
  try {
    const { nombre, correo, username, rol, password, generar } = req.body || {};
    if (!nombre || !correo || !rol) throw new HttpError(400, 'nombre, correo y rol son obligatorios');

    const usuario = validarUsuario(username || correo.split('@')[0]);

    const rolRes = await pool.query('SELECT rol_id FROM roles WHERE nombre = $1', [rol]);
    if (!rolRes.rowCount) throw new HttpError(400, `Rol inválido: ${rol}`);

    const dup = await pool.query(
      `SELECT 1 FROM usuarios
        WHERE LOWER(correo) = LOWER($1) OR LOWER(COALESCE(username,'')) = LOWER($2)`,
      [correo, usuario]
    );
    if (dup.rowCount) throw new HttpError(409, 'Ya existe un usuario con ese correo o nombre de usuario');

    const claveTemporal = generar || !password ? generarClaveTemporal() : String(password);
    validarPassword(claveTemporal, { username: usuario, correo, nombre });

    const hash = await bcrypt.hash(claveTemporal, config.bcryptRounds);
    const resInsert = await pool.query(
      `INSERT INTO usuarios (nombre, correo, username, password_hash, rol_id, debe_cambiar_clave)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING usuario_id`,
      [nombre, correo, usuario, hash, rolRes.rows[0].rol_id]
    );

    await audit({
      req, usuario: req.user.correo, modulo: 'Usuarios', operacion: 'CREAR',
      registro: resInsert.rows[0].usuario_id,
      descripcion: `Creación del usuario ${usuario} / ${correo} (${rol}) con cambio de contraseña obligatorio`,
    });

    res.status(201).json({
      usuario_id: resInsert.rows[0].usuario_id,
      username: usuario,
      ...(generar || !password ? { clave_temporal: claveTemporal, debe_cambiar_clave: true } : {}),
    });
  } catch (e) { next(e); }
});

// PATCH /api/usuarios/:id — estado y/o contraseña
router.patch('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = idNumerico(req.params.id);
    const { estado, password, generar, forzarCambio } = req.body || {};

    if (estado !== undefined && !['ACTIVO', 'INACTIVO'].includes(estado)) {
      throw new HttpError(400, 'Estado inválido (use ACTIVO o INACTIVO)');
    }
    if (password !== undefined && !generar) {
      validarPassword(password);
    }

    await client.query('BEGIN');

    const usu = await client.query('SELECT correo, username, nombre FROM usuarios WHERE usuario_id = $1', [id]);
    if (!usu.rowCount) throw new HttpError(404, 'Usuario no encontrado');

    if (estado) {
      // Salvaguardas al desactivar: sin esto, un ADMIN podía dejar el sistema sin ningún
      // administrador activo y ya no habría forma de gestionar usuarios desde la aplicación.
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
      // Al desactivar la cuenta se invalidan sus sesiones abiertas: un usuario bloqueado
      // no debe seguir usando el token que ya tenía.
      if (estado === 'INACTIVO') {
        await client.query('UPDATE usuarios SET token_version = token_version + 1 WHERE usuario_id = $1', [id]);
      }
      await audit({
        req, client, usuario: req.user.correo, modulo: 'Usuarios', operacion: 'ESTADO', registro: id,
        descripcion: `Usuario ${usu.rows[0].correo} → ${estado}`,
      });
    }

    let claveTemporal = null;
    if (password || generar) {
      claveTemporal = generar ? generarClaveTemporal() : String(password);
      validarPassword(claveTemporal, {
        username: usu.rows[0].username, correo: usu.rows[0].correo, nombre: usu.rows[0].nombre,
      });
      const hash = await bcrypt.hash(claveTemporal, config.bcryptRounds);
      const cambiar = forzarCambio !== false;
      // Cambiar la contraseña cierra las sesiones anteriores y, si la fija un
      // administrador, obliga al titular a cambiarla en el siguiente ingreso.
      await client.query(
        `UPDATE usuarios
            SET password_hash = $1,
                debe_cambiar_clave = $2,
                clave_actualizada_en = NOW(),
                fallos_login = 0,
                bloqueado_hasta = NULL,
                token_version = token_version + 1
          WHERE usuario_id = $3`,
        [hash, cambiar, id]
      );
      await audit({
        req, client, usuario: req.user.correo, modulo: 'Usuarios', operacion: 'CLAVE', registro: id,
        descripcion: cambiar
          ? 'Contraseña restablecida por un administrador (cambio obligatorio y sesiones invalidadas)'
          : 'Cambio de contraseña (sesiones anteriores invalidadas)',
      });
    }

    await client.query('COMMIT');
    res.json({ ok: true, ...(claveTemporal ? { clave_temporal: claveTemporal } : {}) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

export default router;
