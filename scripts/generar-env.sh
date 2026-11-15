#!/bin/sh
# Genera el archivo .env con secretos aleatorios a partir de .env.example.
# Uso:  ./scripts/generar-env.sh
set -eu

cd "$(dirname "$0")/.." || exit 1

if [ -f .env ]; then
  echo "El archivo .env ya existe; no se sobrescribe."
  exit 0
fi
if [ ! -f .env.example ]; then
  echo "Falta .env.example en la raiz del proyecto." >&2
  exit 1
fi

secreto() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n' | tr '+/' '-_' | tr -d '='
  elif command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))"
  else
    echo "Se necesita openssl o node para generar los secretos." >&2
    exit 1
  fi
}

JWT=$(secreto)
PG=$(secreto)
APP=$(secreto)

awk -v jwt="$JWT" -v pg="$PG" -v app="$APP" '
  /^JWT_SECRET=/        { print "JWT_SECRET=" jwt;        next }
  /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pg;  next }
  /^APP_DB_PASSWORD=/   { print "APP_DB_PASSWORD=" app;   next }
  { print }
' .env.example > .env

echo "[OK] .env generado con secretos aleatorios."
echo "     Siguiente paso: docker compose up -d --build"
