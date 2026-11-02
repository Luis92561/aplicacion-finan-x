@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0..\.."
title FINAN-X - Modo seguro (HTTPS)

echo ============================================
echo   FINAN-X - Modo seguro con HTTPS
echo ============================================
echo.
echo Este modo levanta la aplicacion con TLS, HSTS y cookie Secure.
echo El navegador mostrara un aviso porque el certificado es autofirmado:
echo acepte la excepcion ("Avanzado" - "Continuar").
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [X] Docker Desktop no esta instalado.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [X] Abra Docker Desktop y espere a que este listo.
  pause
  exit /b 1
)

if not exist ".env" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generar-env.ps1"
)

if not exist "certs\fullchain.pem" (
  echo Generando certificado autofirmado...
  powershell -NoProfile -ExecutionPolicy Bypass -File "deploy\generar-certificado.ps1"
  if errorlevel 1 (
    echo [X] No se pudo generar el certificado.
    pause
    exit /b 1
  )
)

echo Levantando en modo seguro...
docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build
if errorlevel 1 (
  echo [X] No se pudo levantar.
  pause
  exit /b 1
)

echo Esperando a la API por HTTPS...
set /a intentos=0
:esperar
curl -kfsS https://localhost:8443/api/health >nul 2>&1
if not errorlevel 1 goto :listo
set /a intentos+=1
if %intentos% geq 90 goto :timeout
timeout /t 2 /nobreak >nul
goto :esperar

:listo
start "" https://localhost:8443
echo [OK] Modo seguro: https://localhost:8443
echo      Cabeceras esperadas: Strict-Transport-Security, Content-Security-Policy,
echo      X-Frame-Options: DENY y Cache-Control: no-store en /api.
timeout /t 10 >nul
exit /b 0

:timeout
echo [X] La API no respondio a tiempo.
pause
exit /b 1
