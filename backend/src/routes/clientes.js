import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Clientes';

// GET /api/clientes?q=&estado=&tipo=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', tipo = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length} OR c.correo ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`c.estado = $${params.length}`); }
    if (tipo) { params.push(tipo); conds.push(`c.tipo_cliente = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await pool.query(
      `SELECT c.cliente_id, c.tipo_cliente, c.tipo_identificacion, c.numero_identificacion,
              c.nombre_razon_social, c.telefono, c.correo, c.direccion, c.ciudad, c.estado, c.fecha_creacion,
              (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = c.cliente_id)::int AS total_pedidos,
              (SELECT COALESCE(SUM(f.total - COALESCE((SELECT SUM(pg.valor) FROM pagos pg WHERE pg.factura_id = f.factura_id), 0)), 0)::float8
               FROM facturas f WHERE f.cliente_id = c.cliente_id AND f.estado = 'ACTIVA') AS saldo_pendiente,
              (SELECT COUNT(*) FROM usuario_cliente uc WHERE uc.cliente_id = c.cliente_id)::int AS tiene_cuenta
       FROM clientes c ${where}
       ORDER BY c.cliente_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await pool.query(
      `SELECT c.*,
              (SELECT COALESCE(SUM(f.total - COALESCE((SELECT SUM(pg.valor) FROM pagos pg WHERE pg.factura_id = f.factura_id), 0)), 0)::float8
               FROM facturas f WHERE f.cliente_id = c.cliente_id AND f.estado = 'ACTIVA') AS saldo_pendiente
       FROM clientes c WHERE c.cliente_id = $1`,
      [id]
    );
    if (!rows.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/clientes  — valida duplicados (regla de negocio)
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const { tipoCliente = 'PERSONA', tipoIdentificacion = 'CC', numeroIdentificacion, nombreRazonSocial, telefono, correo, direccion, ciudad } = b;
    if (!numeroIdentificacion || !nombreRazonSocial) throw new HttpError(400, 'Número de identificación y nombre son obligatorios');

    const dup = await pool.query(
      'SELECT 1 FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
      [tipoIdentificacion, numeroIdentificacion]
    );
    if (dup.rowCount) throw new HttpError(409, 'Ya existe un cliente con esa identificación');

    const r = await pool.query(
      `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING cliente_id`,
      [tipoCliente, tipoIdentificacion, numeroIdentificacion, nombreRazonSocial, telefono || null, correo || null, direccion || null, ciudad || null]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: r.rows[0].cliente_id, descripcion: `Cliente ${nombreRazonSocial} (${tipoIdentificacion} ${numeroIdentificacion})` });
    res.status(201).json({ cliente_id: r.rows[0].cliente_id });
  } catch (e) { next(e); }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const exists = await pool.query('SELECT nombre_razon_social FROM clientes WHERE cliente_id = $1', [id]);
    if (!exists.rowCount) throw new HttpError(404, 'Cliente no encontrado');

    await pool.query(
      `UPDATE clientes SET tipo_cliente = $1, tipo_identificacion = $2, numero_identificacion = $3,
              nombre_razon_social = $4, telefono = $5, correo = $6, direccion = $7, ciudad = $8
       WHERE cliente_id = $9`,
      [b.tipoCliente, b.tipoIdentificacion, b.numeroIdentificacion, b.nombreRazonSocial, b.telefono || null, b.correo || null, b.direccion || null, b.ciudad || null, id]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ACTUALIZAR', registro: id, descripcion: `Actualización de cliente ${b.nombreRazonSocial}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /api/clientes/:id/estado
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) throw new HttpError(400, 'Estado inválido');
    const r = await pool.query('UPDATE clientes SET estado = $1 WHERE cliente_id = $2 RETURNING nombre_razon_social', [estado, id]);
    if (!r.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ESTADO', registro: id, descripcion: `Cliente ${r.rows[0].nombre_razon_social} → ${estado}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/clientes/:id/cuenta  — crea cuenta de acceso del cliente
router.post('/:id/cuenta', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { username, password } = req.body || {};
    if (!username || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');

    const cli = await pool.query('SELECT nombre_razon_social, estado FROM clientes WHERE cliente_id = $1', [id]);
    if (!cli.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    if (cli.rows[0].estado !== 'ACTIVO') throw new HttpError(400, 'El cliente debe estar activo');

    const cuenta = await pool.query('SELECT 1 FROM usuario_cliente WHERE cliente_id = $1', [id]);
    if (cuenta.rowCount) throw new HttpError(409, 'El cliente ya tiene una cuenta de acceso');

    const userDup = await pool.query('SELECT 1 FROM usuario_cliente WHERE LOWER(username) = LOWER($1)', [username]);
    if (userDup.rowCount) throw new HttpError(409, 'Ese nombre de usuario ya está en uso');

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuario_cliente (cliente_id, username, password_hash) VALUES ($1, $2, $3)',
      [id, username, hash]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'CUENTA', registro: id, descripcion: `Cuenta de acceso creada para ${cli.rows[0].nombre_razon_social} (${username})` });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/clientes/:id/resumen-correo — texto del estado financiero para enviar por correo
router.get('/:id/resumen-correo', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cli = await pool.query(
      `SELECT c.cliente_id, c.tipo_identificacion, c.numero_identificacion, c.nombre_razon_social,
              c.correo, c.telefono, c.ciudad, c.estado
       FROM clientes c WHERE c.cliente_id = $1`,
      [id]
    );
    if (!cli.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    const c = cli.rows[0];

    const facturas = await pool.query(
      `SELECT v.numero_factura, v.fecha_emision, v.fecha_vencimiento, v.total::float8,
              v.valor_pagado::float8, v.saldo::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 AND v.estado = 'ACTIVA'
       ORDER BY v.fecha_emision DESC LIMIT 50`,
      [id]
    );
    const notas = await pool.query(
      `SELECT numero_nota, fecha, valor::float8, motivo FROM notas_credito
       WHERE cliente_id = $1 AND estado = 'ACTIVA' ORDER BY fecha DESC`,
      [id]
    );

    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0));
    const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const saldoPend = facturas.rows.reduce((s, f) => s + Number(f.saldo), 0);
    const pagado = facturas.rows.reduce((s, f) => s + Number(f.valor_pagado), 0);

    const lineas = [];
    lineas.push(`Estimado(a) ${c.nombre_razon_social}:`);
    lineas.push('');
    lineas.push(`Su estado financiero al ${fecha} en FINAN-X es el siguiente:`);
    lineas.push('');
    lineas.push('FACTURAS ACTIVAS');
    lineas.push('────────────────');
    if (!facturas.rows.length) {
      lineas.push('  No tiene facturas activas en este momento.');
    } else {
      for (const f of facturas.rows) {
        lineas.push(`• ${f.numero_factura} · emitida ${f.fecha_emision.toISOString().slice(0, 10)} · total ${fmt(f.total)} · pagado ${fmt(f.valor_pagado)} · saldo ${fmt(f.saldo)} · ${f.estado_pago}`);
      }
    }
    lineas.push('');
    lineas.push(`SALDO TOTAL PENDIENTE: ${fmt(saldoPend)}`);
    lineas.push(`TOTAL PAGADO: ${fmt(pagado)}`);
    if (notas.rows.length) {
      lineas.push('');
      lineas.push('NOTAS DE CRÉDITO ACTIVAS');
      lineas.push('────────────────────────');
      for (const n of notas.rows) {
        lineas.push(`• ${n.numero_nota} · ${n.fecha.toISOString().slice(0, 10)} · ${fmt(n.valor)} · ${n.motivo}`);
      }
    }
    lineas.push('');
    lineas.push('Puede consultar sus facturas, pagos y saldos en el portal de clientes FINAN-X o contactando nuestra oficina.');
    lineas.push('');
    lineas.push('Atentamente,');
    lineas.push('Equipo FINAN-X');

    res.json({
      destinatario: c.correo || null,
      asunto: `Su estado financiero en FINAN-X · ${fecha}`,
      cuerpo: lineas.join('\n'),
      cliente: { cliente_id: c.cliente_id, nombre_razon_social: c.nombre_razon_social, correo: c.correo },
    });
  } catch (e) { next(e); }
});

export default router;