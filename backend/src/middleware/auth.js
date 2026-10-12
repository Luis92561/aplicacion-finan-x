import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import pool from '../db.js';

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Exige un token válido. Adjunta req.user = { tipo, ... }
 *
 * Además de verificar la firma y la caducidad, comprueba que el token siga "vigente"
 * comparando su `ver` con el `token_version` actual de la cuenta en la base de datos.
 *
 * ¿Por qué? Un JWT no se puede revocar por sí solo: vale hasta que caduca (8 h). Eso
 * significaba que, si a alguien le robaban el token y cambiaba su contraseña para
 * protegerse, el token robado seguía funcionando. Al cambiar la contraseña se incrementa
 * `token_version`, así que todos los tokens anteriores quedan invalidados al instante.
 *
 * Coste: una consulta ligera por clave primaria en cada petición autenticada.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
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

    // Cada tipo de cuenta vive en una tabla distinta.
    const consulta = payload.tipo === 'cliente'
      ? { sql: 'SELECT token_version FROM usuario_cliente WHERE usuario_cliente_id = $1', id: payload.usuarioClienteId }
      : { sql: 'SELECT token_version FROM usuarios WHERE usuario_id = $1', id: payload.usuarioId };

    const fila = await pool.query(consulta.sql, [consulta.id]);

    // La cuenta ya no existe (o se desactivó el acceso): el token deja de valer.
    if (!fila.rowCount) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    if (Number(fila.rows[0].token_version) !== versionEnToken) {
      return res.status(401).json({
        error: 'La sesión se cerró porque la contraseña cambió. Inicie sesión de nuevo.',
      });
    }

    req.user = payload;
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
