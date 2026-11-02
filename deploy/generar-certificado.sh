#!/usr/bin/env bash
# =====================================================================
# FINAN-X · Genera un certificado TLS autofirmado para la demo local
#
# Uso:  ./deploy/generar-certificado.sh
# Crea: certs/fullchain.pem y certs/privkey.pem  (válidos 825 días)
#
# Usa la imagen de PostgreSQL (ya trae openssl) para no depender de que
# openssl esté instalado en el equipo.
# =====================================================================
set -euo pipefail

DOMINIO="${1:-localhost}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS="$RAIZ/certs"
mkdir -p "$CERTS"

echo ">>> Generando certificado autofirmado para $DOMINIO ..."
docker run --rm -v "$CERTS:/certs" postgres:16-alpine sh -c \
  "openssl req -x509 -nodes -newkey rsa:2048 -days 825 -keyout /certs/privkey.pem -out /certs/fullchain.pem -subj '/CN=$DOMINIO' -addext 'subjectAltName=DNS:$DOMINIO,IP:127.0.0.1'"

if [ -f "$CERTS/fullchain.pem" ]; then
  echo "[OK] Certificados en $CERTS"
  echo "     Modo seguro:  docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build"
  echo "     URL:          https://localhost:8443"
else
  echo "[X] No se pudo generar el certificado. Verifique que Docker esté corriendo."
  exit 1
fi
