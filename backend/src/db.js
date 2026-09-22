import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 10,
});

pool.on('error', (err) => console.error('Error inesperado en el pool de PG:', err.message));

export default pool;