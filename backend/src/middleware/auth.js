import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Exige un token válido. Adjunta req.user = { tipo, ... } */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
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