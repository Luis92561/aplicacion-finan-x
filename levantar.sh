#!/usr/bin/env bash
#
# FINAN-X · levantar.sh
# =====================================================================
#  Levanta la aplicación completa (PostgreSQL + API REST + Frontend)
#  con Docker Compose (recomendado) o en modo desarrollo (hot reload).
#
#  USO:
#    ./levantar.sh             Levanta todo con Docker Compose
#    ./levantar.sh --dev       Modo desarrollo: BD en Docker + npm run dev
#    ./levantar.sh --stop      Detiene los contenedores (conserva los datos)
#    ./levantar.sh --purge     Detiene y BORRA los datos (down -v)
#    ./levantar.sh -h          Muestra esta ayuda
#
#  URLs después de levantar:
#    Panel interno y portal:   http://localhost:8080   (Docker Compose)
#                              http://localhost:5173   (modo desarrollo)
#    API REST (salud):         http://localhost:4000/api/health
#
#  Documento completo: documentacion/Instrucciones_Despliegue.md
# =====================================================================

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

GREEN=$'\e[0;32m'; YELLOW=$'\e[1;33m'; RED=$'\e[0;31m'; BOLD=$'\e[1m'; NC=$'\e[0m'

info()  { echo "${GREEN}▶${NC} $*"; }
warn()  { echo "${YELLOW}⚠${NC} $*"; }
error() { echo "${RED}✗${NC} $*"; }
ok()    { echo "${GREEN}${BOLD}✔${NC} $*"; }

MODE="${1:-docker}"
case "$MODE" in
  docker|--dev|--stop|--purge|-h|--help) ;;
  *) error "Modo desconocido: $MODE"
     echo "Uso: $0 [docker|--dev|--stop|--purge|-h]"
     exit 2 ;;
esac

if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  sed -n '1,21p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

# ----- utilidades -----------------------------------------------------

have() { command -v "$1" >/dev/null 2>&1; }

open_url() { # abre el navegador del sistema
  local url="$1"
  if have open; then open "$url"
  elif have xdg-open; then xdg-open "$url"
  else info "Abre en tu navegador: $url"; fi
}

wait_for() { # wait_for <segundos> <comando...>
  local max="$1"; shift
  local i=0
  while [ "$i" -lt "$max" ]; do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 3; i=$((i+3))
  done
  return 1
}

check_docker() {
  if ! have docker; then
    error "No se encontró Docker. Instala Docker Desktop y vuelve a intentarlo."
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    error "Docker está instalado pero no está corriendo. Abre Docker Desktop y espera a que esté listo."
    exit 1
  fi
}

credenciales() {
  cat <<'EOF'

  ─────────────────────── Credenciales demo ───────────────────────
   Administrador    admin@finanx.test          admin123
   Facturador       facturador@finanx.test     facturador123
   Cajero           cajero@finanx.test         cajero123
   Supervisor       supervisor@finanx.test     supervisor123
   Cliente (portal) cliente@finanx.test        cliente123
  ─────────────────────────────────────────────────────────────────
EOF
}

# ----- stop / purge -----------------------------------------------------

if [[ "$MODE" == "--stop" || "$MODE" == "--purge" ]]; then
  check_docker
  if [[ "$MODE" == "--purge" ]]; then
    info "Deteniendo contenedores y borrando los datos (down -v)…"
    docker compose down -v
  else
    info "Deteniendo contenedores (los datos se conservan)…"
    docker compose down
  fi
  # mata procesos de desarrollo sueltos de esta app
  pkill -f "node --watch src/index.js" 2>/dev/null && warn "Backend de desarrollo detenido" || true
  pkill -f "vite" 2>/dev/null || true
  ok "Listo."
  exit 0
fi

check_docker

# ----- modo Docker Compose (recomendado) --------------------------------

if [[ "$MODE" == "docker" ]]; then
  info "Creando imágenes y levantando el stack (db + backend + frontend)…"
  docker compose up -d --build

  if wait_for 120 curl -sf http://localhost:4000/api/health >/dev/null; then
    ok "Backend saludable en http://localhost:4000/api/health"
  else
    warn "El backend no respondió a tiempo. Revisa: docker compose logs backend"
  fi

  credenciales
  info "Abriendo el frontend en el navegador…"
  open_url "http://localhost:8080"
  ok "Frontend: http://localhost:8080 · Para detener: ./levantar.sh --stop"
  exit 0
fi

# ----- modo desarrollo (--dev) -------------------------------------------

BACK_PID=""; FRONT_PID=""
cleanup() {
  [ -n "$BACK_PID" ]  && kill "$BACK_PID"  2>/dev/null || true
  [ -n "$FRONT_PID" ] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

info "1/4 · Levantando PostgreSQL en Docker…"
docker compose up -d db
if ! wait_for 90 docker exec finanx-db pg_isready -U finanx -d finanx; then
  error "PostgreSQL no quedó listo. Revisa: docker compose logs db"; exit 1
fi
ok "PostgreSQL listo en localhost:5432 (finanx/finanx)"

info "2/4 · Backend (Node.js + Express)…"
if [ ! -d backend/node_modules ]; then
  info "   Instalando dependencias del backend…"
  (cd backend && npm install)
fi
info "   Aplicando seed de datos demo (idempotente)…"
(cd backend && npm run seed)
(cd backend && npm run dev) &
BACK_PID=$!

if ! wait_for 60 curl -sf http://localhost:4000/api/health >/dev/null; then
  error "El backend no arrancó. Revisa los mensajes anteriores."; kill "$BACK_PID" 2>/dev/null || true; exit 1
fi
ok "API REST en http://localhost:4000/api/health"

info "3/4 · Frontend (React + Vite)…"
if [ ! -d frontend/node_modules ]; then
  info "   Instalando dependencias del frontend…"
  (cd frontend && npm install)
fi
(cd frontend && npm run dev) &
FRONT_PID=$!

if ! wait_for 60 curl -sf http://localhost:5173 >/dev/null; then
  warn "El frontend no respondió en :5173; revisa la terminal (Vite puede elegir otro puerto si 5173 está ocupado)."
fi

credenciales
info "Abriendo el frontend en el navegador…"
open_url "http://localhost:5173"
ok "Modo desarrollo activo en http://localhost:5173 (Ctrl+C detiene todo)"
echo "   Para correr las 99 pruebas e2e (con el backend arriba): cd backend && npm test"
echo "   Esperando procesos de desarrollo…"
wait