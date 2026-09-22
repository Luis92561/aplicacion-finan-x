# =====================================================================
# FINAN-X - iniciar-app.ps1  (version Windows / PowerShell)
# ---------------------------------------------------------------------
#  Abre la aplicacion web y, si hace falta, la levanta con Docker.
#  Equivalente de iniciar-app.sh para Windows.
#
#  USO (desde la carpeta del proyecto):
#    .\iniciar-app.ps1           Abre la app (levantando Docker si hace falta)
#    .\iniciar-app.ps1 url       Solo abre el navegador (si ya corre)
#    .\iniciar-app.ps1 stop      Detiene la app (conserva los datos)
# =====================================================================

param([string]$Mode = "start")

Set-Location $PSScriptRoot

function Info { Write-Host ">>> $args" -ForegroundColor Green }
function Aviso { Write-Host "! $args" -ForegroundColor Yellow }
function Error-X { Write-Host "X $args" -ForegroundColor Red }
function Ok { Write-Host "[OK] $args" -ForegroundColor Green }

switch ($Mode) {
    "url" {
        Start-Process "http://localhost:8080/login"
        break
    }
    "stop" {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            Error-X "No se encontro Docker. Instala Docker Desktop primero."
            exit 1
        }
        docker compose stop
        if ($LASTEXITCODE -ne 0) { Error-X "No se pudo detener. Revisa que Docker este corriendo."; exit 1 }
        Ok "Contenedores detenidos (los datos se conservan)."
        break
    }
    default {
        if (-not (Test-Path "$PSScriptRoot\levantar.ps1")) {
            Error-X "No encuentro levantar.ps1 en esta carpeta. Revisa que la carpeta sea la correcta."
            exit 1
        }
        Info "Abriendo el navegador..."
        Start-Process "http://localhost:8080/login"
        Info "Levantando la app (si no estaba corriendo) con levantar.ps1..."
        & "$PSScriptRoot\levantar.ps1"
        exit $LASTEXITCODE
    }
}
Write-Host ""
Ok "Si la app no cargo, ejecuta: .\levantar.ps1  y espera a que diga 'listo'."
