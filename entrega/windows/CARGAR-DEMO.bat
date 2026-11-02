@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0..\.."
title FINAN-X - Cargar datos de demostracion

echo ============================================
echo   CARGAR DATOS DE DEMOSTRACION
echo ============================================
echo.
echo Reemplaza la base por la demo: 6 facturas de ejemplo (con pagos y saldos) para que el panel
echo y el portal tengan informacion. SE PIERDEN los datos actuales.
echo.
set /p confirmar="Escriba SI para continuar: "
if /i not "%confirmar%"=="SI" ( echo Cancelado. & timeout /t 3 >nul & exit /b 0 )

docker info >nul 2>&1
if errorlevel 1 ( echo [X] Abra Docker Desktop primero. & pause & exit /b 1 )

docker compose exec -T db sh -c "pg_dump -U postgres -d finanx -t clientes -f /dev/null" >nul 2>&1
if errorlevel 1 ( echo [X] La base no esta levantada. Use ABRIR-FINAN-X.bat primero. & pause & exit /b 1 )

docker compose cp base/finanx-demo.sql db:/tmp/finanx-demo.sql
docker compose exec -T db psql -U postgres -d finanx -f /tmp/finanx-demo.sql
if errorlevel 1 ( echo [X] No se pudieron cargar los datos. & pause & exit /b 1 )

start "" http://localhost:8080
echo [OK] Datos de demostracion cargados.
timeout /t 6 >nul
