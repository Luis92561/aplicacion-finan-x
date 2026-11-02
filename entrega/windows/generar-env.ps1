# Genera el archivo .env con secretos aleatorios si no existe.
# Lo llama ABRIR-FINAN-X.bat; no requiere configuración manual.
$ErrorActionPreference = "Stop"
$raiz = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$destino = Join-Path $raiz ".env"

if (Test-Path $destino) {
  Write-Host "El archivo .env ya existe; se conserva."
  exit 0
}

function NuevoSecreto([int]$bytes) {
  $b = New-Object byte[] $bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($b)
  return [Convert]::ToBase64String($b).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

$contenido = @"
# Generado automáticamente por FINAN-X. No compartir ni versionar.
JWT_SECRET=$(NuevoSecreto 48)
JWT_EXPIRES=2h
POSTGRES_PASSWORD=$(NuevoSecreto 24)
APP_DB_PASSWORD=$(NuevoSecreto 24)
NODE_ENV=production
DOMAIN=localhost
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
COOKIE_SECURE=off
OTP_RETORNO_DEMO=off
REGISTRO_ABIERTO=off
SEED_DEMO=false
LOGIN_MAX_FAILURES=5
LOGIN_LOCK_MINUTES=15
BCRYPT_ROUNDS=12
"@

[System.IO.File]::WriteAllText($destino, $contenido, [System.Text.UTF8Encoding]::new($false))
Write-Host "[OK] Configuración creada en $destino"
exit 0
