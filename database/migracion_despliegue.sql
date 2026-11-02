-- ============================================================
-- FINAN-X · Migración de despliegue seguro
--
-- Aplica sobre una base de datos YA creada (volumen existente). Es idempotente:
-- se puede ejecutar varias veces sin efecto adicional.
--
-- Uso con Docker:
--   docker compose exec -T db psql -U postgres -d finanx < database/migracion_despliegue.sql
--
-- Uso local:
--   psql -h localhost -U postgres -d finanx -f database/migracion_despliegue.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Usuarios internos: nombre de usuario y primer ingreso
-- ------------------------------------------------------------
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(60);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clave_actualizada_en TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fallos_login INT NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

-- ------------------------------------------------------------
-- Cuentas del portal: primer ingreso y bloqueo por intentos
-- ------------------------------------------------------------
ALTER TABLE usuario_cliente ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuario_cliente ADD COLUMN IF NOT EXISTS clave_actualizada_en TIMESTAMPTZ;
ALTER TABLE usuario_cliente ADD COLUMN IF NOT EXISTS fallos_login INT NOT NULL DEFAULT 0;
ALTER TABLE usuario_cliente ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

-- ------------------------------------------------------------
-- Auditoría con origen de la petición
-- ------------------------------------------------------------
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS ip INET;
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ------------------------------------------------------------
-- Restricciones e índices
-- El username no admite "@": así nunca puede coincidir con el correo de otra
-- cuenta y el login (usuario o correo) resuelve siempre a una sola fila.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_username
  ON usuarios (LOWER(username)) WHERE username IS NOT NULL;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS ck_usuarios_username;
ALTER TABLE usuarios ADD CONSTRAINT ck_usuarios_username
  CHECK (username IS NULL OR username ~ '^[a-z0-9._-]{3,32}$');

-- Índices para el panel de control (series por mes y pagos por fecha)
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_emision ON facturas (fecha_emision);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha            ON pagos (fecha);

COMMIT;
