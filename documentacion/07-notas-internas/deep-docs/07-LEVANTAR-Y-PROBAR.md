# 7 · Levantar y probar la aplicación

> **Aviso de vigencia (v1.0.0).** Las credenciales de demostración de este documento son
> El retiro de esas credenciales se documenta en `documentacion/04-seguridad/06-Retiro-Credenciales-Demo.md`.
> históricas. En la versión 1.0.0 use las cuentas y claves temporales de
> primer-ingreso/Acta-Usuarios-Primer-Ingreso.pdf (cambio obligatorio al entrar).
> Ver documentacion/04-seguridad/04-Estado-de-Remediacion.md.


## Requisitos

| Requisito | Versión | Estado en esta máquina |
|---|---|---|
| Docker + Docker Compose | cualquiera reciente | ✅ Docker **29.8.0**, Compose **v5.5.1** — pero el daemon no era accesible desde el entorno de trabajo (ver nota al final) |
| Node.js | **20+** | ✅ **v24.21.0** |
| npm | — | ✅ **11.19.0** |

`node_modules` **no está instalado** en `backend/` ni en `frontend/`. La vía rápida no lo necesita
(lo hace Docker dentro de los contenedores); solo el modo desarrollo lo requiere.

## Opción A — Todo con Docker (la vía recomendada)

### Script de arranque (Windows)

```powershell
.\levantar.ps1              # Levanta todo, espera a la API y abre el navegador
.\levantar.ps1 --stop       # Detiene los contenedores (CONSERVA los datos)
.\levantar.ps1 --purge      # Detiene y BORRA los datos (docker compose down -v)
```

Si PowerShell bloquea la ejecución la primera vez:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

### Script de arranque (macOS / Linux / Git Bash)

```bash
./levantar.sh              # Docker + abre el navegador
./levantar.sh --dev        # Modo desarrollo (hot reload)
./levantar.sh --stop       # Detener
./levantar.sh --purge      # Detener y borrar datos
```

### Atajo

```powershell
.\iniciar-app.ps1          # Llama a levantar.ps1 y abre el navegador
.\iniciar-app.ps1 stop     # Detiene
.\iniciar-app.ps1 url      # Solo abre el navegador (si ya está corriendo)
```

### Manual (un solo comando)

```bash
docker compose up -d --build
```

**Qué hace `levantar.ps1` paso a paso** (útil para depurar):
1. Comprueba que el comando `docker` exista.
2. Ejecuta `docker info` para ver si el daemon responde; si no, **intenta abrir Docker Desktop** y
   espera hasta 30 × 2 s = 60 s.
3. `docker compose up -d --build`.
4. Polling a `http://localhost:4000/api/health` hasta 40 × 3 s = **120 s**.
5. Imprime las credenciales demo y abre `http://localhost:8080`.

### URLs resultantes

| Servicio | URL |
|---|---|
| **Frontend** (panel + portal) | http://localhost:8080 |
| **API** (directa) | http://localhost:4000 |
| **API** (vía proxy nginx) | http://localhost:8080/api |
| **Health** | http://localhost:4000/api/health |
| **PostgreSQL** | `localhost:5432` (finanx / finanx) |

### Detener / limpiar

```bash
docker compose down       # detiene; los datos persisten en el volumen finanx_pgdata
docker compose down -v    # detiene Y BORRA los datos
```

> ⚠️ Los puertos **4000** y **5432** los ocupa el stack. Si tienes servidores de desarrollo
> corriendo, apágalos antes.

## Opción B — Modo desarrollo (hot reload)

Tres terminales:

```bash
# 1. Base de datos (solo Postgres en Docker)
docker compose up -d db

# 2. Backend
cd backend
npm install
npm run seed     # crea roles, usuarios demo, clientes y productos (idempotente)
npm run dev      # http://localhost:4000  (API en /api) — usa node --watch

# 3. Frontend
cd frontend
npm install
npm run dev      # http://localhost:5173  (proxy /api → localhost:4000)
```

En modo desarrollo el frontend vive en **5173** y Vite hace el proxy de `/api` al backend en 4000.
El backend lee `backend/.env` (ya existe):

```
PORT=4000
PGHOST=localhost
PGPORT=5432
PGUSER=finanx
PGPASSWORD=finanx
PGDATABASE=finanx
JWT_SECRET=finanx-dev-secret-cambiar-en-produccion
JWT_EXPIRES=8h
```

> 🔒 `JWT_SECRET` aquí es un valor de **desarrollo**. En producción hay que cambiarlo por uno de ≥32
> caracteres o el backend **se niega a arrancar** (`process.exit(1)` en `config.js`).
> Hay un `backend/.env.example` como plantilla, y `.gitignore` excluye `.env` — correcto.

### Scripts de npm disponibles

**backend:**

| Script | Comando | Para qué |
|---|---|---|
| `npm run dev` | `node --watch src/index.js` | Desarrollo con recarga automática |
| `npm start` | `node src/index.js` | Producción |
| `npm run seed` | `node src/seed.js` | Carga datos demo (idempotente) |
| `npm test` | `node scripts/e2e.mjs` | **Suite e2e de 154 comprobaciones** |

