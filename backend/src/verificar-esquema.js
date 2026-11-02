import pool from './db.js';

/**
 * Columnas y tablas que el código espera encontrar. Si falta alguna, la aplicación
 * falla al arrancar con un mensaje que dice exactamente qué ejecutar, en vez de
 * responder 500 en cada consulta (lo que oculta el problema real).
 */
const REQUERIDOS = [
  ['usuarios', 'username'],
  ['usuarios', 'debe_cambiar_clave'],
  ['usuarios', 'clave_actualizada_en'],
  ['usuarios', 'fallos_login'],
  ['usuarios', 'bloqueado_hasta'],
  ['usuario_cliente', 'debe_cambiar_clave'],
  ['usuario_cliente', 'fallos_login'],
  ['auditoria', 'ip'],
  ['auditoria', 'user_agent'],
  ['recuperaciones_clave', 'codigo_hash'],
  ['facturas', 'numero_factura'],
  ['pagos', 'metodo_pago'],
];

export async function verificarEsquema() {
  const r = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'`
  );
  const presentes = new Set(r.rows.map((x) => `${x.table_name}.${x.column_name}`));
  const faltan = REQUERIDOS.filter(([tabla, columna]) => !presentes.has(`${tabla}.${columna}`));

  if (faltan.length) {
    throw new Error(
      'FINAN-X: la base de datos no tiene el esquema esperado.\n' +
      `  Faltan: ${faltan.map(([t, c]) => `${t}.${c}`).join(', ')}\n` +
      '  Aplique la migración de despliegue:\n' +
      '    docker compose exec -T db psql -U postgres -d finanx < database/migracion_despliegue.sql\n' +
      '  (o vuelva a crear el volumen si es una instalación nueva).'
    );
  }
}
