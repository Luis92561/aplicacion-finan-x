# =====================================================================
# FINAN-X · Respaldo de la base de datos
#
# Uso:  .\scripts\respaldo.ps1
# Crea: respaldo\finanx-AAAAMMDD-HHMM.sql.gz  (retención de 14 archivos)
# =====================================================================
param(
  [int]$Retencion = 14
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot -Parent
$destino = Join-Path $raiz "respaldo"
New-Item -ItemType Directory -Force $destino | Out-Null

$fecha = Get-Date -Format "yyyyMMdd-HHmm"
$archivo = Join-Path $destino "finanx-$fecha.sql.gz"

Push-Location $raiz
try {
  Write-Host ">>> Generando respaldo ..."
  # Se comprime dentro del contenedor y se copia el binario ya comprimido:
  # redirigir con ">" en PowerShell escribiría texto UTF-16 y corrompería el gzip.
  docker compose exec -T db sh -c "pg_dump -U postgres -d finanx | gzip -9 > /tmp/finanx-respaldo.sql.gz"
  docker compose cp db:/tmp/finanx-respaldo.sql.gz "$archivo"
  docker compose exec -T db rm -f /tmp/finanx-respaldo.sql.gz | Out-Null

  $tam = (Get-Item $archivo).Length / 1KB
  Write-Host ("[OK] Respaldo: {0} ({1:N1} KB)" -f $archivo, $tam) -ForegroundColor Green

  Get-ChildItem $destino -Filter "finanx-*.sql.gz" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Retencion |
    Remove-Item -Force
} finally {
  Pop-Location
}

Write-Host "Recuerde copiar 'respaldo/' a un medio externo y probar la restauración." -ForegroundColor Yellow
