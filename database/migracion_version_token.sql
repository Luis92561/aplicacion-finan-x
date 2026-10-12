-- ============================================================
-- Migración FINAN-X: invalidación de sesiones (token_version)
-- ============================================================
-- PROBLEMA QUE RESUELVE
--   Los JWT se firman con una caducidad de 8 h y no había forma de revocarlos.
--   Si a alguien le robaban el token y cambiaba su contraseña para protegerse,
--   el token robado seguía siendo válido hasta 8 horas: la víctima no podía
--   expulsar al atacante.
--
-- SOLUCIÓN
--   Cada cuenta lleva un contador `token_version` que viaja dentro del token.
--   `requireAuth` comprueba en cada petición que el token traiga la versión
--   vigente. Al cambiar (o restablecer) la contraseña se incrementa el contador,
--   y todos los tokens emitidos antes dejan de valer de inmediato.
--
-- CÓMO APLICARLA (base de datos ya existente):
--   docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_version_token.sql
--
-- Es idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Las instalaciones nuevas ya la incluyen en init.sql.
-- ============================================================

-- Cuentas de usuario interno
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;

-- Cuentas de acceso del portal del cliente
ALTER TABLE usuario_cliente
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;
