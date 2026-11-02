#!/bin/bash
# Detiene FINAN-X conservando los datos.
set -u
cd "$(dirname "$0")/../.." || exit 1
echo "Deteniendo FINAN-X (los datos se conservan)..."
docker compose down
echo "[OK] Aplicación detenida."
sleep 2
