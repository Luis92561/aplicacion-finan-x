-- Migración FINAN-X: notas de crédito (devoluciones) + vista de saldo actualizada
CREATE TABLE IF NOT EXISTS notas_credito (
  nota_credito_id   SERIAL PRIMARY KEY,
  numero_nota       VARCHAR(20) UNIQUE,
  factura_id        INT NOT NULL REFERENCES facturas(factura_id),
  cliente_id        INT NOT NULL REFERENCES clientes(cliente_id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor             NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  motivo            TEXT NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',  -- ACTIVA / ANULADA
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id        INT REFERENCES usuarios(usuario_id),
  fecha_anulacion   TIMESTAMPTZ,
  usuario_anulacion INT REFERENCES usuarios(usuario_id),
  motivo_anulacion  TEXT
);
CREATE INDEX IF NOT EXISTS idx_notas_credito_factura ON notas_credito(factura_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_cliente  ON notas_credito(cliente_id);

-- Vista de saldo: las notas de crédito activas aumentan el saldo (reversan pagos).
-- La nueva columna notas_credito se agrega al FINAL para mantener compatibilidad
-- con CREATE OR REPLACE VIEW sobre la vista existente.
CREATE OR REPLACE VIEW factura_saldo AS
SELECT
  f.factura_id,
  f.numero_factura,
  f.pedido_id,
  f.cliente_id,
  f.fecha_emision,
  f.fecha_vencimiento,
  f.subtotal::float8   AS subtotal,
  f.impuestos::float8  AS impuestos,
  f.total::float8      AS total,
  COALESCE(SUM(p.valor), 0)::float8 AS valor_pagado,
  (f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0))::float8 AS saldo,
  f.estado,
  CASE
    WHEN f.estado = 'ANULADA'                                          THEN 'ANULADA'
    WHEN COALESCE(SUM(p.valor), 0) - COALESCE(SUM(nc.valor), 0) <= 0   THEN 'PENDIENTE'
    WHEN f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0) <= 0 THEN 'PAGADA'
    ELSE 'PAGO_PARCIAL'
  END AS estado_pago,
  f.motivo_anulacion,
  f.fecha_anulacion,
  COALESCE(SUM(nc.valor), 0)::float8 AS notas_credito
FROM facturas f
LEFT JOIN pagos p ON p.factura_id = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA'
GROUP BY f.factura_id;