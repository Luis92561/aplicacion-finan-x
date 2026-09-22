import pool from '../db.js';

/** Registra una operación relevante en auditoría. */
export async function audit({ usuario, usuarioTipo = 'INTERNO', modulo, operacion, registro = '', descripcion = '' }) {
  try {
    await pool.query(
      `INSERT INTO auditoria (usuario, usuario_tipo, modulo, operacion, registro_afectado, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuario || null, usuarioTipo, modulo, operacion, String(registro || ''), descripcion || '']
    );
  } catch (err) {
    console.error('Fallo al registrar auditoría:', err.message);
  }
}

export const AUDITOR = {
  modulo: (m) => (usuario) => ({ usuario, modulo: m, operacion: '', registro: '', descripcion: '' }),
};