**frontend:**

| Script | Comando |
|---|---|
| `npm run dev` | `vite` |
| `npm run build` | `vite build` |
| `npm run preview` | `vite preview` |

## Credenciales demo

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@[correo de prueba]` | `[clave retirada]` |
| Facturador | `facturador@finanx.test` | `facturador123` |
| Cajero | `cajero@finanx.test` | `cajero123` |
| Supervisor | `supervisor@finanx.test` | `supervisor123` |
| Cliente (portal) | `cliente@finanx.test` | `cliente123` |

**Tarjeta de prueba válida** (cumple el algoritmo de Luhn): `4111111111111111` (VISA),
vencimiento `12/30`, CVV `123`. Solo se guardan los últimos 4 dígitos.

## Pruebas automatizadas

```bash
cd backend
npm run seed   # una vez, para crear datos demo
npm test       # suite e2e (154 comprobaciones) — REQUIERE el backend corriendo
```

La suite es **e2e contra una API viva**, no tests unitarios. La "definición de terminado" del
proyecto es tener la suite en verde.

> ⚠️ **Aviso importante de la propia documentación** (`B_Guia_Tecnica_Desarrolladores.html` §12):
> los contadores de **rate limit** (login, registro, recuperación) viven **en memoria del proceso** y
> comparten una ventana de 15 min entre corridas. Si re-ejecutas `npm test` varias veces seguidas y
> ves **429** en las secciones públicas, reinicia el backend (`docker compose restart backend`) o
> espera a que venza la ventana.

## Orden recomendado para leer el código

El proyecto sugiere un orden. Coincido, y lo ajusto un poco:

1. `README.md` — el panorama y las reglas de negocio.
2. `database/init.sql` — el modelo de datos y la vista `factura_saldo`. **Empieza aquí.**
3. `backend/src/config.js` + `backend/src/index.js` — configuración y montaje de Express.
4. `backend/src/middleware/auth.js` — cómo funciona el JWT y el RBAC.
5. `backend/src/utils.js` — el núcleo de dominio.
6. `backend/src/routes/pedidos.js` → `facturas.js` → `pagos.js` → `notas-credito.js` — **el flujo de
   negocio en orden** (es la mejor forma de entender el sistema).
7. `backend/src/routes/mis.js` — el portal aislado.
8. `frontend/src/App.jsx` — el mapa de rutas y las guardas.
9. `frontend/src/api.js` + `auth.jsx` — la sesión y el cliente HTTP.
10. Las páginas, siguiendo el mismo flujo de negocio.

## Solución de problemas

| Síntoma | Causa probable / solución |
|---|---|
| `docker: permission denied ... npipe:////./pipe/dockerDesktopLinuxEngine` | Docker Desktop no está abierto, o el entorno no tiene acceso al named pipe. Abre Docker Desktop. **(Ocurre cuando el daemon no es accesible — ver nota.)** |
| "El backend no respondió a tiempo" | `docker compose logs backend`. Puede ser que Postgres aún no esté sano. |
| **429** en `npm test` | Rate limit en memoria. Reinicia el backend o espera 15 min. |
| El esquema no se aplica | `init.sql` **solo corre la primera vez** que se crea el volumen. Usa `down -v` o aplica el SQL a mano. |
| `JWT_SECRET` rechazado | `NODE_ENV=production` exige ≥32 caracteres. |
| Recargar `/facturas/12` da 404 | nginx ya lo resuelve con `try_files ... /index.html`; en dev lo resuelve Vite. Si falla, revisa la config de tu servidor. |
| El OTP no llega por correo/SMS | Es **demo a propósito**: con `OTP_RETORNO_DEMO=on` el código vuelve en la respuesta HTTP y se imprime por consola. |

## Nota sobre el entorno de ejecución

Al comprobar el estado de los contenedores, el entorno devolvió:

```
docker: permission denied while trying to connect to the docker API at
npipe:////./pipe/dockerDesktopLinuxEngine
```

Esto **no significa que Docker esté roto**: significa que el **entorno de trabajo no tiene acceso al
named pipe de Docker Desktop**. Es una limitación del entorno, no del proyecto. `docker --version` y
`docker compose version` sí responden (son consultas locales al CLI), pero cualquier operación contra
el daemon requiere permisos que ese entorno no concedía.

**Consecuencia:** en esa primera pasada no se levantó la aplicación ni se ejecutó la suite e2e, así
que todo lo descrito viene de **leer el código y la documentación**, no de haber visto la app
funcionando. Las comprobaciones en ejecución llegaron después, con el entorno habilitado (ver
`09-OBSERVACIONES-Y-RIESGOS.md`).

---

*Siguiente: [`08-ESTADO-GIT-Y-GITHUB.md`](08-ESTADO-GIT-Y-GITHUB.md) para el tema del repositorio.*
