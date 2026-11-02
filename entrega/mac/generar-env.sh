#!/bin/bash
# Genera el archivo .env con secretos aleatorios si no existe.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DESTINO="$RAIZ/.env"

if [ -f "$DESTINO" ]; then
  echo "El archivo .env ya existe; se conserva."
  exit 0
fi

secreto() {
  openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n' | cut -c1-"${1:-48}"
}

cat > "$DESTINO" <<EOF
# Generado automáticamente por FINAN-X. No compartir ni versionar.
JWT_SECRET=$(secreto 64)
JWT_EXPIRES=2h
POSTGRES_PASSWORD=$(secreto 32)
APP_DB_PASSWORD=$(secreto 32)
NODE_ENV=production
DOMAIN=localhost
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
COOKIE_SECURE=off
OTP_RETORNO_DEMO=off
REGISTRO_ABIERTO=off
SEED_DEMO=false
LOGIN_MAX_FAILURES=5
LOGIN_LOCK_MINUTES=15
BCRYPT_ROUNDS=12
EOF

chmod 600 "$DESTINO"
echo "[OK] Configuración creada en $DESTINO"
