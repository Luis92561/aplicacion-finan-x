import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { config } from '../config.js';
import { signToken } from '../middleware/auth.js';
import { registrarFalloLogin, limpiarFallosLogin } from '../middleware/rateLimit.js';
import { audit } from '../middleware/audit.js';
import { enviarCodigo } from '../middleware/notificar.js';
import { HttpError } from '../utils.js';

const router = Router();

// Anti-spam: máx. de solicitudes de autoregistro por IP en 1 hora.
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.registroRateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de registro desde esta dirección. Intente más tarde.' },
});

// Anti-spam: recuperación de contraseña (solicitar código + validar/cambiar) por IP.
// Límite holgado (15 min) para no bloquear usuarios legítimos ni las pruebas e2e re-ejecutadas.
const recuperarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.recuperarRateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación desde esta dirección. Intente más tarde.' },
});

// POST /api/auth/login  — usuario interno o cliente
router.post('/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  try {
    if (!username || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');

    // 1) Buscar usuario interno por correo
    const interno = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.correo, u.password_hash, u.estado, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.rol_id = u.rol_id
       WHERE LOWER(u.correo) = LOWER($1)`,
      [username]
    );

    if (interno.rowCount) {
      const u = interno.rows[0];
      if (u.estado !== 'ACTIVO') throw new HttpError(403, 'La cuenta está inactiva');
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) throw new HttpError(401, 'Credenciales incorrectas');

      const user = { tipo: 'interno', usuarioId: u.usuario_id, nombre: u.nombre, correo: u.correo, rol: u.rol };
      const token = signToken(user);
      limpiarFallosLogin(req); // un acierto resetea el contador de fallos de la IP
      await audit({ usuario: u.correo, modulo: 'Autenticación', operacion: 'LOGIN', descripcion: `Inicio de sesión de ${u.correo} (${u.rol})` });
      return res.json({ token, user });
    }

    // 2) Buscar cuenta de cliente
    const cli = await pool.query(
      `SELECT uc.usuario_cliente_id, uc.cliente_id, uc.username, uc.password_hash, uc.estado AS cuenta_estado,
              c.nombre_razon_social, c.estado AS cliente_estado
       FROM usuario_cliente uc JOIN clientes c ON c.cliente_id = uc.cliente_id
       WHERE LOWER(uc.username) = LOWER($1)`,
      [username]
    );

    if (cli.rowCount) {
      const c = cli.rows[0];
      if (c.cuenta_estado !== 'ACTIVO') throw new HttpError(403, 'La cuenta está inactiva');
      if (c.cliente_estado !== 'ACTIVO') throw new HttpError(403, 'El cliente está inactivo');
      const ok = await bcrypt.compare(password, c.password_hash);
      if (!ok) throw new HttpError(401, 'Credenciales incorrectas');

      await pool.query('UPDATE usuario_cliente SET ultimo_acceso = NOW() WHERE usuario_cliente_id = $1', [c.usuario_cliente_id]);

      const user = {
        tipo: 'cliente', usuarioClienteId: c.usuario_cliente_id, clienteId: c.cliente_id,
        nombre: c.nombre_razon_social, username: c.username,
      };
      const token = signToken(user);
      limpiarFallosLogin(req); // un acierto resetea el contador de fallos de la IP
      await audit({ usuario: c.username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'LOGIN', descripcion: `Inicio de sesión del cliente ${c.nombre_razon_social}` });
      return res.json({ token, user });
    }

    throw new HttpError(401, 'Credenciales incorrectas');
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      await audit({ usuario: username || '?', modulo: 'Autenticación', operacion: 'LOGIN_FALLIDO', descripcion: `Intento fallido para ${username || '?'}` });
      // Protección contra fuerza bruta: los fallos consecutivos de una IP la bloquean (429).
      if (registrarFalloLogin(req, res)) return; // ya respondió 429
    }
    next(err);
  }
});

router.post('/registro', registroLimiter, async (req, res, next) => {
  const b = req.body || {};
  const {
    tipoCliente = 'PERSONA', tipoIdentificacion = 'CC', numeroIdentificacion, nombreRazonSocial,
    telefono, correo, direccion, ciudad, username, password,
  } = b;
  try {
    if (!numeroIdentificacion || !nombreRazonSocial) throw new HttpError(400, 'Número de identificación y nombre son obligatorios');
    if (!username || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');
    if (String(password).length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
    if (!/^[a-zA-Z0-9._@-]{3,}$/.test(String(username))) throw new HttpError(400, 'El usuario debe tener al menos 3 caracteres (letras, números, . _ @ -)');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Regla: no duplicar cliente por tipo + número de identificación
      const dupIdent = await client.query(
        'SELECT 1 FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
        [tipoIdentificacion, numeroIdentificacion]
      );
      if (dupIdent.rowCount) throw new HttpError(409, 'Ya existe un cliente con esa identificación');

      // El usuario no debe chocar con cuentas de clientes ni con correos de usuarios internos
      const dupUser = await client.query(
        `SELECT 1 FROM usuario_cliente WHERE LOWER(username) = LOWER($1)
         UNION
         SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER($1)`,
        [username]
      );
      if (dupUser.rowCount) throw new HttpError(409, 'Ese nombre de usuario ya está en uso');

      const cli = await client.query(
        `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING cliente_id`,
        [tipoCliente, tipoIdentificacion, numeroIdentificacion, nombreRazonSocial, telefono || null, correo || null, direccion || null, ciudad || null]
      );
      const clienteId = cli.rows[0].cliente_id;

      const hash = await bcrypt.hash(password, 10);
      const uc = await client.query(
        'INSERT INTO usuario_cliente (cliente_id, username, password_hash) VALUES ($1, $2, $3) RETURNING usuario_cliente_id',
        [clienteId, username, hash]
      );

      await client.query('COMMIT');

      await audit({
        usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Clientes', operacion: 'AUTORREGISTRO',
        registro: clienteId, descripcion: `Autoregistro del cliente ${nombreRazonSocial} (${tipoIdentificacion} ${numeroIdentificacion})`,
      });

      // El cliente queda autenticado y puede entrar al portal de inmediato
      const user = { tipo: 'cliente', usuarioClienteId: uc.rows[0].usuario_cliente_id, clienteId, nombre: nombreRazonSocial, username };
      const token = signToken(user);
      return res.status(201).json({ token, user });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/** Genera un código de un solo uso de 6 dígitos. */
function generarOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Enmascara el destino (correo/teléfono) para mostrarlo de forma segura. */
function enmascarar(destino) {
  const s = String(destino || '');
  if (s.length <= 4) return '***';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

// POST /api/auth/recuperar-solicitar — pide el código de un solo uso (se envía por SMS o correo)
router.post('/recuperar-solicitar', recuperarLimiter, async (req, res, next) => {
  try {
    const { username, canal = 'EMAIL' } = req.body || {};
    if (!username) throw new HttpError(400, 'Indique su usuario o correo');
    if (!['EMAIL', 'SMS'].includes(canal)) throw new HttpError(400, 'Canal de entrega inválido (EMAIL o SMS)');

    const uc = await pool.query(
      `SELECT uc.usuario_cliente_id, c.correo, c.telefono
       FROM usuario_cliente uc JOIN clientes c ON c.cliente_id = uc.cliente_id
       WHERE LOWER(uc.username) = LOWER($1)`,
      [username]
    );

    if (uc.rowCount) {
      const destino = canal === 'SMS' ? uc.rows[0].telefono : uc.rows[0].correo;
      const codigo = generarOtp();
      // Solo una solicitud vigente por cuenta: invalida las anteriores
      await pool.query(
        'UPDATE recuperaciones_clave SET usado = TRUE WHERE usuario_cliente_id = $1 AND usado = FALSE',
        [uc.rows[0].usuario_cliente_id]
      );
      await pool.query(
        `INSERT INTO recuperaciones_clave (usuario_cliente_id, canal, codigo_hash, expira_en)
         VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
        [uc.rows[0].usuario_cliente_id, canal, await bcrypt.hash(codigo, 10), config.otpValidezMinutos]
      );
      await enviarCodigo({ canal, destino, codigo });
      await audit({
        usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'RECUPERAR_SOLICITAR',
        descripcion: `Solicitud de recuperación de contraseña vía ${canal === 'SMS' ? 'SMS' : 'correo'}`,
      });
      // Respuesta genérica para no revelar si la cuenta existe; en modo demo se entrega el código
      const base = {
        mensaje: `Si la cuenta existe, recibirá su código de seguridad por ${canal === 'SMS' ? 'SMS' : 'correo electrónico'}.`,
      };
      if (config.otpDemo) base.demo_otp = codigo;
      if (config.otpDemo) base.destino = destino ? enmascarar(destino) : null;
      if (config.otpDemo) base.canal = canal;
      return res.json(base);
    }

    res.json({ mensaje: 'Si la cuenta existe, recibirá un código de seguridad.' });
  } catch (e) { next(e); }
});

