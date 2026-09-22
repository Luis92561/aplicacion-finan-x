# =====================================================================
# FINAN-X · iniciar-app.ps1  (versión Windows / PowerShell)
# ---------------------------------------------------------------------
#  Lanza la aplicación web (Docker Compose) y la abre en el navegador.
#  Es el equivalente de iniciar-app.sh para Windows.
#
#  USO:
#    .\iniciar-app.ps1          Inicia y abre el navegador
#    .\iniciar-app.ps1 stop     Detiene la app (conserva datos)
#    .\iniciar-app.ps1 url      Solo abre el navegador (si ya corre)
#
#  URL:  http://localhost:8080/login
#  API:  http://localhost:4000/api/health
# =====================================================================

param([string]$Mode = "start")

Set-Location $PSScriptRoot

function Write-Info  { Write-Host "▶ $args" -ForegroundColor Green }
function Write-Warn  { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Ok    { Write-Host "✔ $args" -ForegroundColor Green }

function Test-DockerRunning {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

switch ($Mode) {
    "start" {
        if (-not (Test-DockerRunning)) {
            Write-Warn "Docker no está corriendo. Intentando abrir Docker Desktop…"
            Start-Process "Docker Desktop"
            $i = 0
            while ($i -lt 30 -and -not (Test-DockerRunning)) {
                Start-Sleep -Seconds 2
                $i++
            }
        }
        if (-not (Test-DockerRunning)) {
            Write-Error "Docker no responde. Abre Docker Desktop manualmente y vuelve a intentar."
            exit 1
        }
        Write-Info "Levantando la app con Docker Compose…"
        & "$PSScriptRoot\levantar.ps1"
        exit $LASTEXITCODE
    }
    "stop" {
        Write-Info "Deteniendo los contenedores (los datos se conservan)…"
        & "$PSScriptRoot\levantar.ps1" --stop
        Write-Ok "App detenida. Para volver a abrirla: .\iniciar-app.ps1"
        exit $LASTEXITCODE
    }
    "url" {
        Start-Process "http://localhost:8080/login"
    }
    default {
        Write-Host "Uso: .\iniciar-app.ps1 [start|stop|url]"
        exit 2
    }
}