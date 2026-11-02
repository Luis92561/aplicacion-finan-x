import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { HttpError } from '../utils.js';

const router = Router();

// El panel de inicio lo usan los cuatro roles internos. El contenido que recibe cada
// uno se decide en el servidor: el CAJERO no debe ver la cartera global ni el top de
// clientes, porque su función es operar caja, no analizar la situación financiera.
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const ROLES_ANALITICOS = new Set(['ADMIN', 'FACTURADOR', 'SUPERVISOR']);

// ---------------------------------------------------------------------------
// GET /api/dashboard?meses=12
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const crudo = Number(req.query.meses ?? 12);
    const meses = Number.isInteger(crudo) ? crudo : 12;
    if (meses < 3 || meses > 24) throw new HttpError(400, 'El parámetro meses debe estar entre 3 y 24');

    const analitico = ROLES_ANALITICOS.has(req.user.rol);

    if (!analitico) {
      // CAJERO: su operación del día, sin cifras globales de la empresa.
      const [caja, metodos, tabla] = await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(valor), 0)::float8 AS pagos_hoy,
                  COUNT(*)::int                    AS cantidad_pagos_hoy,
                  COALESCE(SUM(valor) FILTER (WHERE fecha >= date_trunc('month', NOW())), 0)::float8 AS pagos_mes
             FROM pagos
            WHERE fecha >= CURRENT_DATE`
        ),
        pool.query(
          `SELECT metodo_pago AS metodo,
                  COALESCE(SUM(valor), 0)::float8 AS total,
                  COUNT(*)::int                   AS cantidad
             FROM pagos
            WHERE fecha >= date_trunc('month', NOW())
            GROUP BY metodo_pago
            ORDER BY total DESC`
        ),
        pool.query(
          `SELECT p.pago_id, p.numero_pago, p.fecha, f.numero_factura,
                  c.nombre_razon_social AS cliente, p.valor::float8, p.metodo_pago
             FROM pagos p
             JOIN facturas f ON f.factura_id = p.factura_id
             JOIN clientes c ON c.cliente_id = f.cliente_id
            WHERE p.fecha >= CURRENT_DATE
            ORDER BY p.fecha DESC
            LIMIT 50`
        ),
      ]);

      return res.json({
        rol: req.user.rol,
        generadoEn: new Date().toISOString(),
        kpis: caja.rows[0],
        metodos: metodos.rows,
        tabla: { tipo: 'pagos', filas: tabla.rows },
      });
    }

    const [kpis, serie, metodos, top, tabla] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COALESCE(SUM(total), 0)::float8 FROM facturas
             WHERE estado = 'ACTIVA' AND fecha_emision >= date_trunc('month', NOW()))            AS facturado_mes,
           (SELECT COALESCE(SUM(total), 0)::float8 FROM facturas
             WHERE estado = 'ACTIVA'
               AND fecha_emision >= date_trunc('month', NOW()) - interval '1 month'
               AND fecha_emision <  date_trunc('month', NOW()))                                 AS facturado_mes_anterior,
           (SELECT COALESCE(SUM(valor), 0)::float8 FROM pagos
             WHERE fecha >= date_trunc('month', NOW()))                                          AS recaudado_mes,
           (SELECT COALESCE(SUM(saldo), 0)::float8 FROM factura_saldo
             WHERE estado = 'ACTIVA')                                                            AS cartera,
           (SELECT COUNT(*)::int FROM factura_saldo
             WHERE estado = 'ACTIVA' AND saldo > 0)                                              AS facturas_pendientes,
           (SELECT COALESCE(SUM(valor), 0)::float8 FROM pagos
             WHERE fecha >= CURRENT_DATE)                                                        AS pagos_hoy`
      ),
      pool.query(
        `WITH meses AS (
           SELECT generate_series(
             date_trunc('month', NOW()) - make_interval(months => $1::int - 1),
             date_trunc('month', NOW()),
             interval '1 month'
           ) AS mes
         )
         SELECT to_char(m.mes, 'YYYY-MM') AS mes,
                COALESCE((SELECT SUM(f.total) FROM facturas f
                           WHERE f.estado = 'ACTIVA'
                             AND date_trunc('month', f.fecha_emision) = m.mes), 0)::float8 AS facturado,
                COALESCE((SELECT SUM(p.valor) FROM pagos p
                           WHERE date_trunc('month', p.fecha) = m.mes), 0)::float8 AS recaudado
           FROM meses m
          ORDER BY m.mes`,
        [meses]
      ),
      pool.query(
        `SELECT metodo_pago AS metodo,
                COALESCE(SUM(valor), 0)::float8 AS total,
                COUNT(*)::int                   AS cantidad
           FROM pagos
          WHERE fecha >= date_trunc('month', NOW()) - make_interval(months => $1::int - 1)
          GROUP BY metodo_pago
          ORDER BY total DESC`,
        [meses]
      ),
      pool.query(
        `SELECT c.cliente_id, c.nombre_razon_social AS nombre,
                COALESCE(SUM(v.saldo), 0)::float8 AS saldo
           FROM clientes c
           JOIN factura_saldo v ON v.cliente_id = c.cliente_id AND v.estado = 'ACTIVA'
          GROUP BY c.cliente_id, c.nombre_razon_social
         HAVING SUM(v.saldo) > 0
          ORDER BY saldo DESC
          LIMIT 5`
      ),
      pool.query(
        `SELECT v.factura_id, v.numero_factura, v.fecha_emision,
                c.nombre_razon_social AS cliente,
                v.total::float8, v.saldo::float8, v.estado_pago
           FROM factura_saldo v
           JOIN clientes c ON c.cliente_id = v.cliente_id
          WHERE v.estado = 'ACTIVA' AND v.saldo > 0
          ORDER BY v.fecha_emision DESC
          LIMIT 50`
      ),
    ]);

    const k = kpis.rows[0];
    const anterior = Number(k.facturado_mes_anterior) || 0;
    const actual = Number(k.facturado_mes) || 0;
    const variacion = anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null;

    res.json({
      rol: req.user.rol,
      generadoEn: new Date().toISOString(),
      kpis: { ...k, variacion },
      serie: serie.rows,
      metodos: metodos.rows,
      topClientes: top.rows,
      tabla: { tipo: 'facturas', filas: tabla.rows },
    });
  } catch (e) { next(e); }
});

export default router;
