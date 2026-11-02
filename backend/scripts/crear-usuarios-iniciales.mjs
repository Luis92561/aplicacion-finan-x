/**
 * FINAN-X · Crea las cuentas iniciales de la aplicación.
 *
 * Uso:
 *   npm run init:usuarios
 *   npm run init:usuarios -- --archivo ../primer-ingreso/usuarios-iniciales.json
 *
 * - Si el archivo no existe, lo genera con contraseñas temporales aleatorias.
 * - Si existe, usa esas contraseñas (así el acta entregada coincide con la base).
 * - Es idempotente: si la cuenta ya existe no la duplica ni le cambia la contraseña.
 * - Todas las cuentas quedan con `debe_cambiar_clave = TRUE`: el primer ingreso obliga
 *   a cambiarla antes de poder usar cualquier otra pantalla.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pool from '../src/db.js';
import { config } from '../src/config.js';
import { generarClaveTemporal } from '../src/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return porDefecto;
}

const RUTA = path.resolve(
  process.cwd(),
  argumento('archivo', path.join(__dirname, '..', '..', 'primer-ingreso', 'usuarios-iniciales.json'))
);

/** Estructura base: una sola cuenta administrativa, tres cuentas por cargo y el cliente. */
function estructuraInicial() {
  return {
    generadoEn: new Date().toISOString(),
    nota: 'Contraseñas temporales. Se cambian obligatoriamente en el primer ingreso. No versionar este archivo.',
    usuarios: [
      {
        nombre: 'Administrador del sistema',
        cargo: 'Administrador',
        username: 'admin',
        correo: 'admin@finanx.local',
        rol: 'ADMIN',
        claveTemporal: generarClaveTemporal(),
      },
      {
        nombre: 'Facturación',
        cargo: 'Facturador',
        username: 'facturacion',
        correo: 'facturacion@finanx.local',
        rol: 'FACTURADOR',
        claveTemporal: generarClaveTemporal(),
      },
      {
        nombre: 'Caja',
        cargo: 'Cajero',
        username: 'caja',
        correo: 'caja@finanx.local',
        rol: 'CAJERO',
        claveTemporal: generarClaveTemporal(),
      },
      {
        nombre: 'Supervisión',
        cargo: 'Supervisor',
        username: 'supervision',
        correo: 'supervision@finanx.local',
        rol: 'SUPERVISOR',
        claveTemporal: generarClaveTemporal(),
      },
      {
        nombre: 'Cliente General',
        cargo: 'Cliente (portal)',
        username: 'cliente',
        correo: 'cliente@finanx.local',
        rol: 'CLIENTE',
        claveTemporal: generarClaveTemporal(),
        cliente: {
          nombreRazonSocial: 'Cliente General',
          tipoCliente: 'EMPRESA',
          tipoIdentificacion: 'NIT',
          numeroIdentificacion: '900000000-0',
          correo: 'cliente@finanx.local',
          telefono: '',
          direccion: '',
          ciudad: '',
        },
      },
    ],
  };
}

