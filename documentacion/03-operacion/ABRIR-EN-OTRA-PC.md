# Abrir FINAN-X en otro equipo

Hay dos caminos, según lo que se quiera hacer.

| Camino | Para quién | Necesita internet |
|---|---|---|
| **A. Desde el repositorio** | Profesor, evaluador o desarrollador que clona el proyecto | Sí, la primera vez (para construir las imágenes) |
| **B. Paquete del Release** | Demostración en un equipo sin internet | No |

---

## A. Desde el repositorio (clonar y ejecutar)

Requisitos: **Docker Desktop** (Windows 10/11, macOS 12+ o Linux), 4 GB de RAM libres y el
puerto **8080** libre.

```bash
git clone https://github.com/Luis92561/aplicacion-finan-x.git
cd aplicacion-finan-x

# 1. Genere el .env con secretos aleatorios (no copie .env.example a mano)
powershell -ExecutionPolicy Bypass -File scripts\generar-env.ps1   # Windows
./scripts/generar-env.sh                                           # macOS / Linux

# 2. Levante el stack
docker compose up -d --build
```

La primera construcción tarda unos minutos (descarga las imágenes base de Node y nginx).

**Cuentas iniciales.** El repositorio no versiona claves. Genérelas una sola vez:

```bash
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs
```

El comando crea `primer-ingreso/usuarios-iniciales.json` con **contraseñas temporales
aleatorias** y las imprime en pantalla. Todas obligan a cambiarlas en el primer ingreso.

Cuando la API responda, abra <http://localhost:8080>:

```bash
curl -fsS http://localhost:8080/api/health
```

**Modo HTTPS.** Para ver TLS, HSTS y cabeceras de seguridad:

```bash
docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build
# https://localhost:8443  (certificado autofirmado: acepte la excepción)
```

---

## B. Paquete del Release (sin internet)

1. Descargue `FINAN-X-USB.zip` (~191 MB) desde la pestaña **Releases** del repositorio.
2. Verifique el SHA-256 publicado en las notas del Release:

   ```powershell
   Get-FileHash .\FINAN-X-USB.zip -Algorithm SHA256
   ```

3. Descomprímalo (clic derecho → *Extraer todo…*) en una carpeta local, por ejemplo
   `C:\FINAN-X-USB`.
4. Windows: doble clic en `ABRIR-FINAN-X.bat`. El lanzador genera el `.env`, carga las imágenes
   incluidas, levanta el stack, crea las cuentas y abre el navegador.

El paquete incluye las imágenes de Docker de la versión publicada, de modo que **no descarga
nada**. Requiere Docker Desktop instalado una sola vez (esa instalación sí necesita internet).

> El ZIP no se versiona en git porque supera el límite de 100 MB por archivo de GitHub. Se
> publica como adjunto del Release.

---

## Cuentas y primer ingreso

- Las cuentas se generan en el primer arranque con contraseñas temporales aleatorias.
- Se entregan en el acta de `primer-ingreso/`, que **no viaja en el repositorio** (contiene
  secretos de un solo uso).
- Todas deben cambiar la contraseña antes de usar el sistema.
- Un ADMIN puede restablecer claves desde **Usuarios**.

Detalle del cambio de método de ingreso: `04-seguridad/06-Retiro-Credenciales-Demo.md`.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| Docker no responde | Abra Docker Desktop y espere a "Engine running". |
| `Bind for 0.0.0.0:8080 failed` | Otro programa usa el 8080: ciérrelo o use el modo seguro. |
| `backend ... unhealthy` con una base anterior | `docker compose down -v` y vuelva a levantar; había un volumen de otra instalación. |
| `Falta JWT_SECRET` | Ejecute `cp .env.example .env` y complete los tres secretos. |
| El login pide cambiar la clave | Es correcto: primer ingreso. |
