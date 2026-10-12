import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2, validarDatosPago, idNumerico, METODOS_PAGO } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Pagos';

// GET /api/pagos?q=&facturaId=&clienteId=&desde=&hasta=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', facturaId = '', clienteId = '', desde = '', hasta = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(pg.numero_pago ILIKE $${params.length} OR f.numero_factura ILIKE $${params.length} OR pg.referencia ILIKE $${params.length})`);
    }
    if (facturaId) { params.push(facturaId); conds.push(`pg.factura_id = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`f.cliente_id = $${params.length}`); }
    if (desde) { params.push(desde); conds.push(`pg.fecha >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`pg.fecha <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT pg.pago_id, pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.referencia, pg.observaciones,
              pg.banco, pg.titular, pg.tipo_tarjeta, pg.ultimos_digitos_tarjeta, pg.vencimiento_tarjeta, pg.numero_cuenta,
              f.factura_id, f.numero_factura, c.cliente_id, c.nombre_razon_social
       FROM pagos pg
       JOIN facturas f ON f.factura_id = pg.factura_id
       JOIN clientes c ON c.cliente_id = f.cliente_id
       ${where} ORDER BY pg.pago_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/pagos — { facturaId, valor, metodoPago, referencia, observaciones }
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { facturaId, valor, metodoPago = 'EFECTIVO', referencia = '', observaciones = '' } = req.body || {};

    await client.query('BEGIN');

    if (!facturaId || !(Number(valor) > 0)) throw new HttpError(400, 'Factura y valor (mayor que cero) son obligatorios');
    // Un facturaId no numérico llegaba a PostgreSQL y provocaba un error de tipo (500).
    const facturaIdNum = idNumerico(facturaId, 'id de factura');

    // FOR UPDATE: bloquea la fila de la factura durante la transacción.
    //
    // Sin este bloqueo, dos pagos simultáneos sobre la misma factura podían leer el MISMO
    // saldo, pasar los dos la validación `valor <= saldo` e insertarse ambos: el cliente
    // acababa pagando más de lo que debía. Pasa con dos cajeros en paralelo, o con el
    // cliente pagando desde el portal justo cuando el cajero registra el pago.
    // Con el bloqueo, el segundo espera a que el primero confirme y vuelve a leer el saldo.
    const f = await client.query(
      `SELECT f.factura_id, f.numero_factura, f.estado,
              v.saldo::float8 AS saldo
       FROM facturas f
       JOIN factura_saldo v ON v.factura_id = f.factura_id
       WHERE f.factura_id = $1
       FOR UPDATE OF f`,
      [facturaIdNum]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se pueden registrar pagos en facturas activas');

    // El saldo se toma de la vista factura_saldo (total - pagos + notas de crédito
    // activas). Calcularlo como total - pagos ignoraría las notas de crédito y
    // permitiría registrar un pago superior al saldo real.
    const saldo = round2(Number(f.rows[0].saldo));
    const valorNum = round2(Number(valor));
    if (valorNum > saldo) throw new HttpError(400, `El valor supera el saldo pendiente ($ ${saldo.toLocaleString('en-US')})`);

    // Datos requeridos según el método de pago (tarjeta/transferencia/cheque); nunca se guardan CVV ni número completo.
    // `metodo_pago` no tenía lista blanca ni en la aplicación ni en la base (la columna es TEXT
    // sin CHECK), así que se aceptaba cualquier cadena; esos pagos luego no aparecían en los
    // informes, que solo cuentan EFECTIVO / TRANSFERENCIA / TARJETA / CHEQUE.
    const metodo = String(metodoPago).toUpperCase();
    if (!METODOS_PAGO.includes(metodo)) {
      throw new HttpError(400, `Método de pago inválido. Use uno de: ${METODOS_PAGO.join(', ')}`);
    }
    const datosPago = validarDatosPago(metodo, req.body);

    const ins = await client.query(
      `INSERT INTO pagos (factura_id, valor, metodo_pago, referencia, observaciones, usuario_id,
                          banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta, numero_cuenta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING pago_id`,
      [facturaIdNum, valorNum, metodoPago, referencia || null, observaciones || null, req.user.usuarioId ?? null,
        datosPago.banco || null, datosPago.titular || null, datosPago.tipo_tarjeta || null,
        datosPago.ultimos_digitos_tarjeta || null, datosPago.vencimiento_tarjeta || null, datosPago.numero_cuenta || null]
    );
    const pagoId = ins.rows[0].pago_id;
    const numero = `PAG-${String(pagoId).padStart(6, '0')}`;
    await client.query('UPDATE pagos SET numero_pago = $1 WHERE pago_id = $2', [numero, pagoId]);

    // El saldo ya incluye las notas de crédito, así que el nuevo saldo es
    // simplemente el saldo anterior menos el valor del pago.
    const nuevoSaldo = round2(saldo - valorNum);
    const estadoPago = nuevoSaldo <= 0 ? 'PAGADA' : 'PAGO_PARCIAL';

    // La auditoría entra en la MISMA transacción (antes iba después del COMMIT y al pool,
    // así que un fallo al auditar dejaba el pago registrado sin traza).
    await audit({
      client,
      usuario: req.user.correo, modulo: MODULO, operacion: 'REGISTRAR', registro: numero,
      descripcion: `Pago de $${valorNum} en ${f.rows[0].numero_factura} (${metodoPago}) · saldo $${nuevoSaldo}`,
    });

    await client.query('COMMIT');
    res.status(201).json({ pago_id: pagoId, numero_pago: numero, valor: valorNum, saldo: nuevoSaldo, estado_pago: estadoPago });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

export default router;