# =====================================================================
# FINAN-X · levantar.ps1  (versión Windows / PowerShell)
# =====================================================================
#  Levanta la aplicación completa (PostgreSQL + API REST + Frontend)
#  con Docker Compose. Es el equivalente de levantar.sh para Windows.
#
#  USO (desde la carpeta del proyecto):
#    .\levantar.ps1          Levanta todo con Docker Compose y abre el navegador
#    .\levantar.ps1 --stop   Detiene los contenedores (conserva los datos)
#    .\levantar.ps1 --purge  Detiene y BORRA los datos (down -v)
#
#  Si PowerShell bloquea la ejecución la primera vez:
#    Set-ExecutionPolicy -Scope Process Bypass
#
#  URLs después de levantar:
#    Panel interno y portal: http://localhost:8080
#    API REST (salud):       http://localhost:4000/api/health
# =====================================================================

param([string]$Mode = "docker")

Set-Location $PSScriptRoot

function Write-Info  { Write-Host "▶ $args" -ForegroundColor Green }
function Write-Warn  { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Ok    { Write-Host "✔ $args" -ForegroundColor Green }

function Test-DockerRunning {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Show-Credenciales {
    Write-Host ""
    Write-Host "  ─────────────────────── Credenciales demo ───────────────────────" -ForegroundColor Cyan
    Write-Host "   Administrador    admin@finanx.test          admin123"
    Write-Host "   Facturador       facturador@finanx.test     facturador123"
    Write-Host "   Cajero           cajero@finanx.test         cajero123"
    Write-Host "   Supervisor       supervisor@finanx.test     supervisor123"
    Write-Host "   Cliente (portal) cliente@finanx.test        cliente123"
    Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host ""
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "No se encontró Docker. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelve a intentar."
    exit 1
}

# ---------- stop / purge ----------
if ($Mode -eq "--stop" -or $Mode -eq "--purge") {
    if (-not (Test-DockerRunning)) { Write-Err "Docker no está corriendo. Abre Docker Desktop primero."; exit 1 }
    if ($Mode -eq "--purge") {
        Write-Info "Deteniendo contenedores y borrando los datos (down -v)…"
        docker compose down -v
    } else {
        Write-Info "Deteniendo contenedores (los datos se conservan)…"
        docker compose down
    }
    Write-Ok "Listo."
    exit 0
}

# ---------- asegurar Docker encendido ----------
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
    Write-Err "Docker no responde. Abre Docker Desktop manualmente y vuelve a intentar."
    exit 1
}

# ---------- modo Docker Compose (recomendado) ----------
Write-Info "Creando imágenes y levantando el stack (db + backend + frontend)…"
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Err "docker compose falló. Revisa el mensaje anterior."; exit 1 }

Write-Info "Esperando a que la API responda…"
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:4000/api/health" -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
}
if ($ok) { Write-Ok "Backend saludable en http://localhost:4000/api/health" }
else     { Write-Warn "El backend no respondió a tiempo. Revisa: docker compose logs backend" }

Show-Credenciales
Write-Info "Abriendo el frontend en el navegador…"
Start-Process "http://localhost:8080"
Write-Ok "Frontend: http://localhost:8080 · Para detener: .\levantar.ps1 --stop"