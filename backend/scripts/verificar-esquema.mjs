/**
 * Comprueba el esquema sin arrancar el servidor. Útil en el despliegue:
 *   node scripts/verificar-esquema.mjs
 * Sale con 0 si está todo, 1 con instrucciones si falta la migración.
 */
import 'dotenv/config';
import { verificarEsquema } from '../src/verificar-esquema.js';
import pool from '../src/db.js';

try {
  await verificarEsquema();
  console.log('✔ Esquema de base de datos correcto');
  process.exitCode = 0;
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
