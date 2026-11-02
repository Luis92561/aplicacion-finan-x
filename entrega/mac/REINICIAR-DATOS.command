#!/bin/bash
# Borra los datos y deja la demo como nueva.
set -u
cd "$(dirname "$0")/../.." || exit 1

echo "============================================"
echo "  BORRAR DATOS Y DEJAR LA DEMO COMO NUEVA"
echo "============================================"
echo
echo "Esto elimina clientes, facturas, pagos y usuarios de la base."
read -r -p "Escriba SI para continuar: " confirmar
if [ "$confirmar" != "SI" ]; then
  echo "Cancelado."
  exit 0
fi

docker compose down -v
docker compose up -d --build || exit 1

for _ in $(seq 1 90); do
  curl -fsS http://localhost:8080/api/health >/dev/null 2>&1 && break
  sleep 2
done

echo "Creando cuentas iniciales..."
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs --archivo /primer-ingreso/usuarios-iniciales.json || true
open "http://localhost:8080"
echo "[OK] Base de datos reiniciada."
sleep 2
