# =====================================================================
# FINAN-X · Genera un certificado TLS autofirmado para la demo local
#
# Uso:  .\deploy\generar-certificado.ps1
# Crea: certs\fullchain.pem y certs\privkey.pem  (válidos 825 días)
#
# Usa la imagen de PostgreSQL (ya trae openssl) para no depender de que
# openssl esté instalado en Windows.
# =====================================================================
param(
  [string]$Dominio = "localhost"
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot -Parent
$certs = Join-Path $raiz "certs"
New-Item -ItemType Directory -Force $certs | Out-Null

Write-Host ">>> Generando certificado autofirmado para $Dominio ..."
docker run --rm -v "${certs}:/certs" postgres:16-alpine sh -c `
  "openssl req -x509 -nodes -newkey rsa:2048 -days 825 -keyout /certs/privkey.pem -out /certs/fullchain.pem -subj '/CN=$Dominio' -addext 'subjectAltName=DNS:$Dominio,IP:127.0.0.1'"

if (Test-Path (Join-Path $certs "fullchain.pem")) {
  Write-Host "[OK] Certificados en $certs" -ForegroundColor Green
  Write-Host "     Modo seguro:  docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build"
  Write-Host "     URL:          https://localhost:8443"
} else {
  Write-Host "[X] No se pudo generar el certificado. Verifique que Docker esté corriendo." -ForegroundColor Red
  exit 1
}
