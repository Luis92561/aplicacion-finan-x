#!/bin/bash
# Carga los datos de demostración (6 facturas con pagos y saldos).
set -u
cd "$(dirname "$0")/../.." || exit 1

echo "============================================"
echo "  CARGAR DATOS DE DEMOSTRACIÓN"
echo "============================================"
echo
echo "Reemplaza la base por la demo (6 facturas de ejemplo). SE PIERDEN los datos actuales."
read -r -p "Escriba SI para continuar: " confirmar
[ "$confirmar" = "SI" ] || { echo "Cancelado."; exit 0; }

docker info >/dev/null 2>&1 || { echo "[X] Abra Docker Desktop primero."; exit 1; }
docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 || {
  echo "[X] La base no está levantada. Use ABRIR-FINAN-X.command primero."
  exit 1
}

docker compose cp base/finanx-demo.sql db:/tmp/finanx-demo.sql
docker compose exec -T db psql -U postgres -d finanx -f /tmp/finanx-demo.sql || {
  echo "[X] No se pudieron cargar los datos."
  exit 1
}

docker compose cp base/productos-tecnologicos.sql db:/tmp/productos-tec.sql
docker compose exec -T db psql -U postgres -d finanx -f /tmp/productos-tec.sql || {
  echo "[X] No se pudo cargar el catálogo tecnológico."
  exit 1
}

open "http://localhost:8080"
echo "[OK] Datos de demostración cargados."
sleep 2