// POST /api/auth/recuperar-cambiar — valida el código de un solo uso y registra la nueva contraseña
router.post('/recuperar-cambiar', recuperarLimiter, async (req, res, next) => {
  try {
    const { username = '', codigo = '', nuevaClave = '' } = req.body || {};
    if (!username) throw new HttpError(400, 'Indique su usuario o correo');
    if (!/^\d{6}$/.test(String(codigo))) throw new HttpError(400, 'El código de seguridad debe tener 6 dígitos');
    if (String(nuevaClave).length < 6) throw new HttpError(400, 'La nueva contraseña debe tener al menos 6 caracteres');

    const uc = await pool.query(
      `SELECT usuario_cliente_id FROM usuario_cliente WHERE LOWER(username) = LOWER($1) AND estado = 'ACTIVO'`,
      [username]
    );
    if (!uc.rowCount) throw new HttpError(404, 'Cuenta no encontrada o inactiva');

    const rec = await pool.query(
      `SELECT recuperacion_id, codigo_hash, intentos, expira_en FROM recuperaciones_clave
       WHERE usuario_cliente_id = $1 AND usado = FALSE
       ORDER BY recuperacion_id DESC LIMIT 1`,
      [uc.rows[0].usuario_cliente_id]
    );
    if (!rec.rowCount) throw new HttpError(400, 'No hay una solicitud vigente de recuperación. Solicite un código nuevo.');
    const r = rec.rows[0];
    if (r.intentos >= config.otpMaxIntentos) {
      await pool.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE recuperacion_id = $1', [r.recuperacion_id]);
      throw new HttpError(429, 'Demasiados intentos con el código. Solicite uno nuevo.');
    }
    if (new Date(r.expira_en).getTime() < Date.now()) throw new HttpError(400, 'El código de seguridad expiró. Solicite uno nuevo.');

    const ok = await bcrypt.compare(String(codigo), r.codigo_hash);
    if (!ok) {
      const nuevos = r.intentos + 1;
      await pool.query('UPDATE recuperaciones_clave SET intentos = $1 WHERE recuperacion_id = $2', [nuevos, r.recuperacion_id]);
      if (nuevos >= config.otpMaxIntentos) {
        await pool.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE recuperacion_id = $1', [r.recuperacion_id]);
      }
      throw new HttpError(401, 'Código de seguridad incorrecto');
    }

    const hash = await bcrypt.hash(String(nuevaClave), 10);
    await pool.query('UPDATE usuario_cliente SET password_hash = $1 WHERE usuario_cliente_id = $2', [hash, uc.rows[0].usuario_cliente_id]);
    await pool.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE usuario_cliente_id = $1', [uc.rows[0].usuario_cliente_id]);
    await audit({
      usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'CLAVE_RECUPERADA',
      descripcion: 'Contraseña restablecida mediante código de seguridad',
    });
    res.json({ mensaje: 'Contraseña actualizada. Ya puede iniciar sesión con su nueva contraseña.' });
  } catch (e) { next(e); }
});

export default router;