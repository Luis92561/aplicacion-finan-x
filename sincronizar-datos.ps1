# =====================================================================
# FINAN-X · sincronizar-datos.ps1  (Windows)
# ---------------------------------------------------------------------
#  Exporta / importa la base de datos completa (contenida en Docker).
#  Cada computadora tiene SU propia base en Docker (volumen local);
#  este script te deja pasar los datos de una a otra con un archivo .sql.
#
#  USO:
#    .\sincronizar-datos.ps1 export    -> crea respaldo\finanx_AAAAMMDD.sql
#    .\sincronizar-datos.ps1 import    -> restaura el .sql más reciente
#                                         (¡OJO! borra los datos actuales primero:
#                                         docker compose down -v y luego up -d db)
# =====================================================================

param([string]$Modo)

Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path respaldo | Out-Null

switch ($Modo) {
    "export" {
        $file = "respaldo\finanx_$(Get-Date -Format 'yyyyMMdd_HHmm').sql"
        Write-Host "▶ Exportando la base a $file …" -ForegroundColor Green
        docker exec finanx-db pg_dump -U finanx -d finanx --clean --if-exists > $file
        if ($LASTEXITCODE -ne 0) { Write-Host "✗ Falló la exportación." -ForegroundColor Red; exit 1 }
        Write-Host "✔ Listo. Lleva este archivo a la otra computadora (USB, Drive…) y allá ejecuta:" -ForegroundColor Green
        Write-Host "    .\sincronizar-datos.ps1 import"
    }
    "import" {
        $file = Get-ChildItem respaldo\finanx_*.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $file) { Write-Host "✗ No hay respaldos en respaldo\"; exit 1 }
        Write-Host "▶ Restaurando $($file.Name) en la base de Docker …" -ForegroundColor Green
        Write-Host "  (Asegúrate de haber recreado la base: docker compose down -v y luego docker compose up -d db)"
        Get-Content $file.FullName | docker exec -i finanx-db psql -U finanx -d finanx
        if ($LASTEXITCODE -ne 0) { Write-Host "✗ Falló la importación." -ForegroundColor Red; exit 1 }
        Write-Host "✔ Datos importados. Levanta todo con: .\levantar.ps1" -ForegroundColor Green
    }
    default {
        Write-Host "Uso: .\sincronizar-datos.ps1 [export|import]"
        exit 2
    }
}