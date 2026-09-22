# FINAN-X · Instrucciones de Despliegue

> **Proyecto:** FINAN-X · **Desarrolladores:** Luis Alfredo Jaramillo Restrepo · Mayra Juliana Velez
> **Estado:** producción local verificada (suite e2e 99/99) · **Última actualización:** 20 de septiembre de 2026
>
> Este documento explica **cómo abrir FINAN-X en tu navegador**, tanto con Docker (recomendado) como en modo desarrollo (hot reload), y **en qué orden leer el código** del backend y del frontend. Complementa a `A_Explicacion_Proyecto.html`, `B_Guia_Tecnica_Desarrolladores.html` y `SPEC_*.md`.

---

## 1. Qué vas a conseguir

Al terminar tendrás corriendo en tu computador:

| Componente | Tecnología | Puerta de entrada |
|---|---|---|
| **Base de datos** | PostgreSQL 16 | `localhost:5432` (usuario/clave: `finanx`/`finanx`) |
| **API REST** | Node.js + Express | `http://localhost:4000/api/...` (salud: `/api/health`) |
| **Frontend (panel interno)** | React + Vite (nginx en Docker) | `http://localhost:8080` (Docker) o `http://localhost:5173` (desarrollo) |
| **Portal del cliente (autoservicio)** | La misma SPA (ruta `/portal`) | Misma URL, entrando con el usuario `cliente@finanx.test` |

Los datos demo se siembran automáticamente (el seed es idempotente).

---

## 2. Requisitos previos

- **Docker Desktop** (con Docker Compose). Necesario en ambas opciones porque la base de datos siempre corre en Docker.
  - macOS: abrir Docker Desktop y esperar a que diga *"Docker Desktop is running"*.
- **Node.js 20+ y npm** (solo para la opción B, modo desarrollo).
- Puertos libres: **4000** (API), **5432** (PostgreSQL), **8080 o 5173** (frontend). Si algo ocupa esos puertos, el arranque fallará o se moverá de puerto (Vite avisa en la terminal).

---

## 3. La forma rápida: script `levantar.sh`

En la raíz del proyecto está el script que hace **todo con un solo comando**:

```bash
cd "/Users/luis/Documents/Project Facturacion Finan-x"
./levantar.sh             # Docker Compose (recomendado)
./levantar.sh --dev       # Modo desarrollo (bd en Docker + npm run dev)
./levantar.sh --stop      # Detiene contenedores (conserva datos)
./levantar.sh --purge     # Detiene y borra los datos (down -v)
./levantar.sh -h          # Muestra la ayuda
```

Qué hace cada modo:

| Modo | Qué hace | Al final |
|---|---|---|
| `(sin argumento)` | `docker compose up -d --build`, espera a que la API esté sana (`/api/health`) | Abre `http://localhost:8080` en el navegador |
| `--dev` | Levanta PostgreSQL en Docker, instala dependencias si faltan, aplica el seed, arranca backend (`npm run dev`) y frontend (`npm run dev`) | Abre `http://localhost:5173`; Ctrl+C detiene todo |
| `--stop` | `docker compose down` (los datos quedan en el volumen `finanx_pgdata`) y mata procesos de desarrollo sueltos | — |
| `--purge` | `docker compose down -v` (borra la base de datos) y mata procesos de desarrollo sueltos | — |

Al terminar imprime siempre las **credenciales demo** (ver sección 6).

---

## 4. Opción A — Docker Compose (paso a paso)

> Recomendada: reproduce exactamente el entorno de producción con un solo comando.

```bash
cd "/Users/luis/Documents/Project Facturacion Finan-x"
docker compose up -d --build
```

1. Espera a que los tres contenedores queden arriba (la primera vez descarga/compila imágenes).
2. Comprueba la salud de la API (opcional):
   ```bash
   curl http://localhost:4000/api/health
   # → {"ok":true,"...":"ok",...}
   ```
3. Abre **http://localhost:8080** e inicia sesión con una de las credenciales de la sección 6.

