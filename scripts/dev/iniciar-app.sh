#!/usr/bin/env bash
#
# FINAN-X · iniciar-app.sh
# ---------------------------------------------------------------------
#  Lanza la aplicación web (Docker Compose) y la abre en el navegador.
#
#  USO:
#    ./iniciar-app.sh            Inicia y abre el navegador
#    ./iniciar-app.sh stop       Detiene la app (conserva datos)
#    ./iniciar-app.sh url        Solo abre el navegador (si ya corre)
#
#  URL:  http://localhost:8080/login
#  API:  http://localhost:4000/api/health
# ---------------------------------------------------------------------

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

GREEN=$'\e[0;32m'; YELLOW=$'\e[1;33m'; BOLD=$'\e[1m'; NC=$'\e[0m'

export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

# Asegurar que Docker Desktop esté encendido
if ! docker info >/dev/null 2>&1; then
  echo "${YELLOW}⚠${NC} Encendiendo Docker Desktop… (espera unos segundos)"
  open -a Docker
  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
fi
if ! docker info >/dev/null 2>&1; then
  echo "${YELLOW}✗${NC} Docker no responde. Ábrelo manualmente (Docker Desktop) y vuelve a intentar."
  exit 1
fi

case "${1:-start}" in
  start)
    echo "${GREEN}▶${NC} Levantando la app con Docker Compose…"
    ./levantar.sh
    ;;
  stop)
    echo "${GREEN}▶${NC} Deteniendo los contenedores (los datos se conservan)…"
    ./levantar.sh --stop
    echo "${GREEN}✔${NC} App detenida. Para volver a abrirla: ${BOLD}./iniciar-app.sh${NC}"
    ;;
  url)
    open "http://localhost:8080/login"
    ;;
  *)
    echo "Uso: ./iniciar-app.sh [start|stop|url]"
    exit 2
    ;;
esac