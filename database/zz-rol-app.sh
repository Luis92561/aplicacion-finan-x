#!/bin/sh
# ============================================================
# FINAN-X · Rol de aplicación con privilegios mínimos
#
# La imagen oficial de PostgreSQL crea POSTGRES_USER como SUPERUSUARIO. Que la
# aplicación se conecte con ese usuario significa que cualquier fallo en el
# backend tiene permisos totales sobre la base (DDL, COPY FROM PROGRAM, etc.).
#
# Este script se ejecuta después de init.sql y de las migraciones (por eso
# empieza por "zz"), y crea un rol de aplicación que solo puede leer y escribir
# datos, nunca cambiar el esquema ni actuar como superusuario.
# ============================================================
set -eu

: "${APP_DB_PASSWORD:?Falta APP_DB_PASSWORD: defina la clave del rol de aplicacion en el .env}"

if [ "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_roles WHERE rolname='finanx_app'")" != "1" ]; then
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "CREATE ROLE finanx_app LOGIN PASSWORD '$APP_DB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT"
fi

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'EOSQL'
GRANT CONNECT ON DATABASE finanx TO finanx_app;
GRANT USAGE ON SCHEMA public TO finanx_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO finanx_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO finanx_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO finanx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO finanx_app;

ALTER ROLE finanx_app SET search_path = public;

-- La auditoría es de solo inserción para la aplicación: no puede reescribirla.
REVOKE UPDATE, DELETE ON auditoria FROM finanx_app;
EOSQL

echo "[finanx] Rol finanx_app creado con privilegios mínimos"
