-- =====================================================================
-- FINAN-X · Datos de demostración (OPCIONAL)
--
-- Inserta 6 pedidos facturados (uno por mes), con sus facturas y pagos, para
-- que el panel y el portal del cliente tengan información que mostrar.
--
-- Uso (después de crear las cuentas iniciales):
--   docker compose exec -T db psql -U postgres -d finanx < base/datos-demo.sql
--
-- No ejecutar en producción: son datos ficticios.
-- =====================================================================
DO $$
DECLARE
  i int;
  cid int;
  pid int;
  fid int;
  base numeric;
  total numeric;
  metodo text;
BEGIN
  FOR i IN 0..5 LOOP
    SELECT cliente_id INTO cid FROM clientes ORDER BY cliente_id LIMIT 1 OFFSET (i % 2);
    EXIT WHEN cid IS NULL;

    base := 500000 + (i * 350000);
    total := round(base * 1.19, 2);

    INSERT INTO pedidos (cliente_id, fecha, estado, subtotal, impuestos, total, numero_pedido)
    VALUES (cid, NOW() - make_interval(months => 5 - i), 'FACTURADO', base, round(base * 0.19, 2), total,
            'PED-DEMO-' || lpad((i + 1)::text, 3, '0'))
    RETURNING pedido_id INTO pid;

    INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
    SELECT pid, producto_id, 1, base, base FROM productos ORDER BY producto_id LIMIT 1;

    INSERT INTO facturas (pedido_id, cliente_id, fecha_emision, fecha_vencimiento, subtotal, impuestos, total, numero_factura)
    VALUES (pid, cid, NOW() - make_interval(months => 5 - i),
            ((NOW() - make_interval(months => 5 - i))::date + 30),
            base, round(base * 0.19, 2), total,
            'FAC-DEMO-' || lpad((i + 1)::text, 3, '0'))
    RETURNING factura_id INTO fid;

    -- Dos de las seis facturas quedan pendientes; las demás se pagan.
    IF i <> 1 AND i <> 4 THEN
      metodo := (ARRAY['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])[1 + (i % 3)];
      INSERT INTO pagos (factura_id, fecha, valor, metodo_pago, referencia, numero_pago, observaciones)
      VALUES (fid, NOW() - make_interval(months => 5 - i) + interval '4 days', total, metodo,
              'DEMO-' || lpad((i + 1)::text, 3, '0'),
              'PAG-DEMO-' || lpad((i + 1)::text, 3, '0'),
              'Pago de demostración');
    END IF;
  END LOOP;
END $$;
