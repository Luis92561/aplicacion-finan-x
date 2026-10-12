/**
 * Extrae el esquema REAL de la base de datos y lo deja listo para documentar.
 *
 * Escribe en ../deep-docs/:
 *   - _esquema.json   datos crudos (columnas, PK, FK, UNIQUE, CHECK, indices, vistas)
 *
 * Asi el diccionario de datos y el MER coinciden con la implementacion por
 * construccion: se extraen de la base de datos, no se transcriben a mano.
 *
 * Uso (desde backend/):
 *   PGHOST=localhost PGPORT=5432 PGUSER=finanx PGPASSWORD=finanx PGDATABASE=finanx \
 *     node scripts/generar-esquema.mjs
 */
import pg from 'pg';
import fs from 'node:fs';

const db = new pg.Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'finanx',
  password: process.env.PGPASSWORD || 'finanx',
  database: process.env.PGDATABASE || 'finanx',
});

await db.connect();

// ---------- Columnas ----------
const columnas = (await db.query(`
  SELECT c.table_name, c.column_name, c.data_type, c.character_maximum_length,
         c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default, c.ordinal_position
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ORDER BY c.table_name, c.ordinal_position
`)).rows;

// ---------- Claves primarias ----------
const pks = (await db.query(`
  SELECT tc.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
`)).rows;

// ---------- Claves foraneas ----------
const fks = (await db.query(`
  SELECT tc.table_name, kcu.column_name,
         ccu.table_name AS tabla_referenciada, ccu.column_name AS columna_referenciada,
         rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
`)).rows;

// ---------- Restricciones UNIQUE ----------
const uniques = (await db.query(`
  SELECT tc.table_name, kcu.column_name, tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
  ORDER BY tc.table_name, tc.constraint_name
`)).rows;

// ---------- Restricciones CHECK ----------
const checks = (await db.query(`
  SELECT rel.relname AS table_name, con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS definicion
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'c'
  ORDER BY rel.relname, con.conname
`)).rows;

// ---------- Indices ----------
const indices = (await db.query(`
  SELECT tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname
`)).rows;

// ---------- Vistas ----------
const vistas = (await db.query(`
  SELECT table_name, view_definition
  FROM information_schema.views WHERE table_schema = 'public'
`)).rows;

// ---------- Validar que todo esta descrito ----------
// Este archivo vive en backend/scripts/, asi que la raiz del proyecto esta dos niveles arriba.
const RAIZ = new URL('../../', import.meta.url);
const DESCRIPCIONES = JSON.parse(fs.readFileSync(new URL('deep-docs/_descripciones.json', RAIZ), 'utf8'));

const salida = { columnas, pks, fks, uniques, checks, indices, vistas, generado: new Date().toISOString() };
fs.writeFileSync(new URL('deep-docs/_esquema.json', RAIZ), JSON.stringify(salida, null, 2), 'utf8');

// ---------- Informe ----------
const tablas = [...new Set(columnas.map((c) => c.table_name))];
console.log(`Tablas: ${tablas.length} | Columnas: ${columnas.length} | PK: ${pks.length} | FK: ${fks.length}`);
console.log(`UNIQUE: ${uniques.length} | CHECK: ${checks.length} | Indices: ${indices.length} | Vistas: ${vistas.length}`);

const sinDescripcion = [];
for (const c of columnas) {
  if (!DESCRIPCIONES[`${c.table_name}.${c.column_name}`]) sinDescripcion.push(`${c.table_name}.${c.column_name}`);
}
for (const t of tablas) {
  if (!DESCRIPCIONES[`__tabla__.${t}`]) sinDescripcion.push(`(tabla) ${t}`);
}

console.log('');
if (sinDescripcion.length) {
  console.log(`AVISO: ${sinDescripcion.length} elementos SIN descripcion:`);
  for (const s of sinDescripcion) console.log('   ' + s);
} else {
  console.log('OK: todas las tablas y columnas tienen descripcion.');
}

console.log('');
for (const t of tablas) {
  const n = columnas.filter((c) => c.table_name === t).length;
  console.log(`  ${t.padEnd(22)} ${String(n).padStart(2)} columnas`);
}

await db.end();
