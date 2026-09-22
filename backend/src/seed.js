import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './db.js';

async function waitForDb() {
  for (let i = 0; i < 30; i += 1) {
    try {
      await pool.query('SELECT 1');
      console.log('✔ Conexión a PostgreSQL establecida');
      return;
    } catch (err) {
      console.log(`⏳ Esperando base de datos (${i + 1}/30)...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('No se pudo conectar a PostgreSQL. ¿Está corriendo `docker compose up -d db`?');
}

async function seed() {
  await waitForDb();

  const roles = [
    ['ADMIN', 'Administración del sistema y gestión de usuarios'],
    ['FACTURADOR', 'Gestión de clientes, pedidos y facturas'],
    ['CAJERO', 'Registro y consulta de pagos y saldos'],
    ['SUPERVISOR', 'Consulta de información financiera, historial y reportes'],
  ];
  for (const [nombre, descripcion] of roles) {
    await pool.query(
      `INSERT INTO roles (nombre, descripcion) VALUES ($1, $2)
       ON CONFLICT (nombre) DO NOTHING`,
      [nombre, descripcion]
    );
  }
  console.log('✔ Roles listos');

  const usuarios = [
    { nombre: 'Administrador', correo: 'admin@finanx.test', rol: 'ADMIN', password: 'admin123' },
    { nombre: 'Facturador', correo: 'facturador@finanx.test', rol: 'FACTURADOR', password: 'facturador123' },
    { nombre: 'Cajero', correo: 'cajero@finanx.test', rol: 'CAJERO', password: 'cajero123' },
    { nombre: 'Supervisor', correo: 'supervisor@finanx.test', rol: 'SUPERVISOR', password: 'supervisor123' },
  ];
  for (const u of usuarios) {
    const exists = await pool.query('SELECT 1 FROM usuarios WHERE correo = $1', [u.correo]);
    if (exists.rowCount) continue;
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol_id)
       SELECT $1, $2, $3, rol_id FROM roles WHERE nombre = $4`,
      [u.nombre, u.correo, hash, u.rol]
    );
  }
  console.log('✔ Usuarios internos listos');

  const clientes = [
    {
      tipoCliente: 'PERSONA', tipoIdentificacion: 'CC', numeroIdentificacion: '1002003001',
      nombreRazonSocial: 'María Fernanda López', telefono: '3115550101',
      correo: 'maria.lopez@example.com', direccion: 'Calle 10 # 5-20', ciudad: 'Bogotá',
    },
    {
      tipoCliente: 'EMPRESA', tipoIdentificacion: 'NIT', numeroIdentificacion: '901234567',
      nombreRazonSocial: 'TecnoAndina S.A.S.', telefono: '6015558899',
      correo: 'ventas@tecnoandina.co', direccion: 'Av. 68 # 80-10', ciudad: 'Medellín',
    },
  ];
  for (const c of clientes) {
    const exists = await pool.query(
      'SELECT 1 FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
      [c.tipoIdentificacion, c.numeroIdentificacion]
    );
    if (exists.rowCount) continue;
    await pool.query(
      `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [c.tipoCliente, c.tipoIdentificacion, c.numeroIdentificacion, c.nombreRazonSocial, c.telefono, c.correo, c.direccion, c.ciudad]
    );
  }
  console.log('✔ Clientes listos');

  // Cuenta de acceso del cliente 1 (portal)
  const cli = await pool.query(
    `SELECT cliente_id FROM clientes WHERE numero_identificacion = '1002003001' ORDER BY cliente_id LIMIT 1`
  );
  if (cli.rowCount) {
    const cid = cli.rows[0].cliente_id;
    const exists = await pool.query('SELECT 1 FROM usuario_cliente WHERE cliente_id = $1', [cid]);
    if (!exists.rowCount) {
      const hash = await bcrypt.hash('cliente123', 10);
      await pool.query(
        `INSERT INTO usuario_cliente (cliente_id, username, password_hash) VALUES ($1, $2, $3)`,
        [cid, 'cliente@finanx.test', hash]
      );
      console.log('✔ Cuenta de cliente creada (cliente@finanx.test / cliente123)');
    }
  }

  const productos = [
    { codigo: 'PROD-001', nombre: 'Laptop 15" 16GB', descripcion: 'Portátil con SSD 512GB', categoria: 'Cómputo', precio: 4500000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-002', nombre: 'Mouse inalámbrico', descripcion: 'Mouse óptico 2.4GHz', categoria: 'Accesorios', precio: 120000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-003', nombre: 'Teclado mecánico', descripcion: 'Teclado RGB español', categoria: 'Accesorios', precio: 280000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-004', nombre: 'Monitor 27" 4K', descripcion: 'Monitor IPS 60Hz', categoria: 'Cómputo', precio: 2100000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-005', nombre: 'Servicio de soporte', descripcion: 'Hora técnica especializada', categoria: 'Servicios', precio: 150000, impuesto: 0, unidadMedida: 'HORA' },
  ];
  for (const p of productos) {
    await pool.query(
      `INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, impuesto, unidad_medida)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (codigo) DO NOTHING`,
      [p.codigo, p.nombre, p.descripcion, p.categoria, p.precio, p.impuesto, p.unidadMedida]
    );
  }
  console.log('✔ Productos listos');

  await pool.end();
  console.log('\nSeed completado. Credenciales demo:');
  console.log('  admin@finanx.test / admin123        (Administrador)');
  console.log('  facturador@finanx.test / facturador123');
  console.log('  cajero@finanx.test / cajero123');
  console.log('  supervisor@finanx.test / supervisor123');
  console.log('  cliente@finanx.test / cliente123    (Portal del cliente)');
}

seed().catch((err) => {
  console.error('Error en el seed:', err.message);
  process.exit(1);
});