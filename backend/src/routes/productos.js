import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, idNumerico } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Productos';

// GET /api/productos?q=&estado=&categoria=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', categoria = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(p.nombre ILIKE $${params.length} OR p.codigo ILIKE $${params.length} OR p.descripcion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`p.estado = $${params.length}`); }
    if (categoria) { params.push(categoria); conds.push(`p.categoria ILIKE $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await pool.query(
      `SELECT p.producto_id, p.codigo, p.nombre, p.descripcion, p.categoria, p.precio::float8, p.impuesto::float8,
              p.unidad_medida, p.estado, p.fecha_creacion
       FROM productos p ${where} ORDER BY p.producto_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/productos  — código único
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const { codigo, nombre, descripcion, categoria, precio, impuesto = 0, unidadMedida = 'UND' } = b;
    if (!codigo || !nombre) throw new HttpError(400, 'Código y nombre son obligatorios');
    if (!(Number(precio) >= 0)) throw new HttpError(400, 'El precio no puede ser negativo');
    const impuestoNum = Number(impuesto);
    if (!(impuestoNum >= 0 && impuestoNum <= 100)) throw new HttpError(400, 'El impuesto debe estar entre 0 y 100');

    const dup = await pool.query('SELECT 1 FROM productos WHERE codigo = $1', [codigo]);
    if (dup.rowCount) throw new HttpError(409, 'Ya existe un producto con ese código');

    const r = await pool.query(
      `INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, impuesto, unidad_medida)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING producto_id`,
      [codigo, nombre, descripcion || null, categoria || null, precio, impuestoNum, unidadMedida]
    );
    await audit({ req, usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: r.rows[0].producto_id, descripcion: `Producto ${nombre} (${codigo}) a $${precio}` });
    res.status(201).json({ producto_id: r.rows[0].producto_id });
  } catch (e) { next(e); }
});

// PUT /api/productos/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = idNumerico(req.params.id, 'id');
    const b = req.body || {};

    // Validaciones que el POST sí tenía y el PUT no: sin ellas, un precio negativo o un
    // impuesto fuera de rango los rechazaba el CHECK de la base de datos y el usuario
    // recibía un 500 en lugar de un 400 que diga qué campo está mal.
    if (!b.nombre || !String(b.nombre).trim()) throw new HttpError(400, 'El nombre es obligatorio');
    if (!(Number(b.precio) >= 0)) throw new HttpError(400, 'El precio no puede ser negativo');
    const impuesto = Number(b.impuesto ?? 0);
    if (!(impuesto >= 0 && impuesto <= 100)) throw new HttpError(400, 'El impuesto debe estar entre 0 y 100');

    const exists = await pool.query('SELECT 1 FROM productos WHERE producto_id = $1', [id]);
    if (!exists.rowCount) throw new HttpError(404, 'Producto no encontrado');
    await pool.query(
      `UPDATE productos SET nombre = $1, descripcion = $2, categoria = $3, precio = $4, impuesto = $5, unidad_medida = $6, fecha_actualizacion = NOW()
       WHERE producto_id = $7`,
      [b.nombre, b.descripcion || null, b.categoria || null, b.precio, impuesto, b.unidadMedida, id]
    );
    await audit({ req, usuario: req.user.correo, modulo: MODULO, operacion: 'ACTUALIZAR', registro: id, descripcion: `Actualización del producto ${b.nombre}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /api/productos/:id/estado  — baja lógica, conserva historial
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = idNumerico(req.params.id, 'id');
    const { estado } = req.body || {};
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) throw new HttpError(400, 'Estado inválido');
    const r = await pool.query('UPDATE productos SET estado = $1, fecha_actualizacion = NOW() WHERE producto_id = $2 RETURNING nombre', [estado, id]);
    if (!r.rowCount) throw new HttpError(404, 'Producto no encontrado');
    await audit({ req, usuario: req.user.correo, modulo: MODULO, operacion: 'ESTADO', registro: id, descripcion: `Producto ${r.rows[0].nombre} → ${estado}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;