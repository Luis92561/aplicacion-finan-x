-- ============================================================
-- Prueba del fan-out en la vista factura_saldo
-- Se ejecuta dentro de un DO block con subtransacción y ROLLBACK:
-- NO deja datos en la base.
-- ============================================================
DO $$
DECLARE
  v_cliente INT;
  v_pedido  INT;
  v_factura INT;
  v_pagado  NUMERIC;
  v_notas   NUMERIC;
  v_saldo   NUMERIC;
  v_estado  TEXT;
  v_total   NUMERIC := 100;
BEGIN
  -- ---------- Caso A: 2 pagos (50+50) y 1 nota (30) ----------
  INSERT INTO clientes (nombre_razon_social, numero_identificacion, tipo_identificacion)
    VALUES ('TEST FANOUT A', 'ZZTESTA01', 'CC') RETURNING cliente_id INTO v_cliente;
  INSERT INTO pedidos (cliente_id, subtotal, impuestos, total)
    VALUES (v_cliente, v_total, 0, v_total) RETURNING pedido_id INTO v_pedido;
  INSERT INTO facturas (pedido_id, cliente_id, subtotal, impuestos, total)
    VALUES (v_pedido, v_cliente, v_total, 0, v_total) RETURNING factura_id INTO v_factura;

  INSERT INTO pagos (factura_id, valor, metodo_pago) VALUES (v_factura, 50, 'EFECTIVO');
  INSERT INTO pagos (factura_id, valor, metodo_pago) VALUES (v_factura, 50, 'EFECTIVO');
  INSERT INTO notas_credito (factura_id, cliente_id, valor, motivo)
    VALUES (v_factura, v_cliente, 30, 'devolucion parcial');

  SELECT valor_pagado, notas_credito, saldo, estado_pago
    INTO v_pagado, v_notas, v_saldo, v_estado
    FROM factura_saldo WHERE factura_id = v_factura;

  RAISE NOTICE '--- CASO A: factura 100 | pagos 50+50 | nota 30 ---';
  RAISE NOTICE 'valor_pagado = %   (esperado 100)', v_pagado;
  RAISE NOTICE 'notas_credito = %  (esperado 30)', v_notas;
  RAISE NOTICE 'saldo        = %   (esperado 30)', v_saldo;
  RAISE NOTICE 'estado_pago  = %   (esperado PAGO_PARCIAL)', v_estado;

  -- ---------- Caso B: 1 pago (40) y 2 notas (10+10) ----------
  INSERT INTO clientes (nombre_razon_social, numero_identificacion, tipo_identificacion)
    VALUES ('TEST FANOUT B', 'ZZTESTB01', 'CC') RETURNING cliente_id INTO v_cliente;
  INSERT INTO pedidos (cliente_id, subtotal, impuestos, total)
    VALUES (v_cliente, v_total, 0, v_total) RETURNING pedido_id INTO v_pedido;
  INSERT INTO facturas (pedido_id, cliente_id, subtotal, impuestos, total)
    VALUES (v_pedido, v_cliente, v_total, 0, v_total) RETURNING factura_id INTO v_factura;

  INSERT INTO pagos (factura_id, valor, metodo_pago) VALUES (v_factura, 40, 'EFECTIVO');
  INSERT INTO notas_credito (factura_id, cliente_id, valor, motivo)
    VALUES (v_factura, v_cliente, 10, 'devolucion 1');
  INSERT INTO notas_credito (factura_id, cliente_id, valor, motivo)
    VALUES (v_factura, v_cliente, 10, 'devolucion 2');

  SELECT valor_pagado, notas_credito, saldo, estado_pago
    INTO v_pagado, v_notas, v_saldo, v_estado
    FROM factura_saldo WHERE factura_id = v_factura;

  RAISE NOTICE '--- CASO B: factura 100 | pago 40 | notas 10+10 ---';
  RAISE NOTICE 'valor_pagado = %   (esperado 40)', v_pagado;
  RAISE NOTICE 'notas_credito = %  (esperado 20)', v_notas;
  RAISE NOTICE 'saldo        = %   (esperado 80)', v_saldo;
  RAISE NOTICE 'estado_pago  = %   (esperado PAGO_PARCIAL)', v_estado;

  RAISE EXCEPTION 'ROLLBACK_INTENCIONAL';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_INTENCIONAL' THEN
      RAISE NOTICE '(datos de prueba revertidos)';
    ELSE
      RAISE;
    END IF;
END $$;
