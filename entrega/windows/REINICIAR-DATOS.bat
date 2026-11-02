@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0..\.."
title FINAN-X - Reiniciar datos

echo ============================================
echo   BORRAR DATOS Y DEJAR LA DEMO COMO NUEVA
echo ============================================
echo.
echo Esto elimina clientes, facturas, pagos y usuarios de la base.
echo Las cuentas iniciales se vuelven a crear con las claves del acta.
echo.
set /p confirmar="Escriba SI para continuar: "
if /i not "%confirmar%"=="SI" (
  echo Cancelado.
  timeout /t 3 >nul
  exit /b 0
)

echo Deteniendo y borrando el volumen de datos...
docker compose down -v
echo Levantando de nuevo...
docker compose up -d --build
if errorlevel 1 (
  echo [X] No se pudo levantar. Revise Docker Desktop.
  pause
  exit /b 1
)

echo Esperando a la API...
set /a intentos=0
:esperar
curl -fsS http://localhost:8080/api/health >nul 2>&1
if not errorlevel 1 goto :listo
set /a intentos+=1
if %intentos% geq 90 goto :timeout
timeout /t 2 /nobreak >nul
goto :esperar

:listo
echo Creando cuentas iniciales...
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs --archivo /primer-ingreso/usuarios-iniciales.json
start "" http://localhost:8080
echo [OK] Base de datos reiniciada.
timeout /t 8 >nul
exit /b 0

:timeout
echo [X] La API no respondio a tiempo.
pause
exit /b 1
