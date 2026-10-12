-- ============================================================
-- Migración FINAN-X · Refacturación, pagador del portal y dominios
-- ============================================================
-- Aplica tres cambios que necesitan una base de datos ya existente.
-- Es IDEMPOTENTE: se puede ejecutar varias veces sin efectos secundarios.
--
-- CÓMO APLICARLA:
--   docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_refacturacion_y_dominios.sql
-- ============================================================


-- ============================================================
-- 1) REFACTURACIÓN (C4)
-- ------------------------------------------------------------
-- PROBLEMA: `facturas.pedido_id` era UNIQUE, así que un pedido no podía tener
-- nunca una segunda factura. Al anular una factura, el código devolvía el pedido
-- a CONFIRMADO "para poder refacturarlo", pero al intentarlo se violaba el UNIQUE
-- y el usuario recibía un error 500. La anulación quedaba en un callejón sin salida.
--
-- SOLUCIÓN: se cambia la regla a "como mucho UNA factura ACTIVA por pedido",
-- que es lo que hace cualquier sistema de facturación real: la factura anulada
-- se conserva en el historial (no se borra nada) y se puede emitir una nueva.
-- Se aplica con un índice único PARCIAL, que la base de datos respeta por sí sola.
-- ============================================================

-- Se quita la restricción de unicidad sobre pedido_id (una sola vez).
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_pedido_id_key;

-- Un índice único parcial permite VARIAS filas con el mismo pedido_id siempre que
-- no sean ACTIVA, pero como mucho UNA activa. Si el código fallara, la base de
-- datos sigue impidiendo dos facturas activas para el mismo pedido.
CREATE UNIQUE INDEX IF NOT EXISTS uq_factura_activa_por_pedido
  ON facturas (pedido_id)
  WHERE estado = 'ACTIVA';

-- Índice de apoyo para la consulta "¿tiene este pedido una factura ACTUAL?"
CREATE INDEX IF NOT EXISTS idx_facturas_pedido ON facturas (pedido_id);


-- ============================================================
-- 2) PAGADOR DEL PORTAL (M12)
-- ------------------------------------------------------------
-- PROBLEMA: `pagos.usuario_id` apunta a `usuarios` (personal interno). Un pago
-- hecho por el cliente desde el portal se guardaba con usuario_id NULL: el
-- esquema no podía representar quién pagó, y la trazabilidad dependía de la
-- tabla `auditoria` (texto libre).
--
-- SOLUCIÓN: se añade `usuario_cliente_id` (FK a usuario_cliente). Ahora:
--   - pago registrado por el personal  -> usuario_id          (y usuario_cliente_id NULL)
--   - pago hecho desde el portal        -> usuario_cliente_id  (y usuario_id NULL)
-- Ambos se conservan porque son dos tipos de actor distintos.
-- Los pagos anteriores quedan con NULL; se pueden rellenar desde `auditoria`.
-- ============================================================

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS usuario_cliente_id INT REFERENCES usuario_cliente(usuario_cliente_id);

CREATE INDEX IF NOT EXISTS idx_pagos_usuario_cliente ON pagos (usuario_cliente_id);


-- ============================================================
-- 3) DOMINIOS VÁLIDOS EN LAS COLUMNAS DE ESTADO
-- ------------------------------------------------------------
-- PROBLEMA: los valores válidos de `estado` (y de metodo_pago / usuario_tipo)
-- solo existían en comentarios SQL y en la lógica de la aplicación. La columna
-- era TEXT sin ninguna restricción, así que un error de programación o una
-- llamada directa a la API podían dejar una fila con un estado que el sistema
-- no sabe interpretar (y que rompe los filtros y los informes).
--
-- SOLUCIÓN: restricciones CHECK. Se eliminan primero por si la migración se
-- re-ejecuta (ADD CONSTRAINT no tiene IF NOT EXISTS).
-- ============================================================

ALTER TABLE usuarios        DROP CONSTRAINT IF EXISTS ck_usuarios_estado;
ALTER TABLE clientes        DROP CONSTRAINT IF EXISTS ck_clientes_estado;
ALTER TABLE productos       DROP CONSTRAINT IF EXISTS ck_productos_estado;
ALTER TABLE pedidos         DROP CONSTRAINT IF EXISTS ck_pedidos_estado;
ALTER TABLE facturas        DROP CONSTRAINT IF EXISTS ck_facturas_estado;
ALTER TABLE notas_credito   DROP CONSTRAINT IF EXISTS ck_notas_credito_estado;
ALTER TABLE usuario_cliente DROP CONSTRAINT IF EXISTS ck_usuario_cliente_estado;
ALTER TABLE pagos           DROP CONSTRAINT IF EXISTS ck_pagos_metodo;
ALTER TABLE auditoria       DROP CONSTRAINT IF EXISTS ck_auditoria_usuario_tipo;

ALTER TABLE usuarios        ADD CONSTRAINT ck_usuarios_estado        CHECK (estado IN ('ACTIVO', 'INACTIVO'));
ALTER TABLE clientes        ADD CONSTRAINT ck_clientes_estado        CHECK (estado IN ('ACTIVO', 'INACTIVO'));
ALTER TABLE productos       ADD CONSTRAINT ck_productos_estado       CHECK (estado IN ('ACTIVO', 'INACTIVO'));
ALTER TABLE usuario_cliente ADD CONSTRAINT ck_usuario_cliente_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'));
ALTER TABLE pedidos         ADD CONSTRAINT ck_pedidos_estado         CHECK (estado IN ('BORRADOR', 'CONFIRMADO', 'CANCELADO', 'FACTURADO'));
ALTER TABLE facturas        ADD CONSTRAINT ck_facturas_estado        CHECK (estado IN ('ACTIVA', 'ANULADA'));
ALTER TABLE notas_credito   ADD CONSTRAINT ck_notas_credito_estado   CHECK (estado IN ('ACTIVA', 'ANULADA'));
ALTER TABLE pagos           ADD CONSTRAINT ck_pagos_metodo           CHECK (metodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE'));
ALTER TABLE auditoria       ADD CONSTRAINT ck_auditoria_usuario_tipo CHECK (usuario_tipo IN ('INTERNO', 'CLIENTE'));
