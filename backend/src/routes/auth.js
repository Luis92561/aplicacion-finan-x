import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { config } from '../config.js';
import {
  signToken,
  requireAuth,
  fijarCookieSesion,
  limpiarCookieSesion,
} from '../middleware/auth.js';
import { registrarFalloLogin, limpiarFallosLogin } from '../middleware/rateLimit.js';
import { audit } from '../middleware/audit.js';
import { enviarCodigo } from '../middleware/notificar.js';
import { HttpError, validarPassword } from '../utils.js';

const router = Router();

/**
 * Hash de relleno para igualar tiempos cuando el usuario no existe: si solo se llama a
 * bcrypt.compare cuando la cuenta existe, el tiempo de respuesta delata qué usuarios
 * están registrados (enumeración de cuentas).
 */
const HASH_RELLENO = bcrypt.hashSync('clave-ficticia-para-igualar-tiempos', 10);

const USUARIO_VALIDO = /^[a-z0-9._-]{3,32}$/i;

/** Valida y normaliza el nombre de usuario (sin @, para no chocar con un correo). */
function validarUsuario(valor) {
  const usuario = String(valor ?? '').trim();
  if (!USUARIO_VALIDO.test(usuario)) {
    throw new HttpError(400, 'El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo');
  }
  return usuario.toLowerCase();
}

// Anti-spam: máx. de solicitudes de autoregistro por IP en 1 hora.
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.registroRateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de registro desde esta dirección. Intente más tarde.' },
});

// Anti-spam: recuperación de contraseña (solicitar código + validar/cambiar) por IP.
const recuperarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.recuperarRateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación desde esta dirección. Intente más tarde.' },
});

// ---------------------------------------------------------------------------
// Utilidades de bloqueo por cuenta (sobrevive a cambios de IP y reinicios)
// ---------------------------------------------------------------------------
const TABLA_CUENTA = {
  interno: { tabla: 'usuarios', id: 'usuario_id' },
  cliente: { tabla: 'usuario_cliente', id: 'usuario_cliente_id' },
};

async function registrarFalloCuenta(tipo, id) {
  const { tabla, id: pk } = TABLA_CUENTA[tipo];
  const r = await pool.query(
    `UPDATE ${tabla}
        SET fallos_login = fallos_login + 1,
            bloqueado_hasta = CASE
              WHEN fallos_login + 1 >= $2
                THEN NOW() + make_interval(mins => $3 * (1 + (fallos_login / $2)))
              ELSE bloqueado_hasta
            END
      WHERE ${pk} = $1
      RETURNING fallos_login, bloqueado_hasta`,
    [id, config.loginMaxFallidos, config.loginBloqueoMinutos]
  );
  return r.rows[0] || null;
}

async function limpiarBloqueoCuenta(tipo, id) {
  const { tabla, id: pk } = TABLA_CUENTA[tipo];
  await pool.query(
    `UPDATE ${tabla} SET fallos_login = 0, bloqueado_hasta = NULL WHERE ${pk} = $1`,
    [id]
  );
}

function cuentaBloqueada(fila) {
  return fila?.bloqueado_hasta && new Date(fila.bloqueado_hasta).getTime() > Date.now();
}

