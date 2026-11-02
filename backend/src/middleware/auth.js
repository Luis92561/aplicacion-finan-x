import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import pool from '../db.js';

/** Firma un token con emisor, audiencia y algoritmo fijos. */
export function signToken(payload) {
  // Se descartan las reclamaciones estándar que pudiera traer el objeto (por ejemplo al
  // re-firmar el token de una sesión ya verificada): con `exp` presente, jsonwebtoken
  // rechaza `expiresIn`.
  const { iat, exp, nbf, jti, iss, aud, ...limpio } = payload;
  return jwt.sign(limpio, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    algorithm: 'HS256',
  });
}

/** Lee una cookie del encabezado sin depender de middleware adicional. */
function leerCookie(req, nombre) {
  const crudo = req.headers.cookie || '';
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nombre) {
      try {
        return decodeURIComponent(parte.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Obtiene el token de la petición: cabecera `Authorization: Bearer` (API y pruebas)
 * o cookie `HttpOnly` (navegador). La cookie es la vía normal del frontend.
 */
export function tokenDe(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return leerCookie(req, config.cookieNombre);
}

export function opcionesCookie() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
  };
}

export function fijarCookieSesion(res, token) {
  res.cookie(config.cookieNombre, token, {
    ...opcionesCookie(),
    maxAge: config.cookieMaxAgeSegundos * 1000,
  });
}

export function limpiarCookieSesion(res) {
  res.clearCookie(config.cookieNombre, opcionesCookie());
}

/** Rutas que se pueden usar aunque la cuenta deba cambiar la contraseña. */
const RUTAS_SIN_CAMBIO_OBLIGATORIO = new Set([
  '/api/auth/sesion',
  '/api/auth/cambiar-clave',
  '/api/auth/logout',
]);

/**
 * Exige una sesión válida. Adjunta req.user = { tipo, ... }
 *
 * Además de verificar la firma y la caducidad, comprueba que el token siga "vigente"
 * comparando su `ver` con el `token_version` actual de la cuenta en la base de datos.
 *
 * Un JWT no se puede revocar por sí solo: vale hasta que caduca. Al cambiar la contraseña
 * (o desactivar la cuenta) se incrementa `token_version`, así que todos los tokens
 * anteriores quedan invalidados al instante.
 *
 * También es aquí donde se hace cumplir el cambio de contraseña del primer ingreso: con
 * `debe_cambiar_clave` activo solo se permiten las rutas de sesión/cambio/logout. El dato
 * se lee de la base de datos, no del token, para que un token viejo no pueda saltárselo.
 */
export async function requireAuth(req, res, next) {
  const token = tokenDe(req);
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  try {
    // Un token emitido antes de esta función no trae `ver`. Se rechaza en lugar de asumir la
    // versión 1: al asumirla, un token sin versión pasaba la comprobación (coincidía con el
    // valor por defecto de la columna) y la invalidación de sesiones quedaba anulada en la
    // práctica aunque la comprobación estuviera escrita.
    const versionEnToken = Number(payload.ver);
    if (!Number.isInteger(versionEnToken)) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    // Cada tipo de cuenta vive en una tabla distinta. Para el portal se comprueba además
    // que la cuenta y el cliente sigan activos: desactivar un cliente debe cortar su acceso.
    const esCliente = payload.tipo === 'cliente';
    const consulta = esCliente
      ? {
        sql: `SELECT uc.token_version, uc.debe_cambiar_clave, uc.estado AS cuenta_estado,
                     c.estado AS cliente_estado
                FROM usuario_cliente uc
                JOIN clientes c ON c.cliente_id = uc.cliente_id
               WHERE uc.usuario_cliente_id = $1`,
        id: payload.usuarioClienteId,
      }
      : {
        sql: 'SELECT token_version, debe_cambiar_clave, estado FROM usuarios WHERE usuario_id = $1',
        id: payload.usuarioId,
      };

    const fila = await pool.query(consulta.sql, [consulta.id]);
    if (!fila.rowCount) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const datos = fila.rows[0];
    if (esCliente) {
      if (datos.cuenta_estado !== 'ACTIVO' || datos.cliente_estado !== 'ACTIVO') {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
      }
    } else if (datos.estado !== 'ACTIVO') {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    if (Number(datos.token_version) !== versionEnToken) {
      return res.status(401).json({
        error: 'La sesión se cerró porque la contraseña cambió. Inicie sesión de nuevo.',
      });
    }

    req.user = {
      ...payload,
      debeCambiarClave: Boolean(datos.debe_cambiar_clave),
    };

    const ruta = String(req.originalUrl || '').split('?')[0];
    if (req.user.debeCambiarClave && !RUTAS_SIN_CAMBIO_OBLIGATORIO.has(ruta)) {
      return res.status(403).json({
        error: 'Debe cambiar la contraseña antes de continuar.',
        codigo: 'CAMBIO_CLAVE_REQUERIDO',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/** Autorización por rol (solo usuarios internos). */
export function requireRol(...roles) {
  return (req, res, next) => {
    if (req.user.tipo !== 'interno') {
      return res.status(403).json({ error: 'Operación reservada para usuarios internos' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: `Requiere rol: ${roles.join(', ')}` });
    }
    next();
  };
}

/** Exige que el token sea de un cliente y tenga clienteId (aislamiento por cliente). */
export function requireCliente(req, res, next) {
  if (req.user.tipo !== 'cliente') {
    return res.status(403).json({ error: 'Operación reservada para clientes' });
  }
  if (!req.user.clienteId) {
    return res.status(403).json({ error: 'La cuenta no está vinculada a un cliente' });
  }
  next();
}
