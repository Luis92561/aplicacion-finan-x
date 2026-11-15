# Genera el archivo .env con secretos aleatorios a partir de .env.example.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\generar-env.ps1
$ErrorActionPreference = "Stop"

$raiz = Split-Path $PSScriptRoot -Parent
$destino = Join-Path $raiz ".env"
$ejemplo = Join-Path $raiz ".env.example"

if (Test-Path $destino) {
  Write-Host "El archivo .env ya existe; no se sobrescribe."
  exit 0
}
if (-not (Test-Path $ejemplo)) {
  Write-Host "Falta .env.example en la raiz del proyecto."
  exit 1
}

function NuevoSecreto([int]$bytes) {
  $b = New-Object byte[] $bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($b)
  return [Convert]::ToBase64String($b).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

$texto = [System.IO.File]::ReadAllText($ejemplo)
$texto = [regex]::Replace($texto, '(?m)^JWT_SECRET=.*$', 'JWT_SECRET=' + (NuevoSecreto 48))
$texto = [regex]::Replace($texto, '(?m)^POSTGRES_PASSWORD=.*$', 'POSTGRES_PASSWORD=' + (NuevoSecreto 48))
$texto = [regex]::Replace($texto, '(?m)^APP_DB_PASSWORD=.*$', 'APP_DB_PASSWORD=' + (NuevoSecreto 48))

[System.IO.File]::WriteAllText($destino, $texto, [System.Text.UTF8Encoding]::new($false))

Write-Host "[OK] .env generado en $destino"
Write-Host "     Siguiente paso: docker compose up -d --build"
exit 0