// ---------------------------------------------------------------------------
// POST /api/auth/login — usuario interno o cliente (usuario o correo)
// ---------------------------------------------------------------------------
router.post('/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  const identificador = String(username || '').trim();
  try {
    if (!identificador || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');

    // 1) Usuario interno por nombre de usuario o correo.
    const interno = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.correo, u.username, u.password_hash, u.estado,
              u.token_version, u.fallos_login, u.bloqueado_hasta, u.debe_cambiar_clave, r.nombre AS rol
         FROM usuarios u JOIN roles r ON r.rol_id = u.rol_id
        WHERE LOWER(u.correo) = LOWER($1) OR (u.username IS NOT NULL AND LOWER(u.username) = LOWER($1))
        LIMIT 1`,
      [identificador]
    );

    // 2) Cuenta de cliente (portal).
    const cli = interno.rowCount
      ? { rowCount: 0, rows: [] }
      : await pool.query(
        `SELECT uc.usuario_cliente_id, uc.cliente_id, uc.username, uc.password_hash, uc.token_version,
                uc.estado AS cuenta_estado, uc.fallos_login, uc.bloqueado_hasta, uc.debe_cambiar_clave,
                c.nombre_razon_social, c.estado AS cliente_estado
           FROM usuario_cliente uc JOIN clientes c ON c.cliente_id = uc.cliente_id
          WHERE LOWER(uc.username) = LOWER($1)
             OR (c.correo IS NOT NULL AND LOWER(c.correo) = LOWER($1))
          ORDER BY CASE WHEN LOWER(uc.username) = LOWER($1) THEN 0 ELSE 1 END
          LIMIT 1`,
        [identificador]
      );

    const esInterno = interno.rowCount > 0;
    const fila = esInterno ? interno.rows[0] : cli.rows[0] || null;

    // Si la cuenta no existe se compara igualmente contra un hash de relleno: el tiempo
    // de respuesta no debe delatar si el usuario está registrado.
    const hash = fila?.password_hash || HASH_RELLENO;
    const ok = await bcrypt.compare(String(password), hash);

    if (!fila || !ok) {
      if (fila) {
        await registrarFalloCuenta(esInterno ? 'interno' : 'cliente', esInterno ? fila.usuario_id : fila.usuario_cliente_id);
      }
      const bloqueado = registrarFalloLogin(req, identificador);
      await audit({
        req, usuario: identificador, modulo: 'Autenticación', operacion: 'LOGIN_FALLIDO',
        descripcion: `Intento fallido para ${identificador}`,
      });
      if (bloqueado) {
        return res.status(429).json({
          error: 'Demasiados intentos fallidos. Espere unos minutos antes de volver a intentar.',
          codigo: 'CUENTA_BLOQUEADA',
        });
      }
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // A partir de aquí la contraseña es correcta: solo entonces se revela el estado.
    if (cuentaBloqueada(fila)) {
      await audit({
        req, usuario: identificador, modulo: 'Autenticación', operacion: 'LOGIN_BLOQUEADO',
        descripcion: `Intento sobre una cuenta bloqueada: ${identificador}`,
      });
      return res.status(429).json({
        error: 'La cuenta está bloqueada temporalmente por intentos fallidos. Intente más tarde.',
        codigo: 'CUENTA_BLOQUEADA',
      });
    }

    if (esInterno && fila.estado !== 'ACTIVO') throw new HttpError(403, 'La cuenta está inactiva');
    if (!esInterno && fila.cuenta_estado !== 'ACTIVO') throw new HttpError(403, 'La cuenta está inactiva');
    if (!esInterno && fila.cliente_estado !== 'ACTIVO') throw new HttpError(403, 'El cliente está inactivo');

    await limpiarBloqueoCuenta(esInterno ? 'interno' : 'cliente', esInterno ? fila.usuario_id : fila.usuario_cliente_id);
    limpiarFallosLogin(req, identificador);

    const user = esInterno
      ? {
        tipo: 'interno', usuarioId: fila.usuario_id, nombre: fila.nombre, correo: fila.correo,
        username: fila.username, rol: fila.rol, ver: fila.token_version,
        debeCambiarClave: Boolean(fila.debe_cambiar_clave),
      }
      : {
        tipo: 'cliente', usuarioClienteId: fila.usuario_cliente_id, clienteId: fila.cliente_id,
        nombre: fila.nombre_razon_social, username: fila.username, ver: fila.token_version,
        debeCambiarClave: Boolean(fila.debe_cambiar_clave),
      };

    const token = signToken(user);
    fijarCookieSesion(res, token);

    await audit({
      req, usuario: esInterno ? fila.correo : fila.username,
      usuarioTipo: esInterno ? 'INTERNO' : 'CLIENTE',
      modulo: 'Autenticación', operacion: 'LOGIN',
      descripcion: esInterno
        ? `Inicio de sesión de ${fila.correo} (${fila.rol})`
        : `Inicio de sesión del cliente ${fila.nombre_razon_social}`,
    });

    return res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/sesion — quién está autenticado (cookie o Bearer)
// ---------------------------------------------------------------------------
router.get('/sesion', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// POST /api/auth/cambiar-clave — cambio propio (primer ingreso o voluntario)
// ---------------------------------------------------------------------------
router.post('/cambiar-clave', requireAuth, async (req, res, next) => {
  try {
    const { claveActual, claveNueva } = req.body || {};
    if (!claveActual || !claveNueva) throw new HttpError(400, 'Indique la contraseña actual y la nueva');

    const esCliente = req.user.tipo === 'cliente';
    const tabla = esCliente ? 'usuario_cliente' : 'usuarios';
    const pk = esCliente ? 'usuario_cliente_id' : 'usuario_id';
    const id = esCliente ? req.user.usuarioClienteId : req.user.usuarioId;

    const fila = await pool.query(`SELECT password_hash FROM ${tabla} WHERE ${pk} = $1`, [id]);
    if (!fila.rowCount) throw new HttpError(401, 'Sesión inválida o expirada');

    const actualOk = await bcrypt.compare(String(claveActual), fila.rows[0].password_hash);
    if (!actualOk) {
      await audit({
        req, usuario: req.user.username || req.user.correo, usuarioTipo: esCliente ? 'CLIENTE' : 'INTERNO',
        modulo: 'Autenticación', operacion: 'CAMBIO_CLAVE_FALLIDO',
        descripcion: 'Intento de cambio de contraseña con la clave actual incorrecta',
      });
      throw new HttpError(401, 'La contraseña actual no es correcta');
    }

    validarPassword(claveNueva, {
      username: req.user.username,
      correo: req.user.correo,
      nombre: req.user.nombre,
    });
    if (await bcrypt.compare(String(claveNueva), fila.rows[0].password_hash)) {
      throw new HttpError(400, 'La contraseña nueva debe ser distinta de la actual');
    }

    const hash = await bcrypt.hash(String(claveNueva), config.bcryptRounds);
    await pool.query(
      `UPDATE ${tabla}
          SET password_hash = $1,
              debe_cambiar_clave = FALSE,
              clave_actualizada_en = NOW(),
              fallos_login = 0,
              bloqueado_hasta = NULL,
              token_version = token_version + 1
        WHERE ${pk} = $2`,
      [hash, id]
    );

    // El token anterior ya no vale (token_version cambió): se emite uno nuevo.
    const version = await pool.query(`SELECT token_version FROM ${tabla} WHERE ${pk} = $1`, [id]);
    const user = { ...req.user, ver: version.rows[0].token_version, debeCambiarClave: false };
    const token = signToken(user);
    fijarCookieSesion(res, token);

    await audit({
      req, usuario: req.user.username || req.user.correo, usuarioTipo: esCliente ? 'CLIENTE' : 'INTERNO',
      modulo: 'Autenticación', operacion: 'CAMBIO_CLAVE',
      descripcion: 'Contraseña actualizada por el titular (sesiones anteriores invalidadas)',
    });

    res.json({ ok: true, token, user });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout — cierra la sesión (y opcionalmente todas)
// ---------------------------------------------------------------------------
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    if (req.body?.todas) {
      const esCliente = req.user.tipo === 'cliente';
      const tabla = esCliente ? 'usuario_cliente' : 'usuarios';
      const pk = esCliente ? 'usuario_cliente_id' : 'usuario_id';
      const id = esCliente ? req.user.usuarioClienteId : req.user.usuarioId;
      await pool.query(`UPDATE ${tabla} SET token_version = token_version + 1 WHERE ${pk} = $1`, [id]);
    }
    limpiarCookieSesion(res);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// POST /api/auth/registro — autoregistro de clientes (puede estar deshabilitado)
// ---------------------------------------------------------------------------
router.post('/registro', registroLimiter, async (req, res, next) => {
  const b = req.body || {};
  const {
    tipoCliente = 'PERSONA', tipoIdentificacion = 'CC', numeroIdentificacion, nombreRazonSocial,
    telefono, correo, direccion, ciudad, username, password,
  } = b;
  try {
    if (!config.registroAbierto) {
      throw new HttpError(403, 'El autoregistro de clientes está deshabilitado. Solicite la creación de su cuenta a la oficina.');
    }
    if (!numeroIdentificacion || !nombreRazonSocial) throw new HttpError(400, 'Número de identificación y nombre son obligatorios');
    if (!username || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');
    const usuario = validarUsuario(username);
    validarPassword(password, { username: usuario, correo, nombre: nombreRazonSocial });
    if (!['PERSONA', 'EMPRESA'].includes(String(tipoCliente))) throw new HttpError(400, 'Tipo de cliente inválido');
    if (!['CC', 'CE', 'NIT', 'PASAPORTE'].includes(String(tipoIdentificacion))) throw new HttpError(400, 'Tipo de identificación inválido');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dupIdent = await client.query(
        'SELECT 1 FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
        [tipoIdentificacion, numeroIdentificacion]
      );
      if (dupIdent.rowCount) throw new HttpError(409, 'No fue posible completar el registro con esos datos');

      const dupUser = await client.query(
        `SELECT 1 FROM usuario_cliente WHERE LOWER(username) = LOWER($1)
         UNION
         SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER($1) OR LOWER(COALESCE(username,'')) = LOWER($1)`,
        [usuario]
      );
      if (dupUser.rowCount) throw new HttpError(409, 'Ese nombre de usuario ya está en uso');

      const cli = await client.query(
        `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING cliente_id`,
        [tipoCliente, tipoIdentificacion, numeroIdentificacion, nombreRazonSocial, telefono || null, correo || null, direccion || null, ciudad || null]
      );
      const clienteId = cli.rows[0].cliente_id;

      const hash = await bcrypt.hash(String(password), config.bcryptRounds);
      const uc = await client.query(
        'INSERT INTO usuario_cliente (cliente_id, username, password_hash) VALUES ($1, $2, $3) RETURNING usuario_cliente_id, token_version',
        [clienteId, usuario, hash]
      );

      await audit({
        req, client, usuario, usuarioTipo: 'CLIENTE', modulo: 'Clientes', operacion: 'AUTORREGISTRO',
        registro: clienteId, descripcion: `Autoregistro del cliente ${nombreRazonSocial} (${tipoIdentificacion} ${numeroIdentificacion})`,
      });

      await client.query('COMMIT');

      const user = {
        tipo: 'cliente', usuarioClienteId: uc.rows[0].usuario_cliente_id, clienteId,
        nombre: nombreRazonSocial, username: usuario, ver: uc.rows[0].token_version,
        debeCambiarClave: false,
      };
      const token = signToken(user);
      fijarCookieSesion(res, token);
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

/**
 * Genera un código de un solo uso de 6 dígitos.
 *
 * crypto.randomInt y NO Math.random: este código es un factor de seguridad (permite
 * cambiar la contraseña de una cuenta) y Math.random no es criptográficamente seguro.
 */
function generarOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Enmascara el destino (correo/teléfono) para mostrarlo de forma segura. */
function enmascararDestino(destino) {
  const s = String(destino || '');
  if (s.length <= 4) return '***';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

// ---------------------------------------------------------------------------
// POST /api/auth/recuperar-solicitar — pide el código de un solo uso
// ---------------------------------------------------------------------------
router.post('/recuperar-solicitar', recuperarLimiter, async (req, res, next) => {
  try {
    const { username, canal = 'EMAIL' } = req.body || {};
    if (!username) throw new HttpError(400, 'Indique su usuario o correo');
    if (!['EMAIL', 'SMS'].includes(canal)) throw new HttpError(400, 'Canal de entrega inválido (EMAIL o SMS)');

    // Respuesta siempre genérica: no revela si la cuenta existe ni si tiene contacto.
    const generica = {
      mensaje: `Si la cuenta existe y tiene un contacto registrado, recibirá su código por ${canal === 'SMS' ? 'SMS' : 'correo electrónico'}.`,
    };

    const uc = await pool.query(
      `SELECT uc.usuario_cliente_id, c.correo, c.telefono,
              (SELECT MAX(creado_en) FROM recuperaciones_clave r
                WHERE r.usuario_cliente_id = uc.usuario_cliente_id) AS ultima
         FROM usuario_cliente uc JOIN clientes c ON c.cliente_id = uc.cliente_id
        WHERE LOWER(uc.username) = LOWER($1) AND uc.estado = 'ACTIVO'`,
      [username]
    );

    if (!uc.rowCount) return res.json(generica);

    const fila = uc.rows[0];
    const destino = canal === 'SMS' ? fila.telefono : fila.correo;
    if (!destino) return res.json(generica);

    // Enfriamiento por cuenta: evita convertir el sistema en una máquina de enviar SMS.
    if (fila.ultima && Date.now() - new Date(fila.ultima).getTime() < config.otpCooldownSegundos * 1000) {
      return res.json(generica);
    }

    const codigo = generarOtp();
    await pool.query(
      'UPDATE recuperaciones_clave SET usado = TRUE WHERE usuario_cliente_id = $1 AND usado = FALSE',
      [fila.usuario_cliente_id]
    );
    await pool.query(
      `INSERT INTO recuperaciones_clave (usuario_cliente_id, canal, codigo_hash, expira_en)
       VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
      [fila.usuario_cliente_id, canal, await bcrypt.hash(codigo, 10), config.otpValidezMinutos]
    );
    await enviarCodigo({ canal, destino, codigo });
    await audit({
      req, usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'RECUPERAR_SOLICITAR',
      descripcion: `Solicitud de recuperación de contraseña vía ${canal === 'SMS' ? 'SMS' : 'correo'}`,
    });

    const base = { ...generica };
    if (config.otpDemo) base.demo_otp = codigo;
    if (config.otpDemo) base.destino = enmascararDestino(destino);
    if (config.otpDemo) base.canal = canal;
    return res.json(base);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// POST /api/auth/recuperar-cambiar — valida el código y registra la nueva clave
// ---------------------------------------------------------------------------
router.post('/recuperar-cambiar', recuperarLimiter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { username = '', codigo = '', nuevaClave = '' } = req.body || {};
    if (!username) throw new HttpError(400, 'Indique su usuario o correo');
    if (!/^\d{6}$/.test(String(codigo))) throw new HttpError(400, 'El código de seguridad debe tener 6 dígitos');
    validarPassword(nuevaClave, { username });

    await client.query('BEGIN');

    const uc = await client.query(
      `SELECT usuario_cliente_id FROM usuario_cliente WHERE LOWER(username) = LOWER($1) AND estado = 'ACTIVO'`,
      [username]
    );
    // Mensaje deliberadamente genérico: no revela qué cuentas existen.
    if (!uc.rowCount) throw new HttpError(400, 'No hay una solicitud vigente de recuperación. Solicite un código nuevo.');

    const rec = await client.query(
      `SELECT recuperacion_id, codigo_hash, intentos, expira_en FROM recuperaciones_clave
       WHERE usuario_cliente_id = $1 AND usado = FALSE
       ORDER BY recuperacion_id DESC LIMIT 1`,
      [uc.rows[0].usuario_cliente_id]
    );
    if (!rec.rowCount) throw new HttpError(400, 'No hay una solicitud vigente de recuperación. Solicite un código nuevo.');
    const r = rec.rows[0];
    if (r.intentos >= config.otpMaxIntentos) {
      await client.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE recuperacion_id = $1', [r.recuperacion_id]);
      throw new HttpError(429, 'Demasiados intentos con el código. Solicite uno nuevo.');
    }
    if (new Date(r.expira_en).getTime() < Date.now()) throw new HttpError(400, 'El código de seguridad expiró. Solicite uno nuevo.');

    const ok = await bcrypt.compare(String(codigo), r.codigo_hash);
    if (!ok) {
      const nuevos = r.intentos + 1;
      await client.query('UPDATE recuperaciones_clave SET intentos = $1 WHERE recuperacion_id = $2', [nuevos, r.recuperacion_id]);
      if (nuevos >= config.otpMaxIntentos) {
        await client.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE recuperacion_id = $1', [r.recuperacion_id]);
      }
      await client.query('COMMIT');
      throw new HttpError(401, 'Código de seguridad incorrecto');
    }

    const hash = await bcrypt.hash(String(nuevaClave), config.bcryptRounds);
    await client.query(
      `UPDATE usuario_cliente
          SET password_hash = $1,
              debe_cambiar_clave = FALSE,
              clave_actualizada_en = NOW(),
              fallos_login = 0,
              bloqueado_hasta = NULL,
              token_version = token_version + 1
        WHERE usuario_cliente_id = $2`,
      [hash, uc.rows[0].usuario_cliente_id]
    );
    await client.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE usuario_cliente_id = $1', [uc.rows[0].usuario_cliente_id]);
    await audit({
      req, client, usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'CLAVE_RECUPERADA',
      descripcion: 'Contraseña restablecida mediante código de seguridad (sesiones anteriores invalidadas)',
    });

    await client.query('COMMIT');
    res.json({ mensaje: 'Contraseña actualizada. Ya puede iniciar sesión con su nueva contraseña.' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

export default router;
