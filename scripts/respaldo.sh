#!/usr/bin/env bash
# =====================================================================
# FINAN-X · Respaldo de la base de datos
#
# Uso:  ./scripts/respaldo.sh
# Crea: respaldo/finanx-AAAAMMDD-HHMM.sql.gz  (retención de 14 archivos)
# =====================================================================
set -euo pipefail

RETENCION="${1:-14}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="$RAIZ/respaldo"
mkdir -p "$DESTINO"

FECHA="$(date +%Y%m%d-%H%M)"
ARCHIVO="$DESTINO/finanx-$FECHA.sql.gz"

cd "$RAIZ"
echo ">>> Generando respaldo ..."
docker compose exec -T db sh -c "pg_dump -U postgres -d finanx | gzip -9 > /tmp/finanx-respaldo.sql.gz"
docker compose cp db:/tmp/finanx-respaldo.sql.gz "$ARCHIVO"
docker compose exec -T db rm -f /tmp/finanx-respaldo.sql.gz

echo "[OK] Respaldo: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

ls -1t "$DESTINO"/finanx-*.sql.gz 2>/dev/null | tail -n +$((RETENCION + 1)) | xargs -r rm -f

echo "Recuerde copiar 'respaldo/' a un medio externo y probar la restauración."
