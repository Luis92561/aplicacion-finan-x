@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0..\.."
title FINAN-X - Iniciando

echo ============================================
echo   FINAN-X - Facturacion y pagos
echo ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 goto :sin_docker

docker info >nul 2>&1
if errorlevel 1 call :arrancar_docker
docker info >nul 2>&1
if errorlevel 1 goto :docker_apagado

if not exist ".env" (
  echo Generando configuracion y claves iniciales...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generar-env.ps1"
  if errorlevel 1 goto :error
)

if exist "%~dp0paquete-offline" (
  dir /b "%~dp0paquete-offline\*.tar.gz" >nul 2>&1
  if not errorlevel 1 (
    docker image inspect finanx-backend:1.0.0 >nul 2>&1
    if errorlevel 1 (
      echo Cargando imagenes del paquete sin conexion...
      for %%F in ("%~dp0paquete-offline\*.tar.gz") do docker load -i "%%F"
    )
  )
)

echo Levantando servicios...
docker compose up -d --build
if errorlevel 1 goto :error

echo Esperando a que la aplicacion responda...
set /a intentos=0
:esperar
curl -fsS http://localhost:8080/api/health >nul 2>&1
if not errorlevel 1 goto :listo
set /a intentos+=1
if %intentos% geq 90 goto :timeout
timeout /t 2 /nobreak >nul
goto :esperar

:listo
echo.
echo Creando cuentas iniciales (si no existen)...
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs --archivo /primer-ingreso/usuarios-iniciales.json
echo.
start "" http://localhost:8080
echo [OK] FINAN-X disponible en http://localhost:8080
echo      Para detenerla: CERRAR-FINAN-X.bat
echo      Cuentas y claves temporales: primer-ingreso\Acta-Usuarios-Primer-Ingreso.pdf
timeout /t 10 >nul
exit /b 0

:sin_docker
echo [X] Docker Desktop no esta instalado en este equipo.
echo.
echo     Instalelo una vez desde:
echo       https://www.docker.com/products/docker-desktop/
echo     Despues de instalarlo y reiniciar, vuelva a hacer doble clic aqui.
start "" https://www.docker.com/products/docker-desktop/
pause
exit /b 1

:docker_apagado
echo [X] Docker Desktop no respondio. Abralo, espere a que diga "Engine running"
echo     y vuelva a intentar.
pause
exit /b 1

:timeout
echo [X] La aplicacion no respondio a tiempo.
docker compose logs --tail 60 > "%~dp0diagnostico.log" 2>&1
echo     Se guardo el detalle en: %~dp0diagnostico.log
pause
exit /b 1

:error
echo [X] No se pudo levantar la aplicacion.
docker compose logs --tail 80 > "%~dp0diagnostico.log" 2>&1
echo     Se guardo el detalle en: %~dp0diagnostico.log
pause
exit /b 1

:arrancar_docker
echo Iniciando Docker Desktop...
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
for /l %%i in (1,1,90) do (
  timeout /t 2 /nobreak >nul
  docker info >nul 2>&1
  if not errorlevel 1 goto :eof
)
goto :eof
