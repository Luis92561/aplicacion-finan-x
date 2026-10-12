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
 *     await audit({ client, usuario, modulo, operacion, ... });   // participa de la transacción
 *     await client.query('COMMIT');
 *
 * Antes se llamaba siempre al pool y siempre DESPUÉS del COMMIT, así que si la inserción de
 * auditoría fallaba la operación quedaba guardada sin dejar rastro (la función nunca lanza,
 * solo escribe en consola). Con `client` ambos cambios se confirman o se deshacen juntos.
 */
export async function audit({
  usuario,
  usuarioTipo = 'INTERNO',
  modulo,
  operacion,
  registro = '',
  descripcion = '',
  client = null,
}) {
  const ejecutor = client || pool;
  try {
    await ejecutor.query(
      `INSERT INTO auditoria (usuario, usuario_tipo, modulo, operacion, registro_afectado, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuario || null, usuarioTipo, modulo, operacion, String(registro || ''), descripcion || '']
    );
  } catch (err) {
    // Si la auditoría va dentro de una transacción, el error debe propagarse para que la
    // operación completa se revierta: no queremos cambios sin traza.
    if (client) throw err;
    console.error('Fallo al registrar auditoría:', err.message);
  }
}
