# =====================================================================
# FINAN-X · levantar.ps1  (version Windows / PowerShell)
# =====================================================================
#  Levanta la aplicacion completa (PostgreSQL + API REST + Frontend)
#  con Docker Compose. Equivalente de levantar.sh para Windows.
#
#  USO (desde la carpeta del proyecto):
#    .\levantar.ps1          Levanta todo y abre el navegador
#    .\levantar.ps1 --stop   Detiene los contenedores (conserva los datos)
#    .\levantar.ps1 --purge  Detiene y BORRA los datos (down -v)
#
#  URLs despues de levantar:
#    Panel interno y portal: http://localhost:8080
#    API REST (salud):       http://localhost:4000/api/health
# =====================================================================

param([string]$Mode = "docker")

Set-Location $PSScriptRoot

function Info { Write-Host ">>> $args" -ForegroundColor Green }
function Aviso { Write-Host "! $args" -ForegroundColor Yellow }
function Error-X { Write-Host "X $args" -ForegroundColor Red }
function Ok { Write-Host "[OK] $args" -ForegroundColor Green }

function Test-DockerRunning {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

# Verifica que el comando docker existe
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Error-X "No se encontro Docker. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelve a intentar."
    exit 1
}

# ---------- Modo stop / purge ----------
if ($Mode -eq "--stop" -or $Mode -eq "--purge") {
    if (-not (Test-DockerRunning)) { Error-X "Docker no esta corriendo. Abre Docker Desktop primero."; exit 1 }
    if ($Mode -eq "--purge") {
        Info "Deteniendo contenedores y borrando los datos (down -v)..."
        docker compose down -v
    } else {
        Info "Deteniendo contenedores (los datos se conservan)..."
        docker compose down
    }
    Ok "Listo."
    exit 0
}

# ---------- Asegurar que Docker este encendido ----------
if (-not (Test-DockerRunning)) {
    Aviso "Docker no esta corriendo. Abriendo Docker Desktop (espera hasta que diga 'Engine running')..."
    Start-Process "Docker Desktop"
    $i = 0
    while ($i -lt 40 -and -not (Test-DockerRunning)) {
        Start-Sleep -Seconds 3
        $i++
    }
}
if (-not (Test-DockerRunning)) {
    Error-X "Docker no responde. Abre Docker Desktop manualmente, espera a que diga 'Engine running' y vuelve a ejecutar: .\levantar.ps1"
    exit 1
}
Ok "Docker listo."

# ---------- Modo Docker Compose (recomendado) ----------
Info "Creando imagenes y levantando el stack (db + backend + frontend)..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Error-X "docker compose fallo. Revisa el mensaje anterior (puede ser log de contenedor)."
    Info "Para ver los registros: docker compose logs backend"
    exit 1
}

Info "Esperando a que la API responda..."
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:4000/api/health" -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
}
if ($ok) { Ok "Backend saludable en http://localhost:4000/api/health" }
else     { Aviso "La API no respondio a tiempo. Revisa: docker compose logs backend" }

Write-Host ""
Write-Host "  ---- Credenciales demo ----" -ForegroundColor Cyan
Write-Host "   Administrador    admin@finanx.test          admin123"
Write-Host "   Facturador       facturador@finanx.test     facturador123"
Write-Host "   Cajero           cajero@finanx.test         cajero123"
Write-Host "   Supervisor       supervisor@finanx.test     supervisor123"
Write-Host "   Cliente (portal) cliente@finanx.test        cliente123"
Write-Host ""
Info "Abriendo el frontend en el navegador..."
Start-Process "http://localhost:8080"
Ok "Frontend: http://localhost:8080  |  Para detener: .\levantar.ps1 --stop"