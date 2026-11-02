# =====================================================================
# FINAN-X - sincronizar-datos.ps1  (version Windows / PowerShell)
# ---------------------------------------------------------------------
#  Exporta / importa la base de datos completa (contenida en Docker).
#  Cada PC tiene SU PROPIA base en Docker; este script te deja pasar
#  los datos de una PC a la otra con un archivo .sql (carpeta respaldo).
#
#  USO (desde la carpeta del proyecto):
#    .\sincronizar-datos.ps1 export   Guarda respaldo\finanx_FECHA.sql
#    .\sincronizar-datos.ps1 import   Restaura el respaldo mas reciente
#                                     (ADVERTENCIA: reemplaza los datos
#                                     actuales de la base en esta PC)
# =====================================================================

param([string]$Modo)

Set-Location $PSScriptRoot

function Info { Write-Host ">>> $args" -ForegroundColor Green }
function Aviso { Write-Host "! $args" -ForegroundColor Yellow }
function Error-X { Write-Host "X $args" -ForegroundColor Red }
function Ok { Write-Host "[OK] $args" -ForegroundColor Green }

# 1) Verifica Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Error-X "No se encontro Docker. Instala Docker Desktop primero."
    exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Error-X "Docker no esta corriendo. Abre Docker Desktop y espera a que diga 'Engine running'."
    exit 1
}

switch ($Modo) {
    "export" {
        if (-not (docker ps --format "{{.Names}}" | Select-String -Quiet "finanx-db")) {
            Error-X "La base de FINAN-X no esta levantada. Ejecuta primero: .\levantar.ps1"
            exit 1
        }
        New-Item -ItemType Directory -Force -Path respaldo | Out-Null
        $file = "respaldo\finanx_" + (Get-Date -Format "yyyyMMdd_HHmm") + ".sql"
        Info "Exportando la base de datos a: $file"
        docker exec finanx-db pg_dump -U finanx -d finanx --clean --if-exists > $file
        if ($LASTEXITCODE -ne 0) { Error-X "Fallo la exportacion."; exit 1 }
        Ok "Exportado: $file"
        Ok "Lleva este archivo a la otra PC (USB o disco) y alli ejecuta: .\sincronizar-datos.ps1 import"
        break
    }
    "import" {
        $f = Get-ChildItem "respaldo\finanx_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $f) { Error-X "No hay respaldos en la carpeta respaldo\."; exit 1 }
        if (-not (docker ps --format "{{.Names}}" | Select-String -Quiet "finanx-db")) {
            Error-X "La base de FINAN-X no esta levantada. Ejecuta primero: .\levantar.ps1"
            exit 1
        }
        Aviso "Vas a reemplazar los datos ACTUALES por los del respaldo: $($f.Name)"
        $r = Read-Host "Escribe SI para continuar"
        if ($r -ne "SI") { info "Cancelado, no se toco nada."; break }
        Info "Restaurando $($f.Name) ..."
        Get-Content $f.FullName | docker exec -i finanx-db psql -U finanx -d finanx
        if ($LASTEXITCODE -ne 0) { Error-X "Fallo la importacion."; exit 1 }
        Ok "Datos restaurados."
        break
    }
    default {
        Write-Host "Uso: .\sincronizar-datos.ps1 export | import"
        exit 2
    }
}

function Get-DockerContainerState { param($name) (docker ps -q -f "name=$name") }
