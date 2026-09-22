#!/usr/bin/env bash
#
# FINAN-X · sincronizar-datos.sh  (Mac)
# ---------------------------------------------------------------------
#  Exporta / importa la base de datos completa (contenida en Docker).
#  Cada computadora tiene SU propia base en Docker (volumen local);
#  este script te deja pasar los datos de una a otra con un archivo .sql.
#
#  USO:
#    ./sincronizar-datos.sh export    → crea respaldo/finanx_AAAAMMDD.sql
#    ./sincronizar-datos.sh import    → restaura el .sql más reciente
#                                       (¡OJO! borra los datos actuales primero:
#                                       docker compose down -v + up -d db)
# ---------------------------------------------------------------------

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
mkdir -p respaldo

case "${1:-}" in
  export)
    FILE="respaldo/finanx_$(date +%Y%m%d_%H%M).sql"
    echo "▶ Exportando la base a $FILE …"
    docker exec finanx-db pg_dump -U finanx -d finanx --clean --if-exists > "$FILE"
    echo "✔ Listo. Lleva este archivo a la otra computadora (USB, Drive…) y allí ejecuta:"
    echo "    ./sincronizar-datos.sh import"
    ;;
  import)
    FILE="$(ls -t respaldo/finanx_*.sql 2>/dev/null | head -1)"
    [ -n "$FILE" ] || { echo "✗ No hay respaldos en respaldo/"; exit 1; }
    echo "▶ Restaurando $FILE en la base de Docker …"
    echo "  (Asegúrate de haber recreado la base: docker compose down -v && docker compose up -d db)"
    docker exec -i finanx-db psql -U finanx -d finanx < "$FILE"
    echo "✔ Datos importados. Levanta todo con: ./levantar.sh"
    ;;
  *)
    echo "Uso: ./sincronizar-datos.sh [export|import]"
    exit 2
    ;;
esac