function cargarDatos() {
  fs.mkdirSync(path.dirname(RUTA), { recursive: true });
  if (fs.existsSync(RUTA)) {
    const datos = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
    if (!Array.isArray(datos.usuarios) || datos.usuarios.length === 0) {
      throw new Error(`El archivo ${RUTA} no tiene la lista "usuarios" esperada.`);
    }
    return { datos, creado: false };
  }
  const datos = estructuraInicial();
  fs.writeFileSync(RUTA, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
  return { datos, creado: true };
}

async function asegurarRoles() {
  const roles = [
    ['ADMIN', 'Administración del sistema y gestión de usuarios'],
    ['FACTURADOR', 'Gestión de clientes, pedidos y facturas'],
    ['CAJERO', 'Registro y consulta de pagos y saldos'],
    ['SUPERVISOR', 'Consulta de información financiera, historial y reportes'],
  ];
  for (const [nombre, descripcion] of roles) {
    await pool.query(
      `INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) ON CONFLICT (nombre) DO NOTHING`,
      [nombre, descripcion]
    );
  }
}

async function crearClientePortal(c) {
  const existente = await pool.query(
    'SELECT cliente_id FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
    [c.tipoIdentificacion, c.numeroIdentificacion]
  );
  if (existente.rowCount) return existente.rows[0].cliente_id;

  const r = await pool.query(
    `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING cliente_id`,
    [c.tipoCliente || 'EMPRESA', c.tipoIdentificacion, c.numeroIdentificacion, c.nombreRazonSocial,
      c.telefono || null, c.correo || null, c.direccion || null, c.ciudad || null]
  );
  return r.rows[0].cliente_id;
}

async function main() {
  console.log('\n=== FINAN-X · Cuentas iniciales ===\n');

  const { datos, creado } = cargarDatos();
  if (creado) {
    console.log(`Se generó el archivo de cuentas y claves temporales:\n  ${RUTA}\n`);
    console.log('Guárdelo y entréguelo aparte: contiene las claves en texto plano.\n');
  } else {
    console.log(`Usando el archivo existente:\n  ${RUTA}\n`);
  }

  await asegurarRoles();

  const resultados = [];
  for (const u of datos.usuarios) {
    const username = String(u.username || '').toLowerCase();
    const rol = String(u.rol || '').toUpperCase();

    if (rol === 'CLIENTE') {
      const clienteId = await crearClientePortal(u.cliente || {});
      const existe = await pool.query(
        'SELECT usuario_cliente_id FROM usuario_cliente WHERE cliente_id = $1 OR LOWER(username) = $2',
        [clienteId, username]
      );
      if (existe.rowCount) {
        resultados.push({ ...u, username, estado: 'ya existía' });
        continue;
      }
      const hash = await bcrypt.hash(u.claveTemporal, config.bcryptRounds);
      await pool.query(
        `INSERT INTO usuario_cliente (cliente_id, username, password_hash, debe_cambiar_clave)
         VALUES ($1, $2, $3, TRUE)`,
        [clienteId, username, hash]
      );
      resultados.push({ ...u, username, estado: 'creada' });
      continue;
    }

    const existe = await pool.query(
      `SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER($1) OR LOWER(COALESCE(username,'')) = $2`,
      [u.correo, username]
    );
    if (existe.rowCount) {
      resultados.push({ ...u, username, estado: 'ya existía' });
      continue;
    }
    const rolRes = await pool.query('SELECT rol_id FROM roles WHERE nombre = $1', [rol]);
    if (!rolRes.rowCount) {
      resultados.push({ ...u, username, estado: `rol inválido: ${rol}` });
      continue;
    }
    const hash = await bcrypt.hash(u.claveTemporal, config.bcryptRounds);
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, username, password_hash, rol_id, debe_cambiar_clave)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [u.nombre, u.correo, username, hash, rolRes.rows[0].rol_id]
    );
    resultados.push({ ...u, username, estado: 'creada' });
  }

  console.log('| Usuario        | Rol         | Estado     | Correo                    |');
  console.log('|----------------|-------------|------------|---------------------------|');
  for (const r of resultados) {
    console.log(
      `| ${r.username.padEnd(14)} | ${String(r.rol).padEnd(11)} | ${r.estado.padEnd(10)} | ${String(r.correo).padEnd(25)} |`
    );
  }

  const creadas = resultados.filter((r) => r.estado === 'creada');
  if (creadas.length) {
    console.log('\nClaves temporales (se muestran UNA vez; el primer ingreso obliga a cambiarlas):\n');
    for (const r of creadas) {
      console.log(`  ${r.username.padEnd(14)} ${r.claveTemporal}`);
    }
    console.log('\nEntregue estas claves en el acta de usuarios iniciales, nunca por el repositorio.');
  } else {
    console.log('\nNo se creó ninguna cuenta nueva: todas existían.');
  }

  console.log('\n✔ Proceso terminado. Verifique el esquema con: npm run verificar:esquema\n');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Error creando usuarios iniciales:', err.message);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