Para detener conservando los datos: `docker compose down` (o `./levantar.sh --stop`).
Para borrar todo: `docker compose down -v` (o `./levantar.sh --purge`).

**Diagrama del stack:** el frontend (nginx) sirve la SPA y **hace de proxy** `/api → backend:4000`; el backend se conecta a `db:5432`; los datos viven en el volumen `finanx_pgdata`.

---

## 5. Opción B — Modo desarrollo (hot reload)

> Ideal para **modificar código** y ver los cambios al instante. Tres piezas: base de datos en Docker, backend y frontend con npm.

```bash
# Terminal 1 — base de datos
cd "/Users/luis/Documents/Project Facturacion Finan-x"
docker compose up -d db

# Terminal 2 — backend (API en http://localhost:4000)
cd backend
npm install         # solo la primera vez
npm run seed        # datos demo (idempotente) — solo la primera vez
npm run dev         # node --watch: se reinicia solo al guardar

# Terminal 3 — frontend (http://localhost:5173)
cd frontend
npm install         # solo la primera vez
npm run dev         # Vite con proxy /api → http://localhost:4000
```

Entonces abre **http://localhost:5173**. Vite recarga la página automáticamente al guardar cualquier archivo de `frontend/src/`.

La configuración del backend está en `backend/.env` (puerto 4000, credenciales de PostgreSQL `finanx`/`finanx`, secreto JWT de desarrollo). El proxy que comunica el frontend con la API está en `frontend/vite.config.js` (`/api → http://localhost:4000`).

> Si `5173` está ocupado, Vite elige otro puerto y lo avisa en la terminal; ajusta la URL en consecuencia.

---

## 6. Credenciales demo

| Rol | Usuario | Clave | Qué ve al entrar |
|---|---|---|---|
| Administrador | `admin@finanx.test` | `admin123` | Todo: usuarios, clientes, facturación, reportes, auditoría |
| Facturador | `facturador@finanx.test` | `facturador123` | Clientes, productos, pedidos, facturación |
| Cajero | `cajero@finanx.test` | `cajero123` | Pedidos, pagos en caja, notas de crédito |
| Supervisor | `supervisor@finanx.test` | `supervisor123` | Reportes, balances e historial |
| **Cliente (portal)** | `cliente@finanx.test` | `cliente123` | **Portal de autoservicio**: saldo, facturas, pagos en línea, OTP |

Con un usuario interno entras al **panel** (Dashboard → módulos). Con el usuario cliente entras directo al **portal del cliente** (ruta `/portal`).

---

## 7. Verificación

| Qué | Cómo |
|---|---|
| API sana | `curl http://localhost:4000/api/health` → `{"ok":true,...}` |
| Contenedores | `docker compose ps` → los tres `Up` (db/backend `healthy`) |
| Logs backend | `docker compose logs backend` |
| **Suite e2e (99 casos)** | con el backend corriendo: `cd backend && npm test` |
| Seed repetible | `cd backend && npm run seed` (idempotente, se puede correr varias veces) |

---

## 8. Orden recomendado para leer el código

Seguir el **flujo de negocio**: primero los datos, luego las reglas y la API (backend), después las pantallas (frontend).

### 8.1 Backend (`backend/` + `database/`)

