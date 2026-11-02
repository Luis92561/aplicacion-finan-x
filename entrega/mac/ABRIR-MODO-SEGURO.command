#!/bin/bash
# Abre FINAN-X en modo seguro (HTTPS en :8443) para mostrar TLS y cabeceras.
set -u
cd "$(dirname "$0")/../.." || exit 1

echo "============================================"
echo "  FINAN-X - Modo seguro (HTTPS)"
echo "============================================"
echo
echo "El navegador avisará porque el certificado es autofirmado:"
echo "acepte la excepción (Avanzado → Continuar)."
echo

if ! docker info >/dev/null 2>&1; then
  echo "[X] Abra Docker Desktop y vuelva a intentar."
  read -r -n 1 -p "Pulse una tecla para cerrar..."
  exit 1
fi

[ -f .env ] || bash "entrega/mac/generar-env.sh"

if [ ! -f "certs/fullchain.pem" ]; then
  echo "Generando certificado autofirmado..."
  bash "deploy/generar-certificado.sh" || exit 1
fi

docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build || exit 1

for _ in $(seq 1 90); do
  curl -kfsS https://localhost:8443/api/health >/dev/null 2>&1 && break
  sleep 2
done

open "https://localhost:8443"
echo "[OK] Modo seguro: https://localhost:8443"
echo "     Cabeceras: Strict-Transport-Security, Content-Security-Policy,"
echo "     X-Frame-Options: DENY y Cache-Control: no-store en /api."
sleep 3
