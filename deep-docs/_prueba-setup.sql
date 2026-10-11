-- ============================================================
-- Datos mínimos para probar la vista factura_saldo.
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================
INSERT INTO roles (nombre, descripcion) VALUES
  ('ADMIN', 'test'), ('FACTURADOR', 'test'), ('CAJERO', 'test'), ('SUPERVISOR', 'test')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO usuarios (nombre, correo, password_hash, rol_id)
SELECT 'Test Admin', 'admin@finanx.test', 'x',
       (SELECT rol_id FROM roles WHERE nombre = 'ADMIN')
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE correo = 'admin@finanx.test');