| # | Archivo | Por qué leerlo aquí |
|---|---|---|
| 1 | `database/init.sql` | El **esquema completo**: tablas, relaciones y la vista `factura_saldo` (el saldo es calculado, nunca guardado). Todo lo demás lo usa. |
| 2 | `backend/src/config.js` · `src/db.js` | Configuración (variables de entorno) y el pool de conexión a PostgreSQL. |
| 3 | `backend/src/index.js` | **Punto de entrada**: monta helmet, CORS, rate-limit, rutas y el manejo de errores. Es el "mapa" general. |
| 4 | `backend/src/utils.js` | **El núcleo de reglas de negocio puras** (arquitectura hexagonal): `validarLuhn`, `validarDatosPago` (tarjeta/CVV/vencimiento), `round2`, `HttpError`. |
| 5 | `backend/src/middleware/` | Seguridad y cortes de flujo: `auth.js` (JWT, `requireRol`, `requireCliente`), `rateLimit.js` (anti fuerza bruta → 429), `audit.js`, `notificar.js` (OTP demo). |
| 6 | `backend/src/routes/` | **Los módulos de la API, en el orden del flujo**: `auth` → `clientes` → `productos` → `pedidos` → `facturas` → `pagos` → `notas-credito` → `reportes` → `auditoria` → `usuarios` → `mis` (portal del cliente, aislado). |
| 7 | `backend/src/seed.js` | Datos demo idempotentes (roles, usuarios, clientes, productos). |
| 8 | `backend/scripts/e2e.mjs` | (Opcional) Las **99 pruebas** end-to-end: cada una describe un comportamiento esperado. |

### 8.2 Frontend (`frontend/src/`)

| # | Archivo | Por qué leerlo aquí |
|---|---|---|
| 1 | `src/main.jsx` | Punto de entrada de la SPA (React + Router). |
| 2 | `src/api.js` | Cliente Axios: baseURL `/api`, inyecta el token JWT, hace logout en 401. |
| 3 | `src/auth.jsx` | Contexto de sesión (quién está logueado y su tipo: interno/cliente). |
| 4 | `src/App.jsx` | **Las rutas y guardas**: `RequireAuth`, `RequireInternal`, `RequireCliente`, `RequireRol` → qué pantallas existen y quién puede verlas. |
| 5 | `src/ui.jsx` + `styles.css` | Componentes reutilizables (`Money`, `Estado`, `Badge`, …) y el sistema visual. |
| 6 | `src/components/Layout.jsx` | Menú/navegación; `FacturaPreview.jsx` (previsualización e impresión de factura). |
| 7 | `src/pages/` | **Las pantallas en el mismo orden que la API**: `Login` → `Dashboard` → `Clientes` → `Productos` → `Pedidos` → `Facturas` → `Pagos` → `NotasCredito` → `Reportes` → `BalanceClientes` → `Auditoria` → `Usuarios`. |
| 8 | `src/pages/portal/` | El **portal del cliente**: `MiSaldo`, `MisFacturas`, `MisPagos`, `PagarModal`, `MisNotasCredito`, `MiHistorial`, `MisDatos`, `MisCompras`. |

**Consejo:** la tabla de trazabilidad de `README.md` (sección "Desarrollo") da el mapa directo *funcionalidad → archivo backend → archivo frontend* (p. ej. `RF-04 Registrar pagos → pagos.js → FacturaDetalle.jsx`).

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `docker: command not found` | Docker no instalado | Instala Docker Desktop y reinícialo |
| `Cannot connect to the Docker daemon` | Docker apagado | Abre Docker Desktop y espera a que esté *running* |
| `Address already in use` en 4000/5432 | Hay un proceso ocupando el puerto | Apágalo o cambia el puerto en `backend/.env` / compose |
| La API no responde tras levantar | El backend aún está inicializando | `docker compose logs backend`; espera unos segundos más |
| Portada/frontend carga pero la API da error | El proxy no encuentra el backend | En desarrollo verifica que `npm run dev` del backend siga vivo en la terminal 2 |
| La página no carga en `:8080` | El frontend no terminó de arrancar | `docker compose ps` y `docker compose logs frontend` |
| Vite usa otro puerto (p. ej. `:5174`) | `5173` estaba ocupado | Usa la URL que imprime Vite en la terminal |
| Las e2e fallan | Backend no corriendo o BD sin seed | Arranca backend y ejecuta `npm run seed` antes de `npm test` |

---

## 10. Referencias

- `README.md` — inicio rápido y trazabilidad funcionalidad → archivos.
- `documentacion/LEEME.md` — índice de toda la documentación.
- `levantar.sh` — script de arranque de este documento.
- `documentacion/SPEC_Tecnico.md` §9 — pasos de arranque y verificación del punto de vista técnico.