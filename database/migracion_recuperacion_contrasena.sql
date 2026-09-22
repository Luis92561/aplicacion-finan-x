-- ------------------------------------------------------------
-- FINAN-X · Migración: recuperación de contraseña (código OTP) y
--            datos de pago en línea (tarjeta / transferencia)
-- Aplicar con: docker exec -i finanx-db psql -U finanx -d finanx < migracion_recuperacion_contrasena.sql
-- ------------------------------------------------------------

-- 1) Solicitudes de recuperación de contraseña con código de un solo uso (OTP)
--    El código se guarda CIFRADO (bcrypt) y caduca; nunca en texto plano.
CREATE TABLE IF NOT EXISTS recuperaciones_clave (
  recuperacion_id    SERIAL PRIMARY KEY,
  usuario_cliente_id INT NOT NULL REFERENCES usuario_cliente(usuario_cliente_id) ON DELETE CASCADE,
  canal              VARCHAR(10) NOT NULL CHECK (canal IN ('EMAIL', 'SMS')),
  codigo_hash        TEXT NOT NULL,
  intentos           INT NOT NULL DEFAULT 0,
  usado              BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en          TIMESTAMPTZ NOT NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recuperaciones_cliente ON recuperaciones_clave(usuario_cliente_id, usado);

-- 2) Datos de pago en línea (tarjeta / transferencia / cheque).
--    Por buenas prácticas de seguridad (PCI-DSS) NUNCA se almacenan
--    el número completo de la tarjeta ni el código de seguridad (CVV).
--    Solo se guardan los últimos 4 dígitos y datos no sensibles.
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS titular TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS tipo_tarjeta TEXT;              -- VISA / MASTERCARD / AMEX / OTRA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS ultimos_digitos_tarjeta TEXT;   -- solo 4 dígitos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS vencimiento_tarjeta TEXT;       -- MM/AA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS numero_cuenta TEXT;             -- transferencia