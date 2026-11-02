@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0..\.."
echo Deteniendo FINAN-X (los datos se conservan)...
docker compose down
echo [OK] Aplicacion detenida.
timeout /t 4 >nul
