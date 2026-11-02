#!/bin/bash
# =====================================================================
# FINAN-X · Abrir la aplicación en macOS (doble clic)
# =====================================================================
set -u
cd "$(dirname "$0")/../.." || exit 1

echo "============================================"
echo "  FINAN-X - Facturación y pagos"
echo "============================================"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "[X] Docker Desktop no está instalado en este Mac."
  echo "    Instálelo una vez desde: https://www.docker.com/products/docker-desktop/"
  open "https://www.docker.com/products/docker-desktop/" 2>/dev/null
  read -r -n 1 -p "Pulse una tecla para cerrar..."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Iniciando Docker Desktop..."
  open -a Docker 2>/dev/null
  for _ in $(seq 1 90); do
    sleep 2
    docker info >/dev/null 2>&1 && break
  done
fi
if ! docker info >/dev/null 2>&1; then
  echo "[X] Docker no respondió. Abra Docker Desktop y espere a que esté listo."
  read -r -n 1 -p "Pulse una tecla para cerrar..."
  exit 1
fi

if [ ! -f .env ]; then
  bash "entrega/mac/generar-env.sh" || exit 1
fi

if [ -d "entrega/mac/paquete-offline" ] && ls entrega/mac/paquete-offline/*.tar.gz >/dev/null 2>&1; then
  if ! docker image inspect finanx-backend:1.0.0 >/dev/null 2>&1; then
    echo "Cargando imágenes del paquete sin conexión..."
    for f in entrega/mac/paquete-offline/*.tar.gz; do
      docker load -i "$f"
    done
  fi
fi

echo "Levantando servicios..."
docker compose up -d --build || {
  echo "[X] No se pudo levantar. Revise Docker Desktop."
  docker compose logs --tail 60 > "entrega/mac/diagnostico.log" 2>&1
  read -r -n 1 -p "Pulse una tecla para cerrar..."
  exit 1
}

echo "Esperando a que la aplicación responda..."
for _ in $(seq 1 90); do
  curl -fsS http://localhost:8080/api/health >/dev/null 2>&1 && break
  sleep 2
done

echo
echo "Creando cuentas iniciales (si no existen)..."
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs --archivo /primer-ingreso/usuarios-iniciales.json || true

open "http://localhost:8080"
echo
echo "[OK] FINAN-X disponible en http://localhost:8080"
echo "     Para detenerla: CERRAR-FINAN-X.command"
echo "     Cuentas y claves: ../primer-ingreso/Acta-Usuarios-Primer-Ingreso.pdf"
sleep 3
