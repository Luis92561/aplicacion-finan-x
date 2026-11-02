import pool from '../db.js';

/**
 * Registra una operación relevante en la tabla `auditoria`.
 *
 * Importante: se puede pasar el cliente de una transacción (`client`) para que el registro
 * se inserte DENTRO de la misma transacción que la operación que describe. Eso es lo que se
 * debe hacer en las rutas que abren transacción:
 *
 *     await client.query('BEGIN');
 *     ... la operación ...
 *     await audit({ req, client, usuario, modulo, operacion, ... });   // participa de la transacción
 *     await client.query('COMMIT');
 *
 * Si se pasa `req`, se guardan también la IP y el user-agent: sin ellos, ante un incidente
 * no se puede saber desde dónde se hizo la operación.
 */
export async function audit({
  req = null,
  usuario,
  usuarioTipo = 'INTERNO',
  modulo,
  operacion,
  registro = '',
  descripcion = '',
  client = null,
}) {
  const ejecutor = client || pool;
  const ip = req?.ip || null;
  const userAgent = req?.get?.('user-agent')?.slice(0, 300) || null;

  try {
    await ejecutor.query(
      `INSERT INTO auditoria (usuario, usuario_tipo, modulo, operacion, registro_afectado, descripcion, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [usuario || null, usuarioTipo, modulo, operacion, String(registro || ''), descripcion || '', ip, userAgent]
    );
  } catch (err) {
    // Si la auditoría va dentro de una transacción, el error debe propagarse para que la
    // operación completa se revierta: no queremos cambios sin traza.
    if (client) throw err;
    console.error('Fallo al registrar auditoría:', err.message);
  }
}
