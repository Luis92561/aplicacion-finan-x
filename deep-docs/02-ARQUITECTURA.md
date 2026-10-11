# 2 · Arquitectura

## Estilo arquitectónico: hexagonal (puertos y adaptadores)

El proyecto declara explícitamente una **arquitectura hexagonal**. La idea: el **núcleo** con las
reglas de negocio no conoce la tecnología; los **puertos** definen los canales y los **adaptadores**
los implementan. Así, cambiar de base de datos, de proveedor de SMS o de interfaz no debería obligar
a tocar las reglas.

| Pieza hexagonal | Implementación real en el código |
|---|---|
| **Núcleo de dominio** | `backend/src/utils.js` → `validarLuhn`, `derivarTipoTarjeta`, `validarDatosPago`, `HttpError`. Más las invariantes: sin sobrepago, 1 pedido → 1 factura, totales y saldo siempre calculados, reglas del OTP (6 dígitos, 10 min, 5 intentos, un solo uso). |
| **Puerto de entrada HTTP** | `routes/*.js` (interno), `routes/mis.js` (portal aislado), `routes/auth.js` (público) |
| **Adaptadores de entrada** | Express + guardas `requireAuth` / `requireRol` / `requireCliente` + limitadores por IP |
| **Puerto de salida: persistencia** | `db.js` (pool de `pg`, SQL parametrizado); la vista `factura_saldo` como proyección de lectura |
| **Puerto de salida: notificaciones** | `middleware/notificar.js` → `enviarCodigo()`: adaptador demo por consola, extensible a Twilio/nodemailer |
| **Puerto de salida: seguridad** | Adaptadores `bcryptjs` (hash de claves y OTP) y `jsonwebtoken` (JWT 8 h) |

> 💡 **Opinión honesta:** la arquitectura hexagonal aquí está aplicada de forma **pragmática y
> ligera**, no dogmática. No hay una carpeta `domain/` con entidades e interfaces de repositorio
> separadas de la infraestructura — es un monolito Express de 3 capas (rutas → SQL → PostgreSQL)
> con buenas guardas y una utilidad de dominio aislada. Está **bien organizado y es muy legible**,
> pero quien espere puertos/interfaces formales con inyección de dependencias no los va a encontrar.
> La documentación la presenta con más pureza de la que el código tiene.

## Los 3 servicios y cómo se conectan

```
                    ┌─────────────────────────────────────┐
   navegador ──────►│  frontend  (nginx, puerto 80)       │
   :8080            │  contenedor: finanx-frontend        │
                    │                                     │
                    │  /       → SPA React (index.html)   │
                    │  /api/   → proxy_pass a backend:4000│
                    └──────────────┬──────────────────────┘
                                   │ red interna de Docker
                    ┌──────────────▼──────────────────────┐
                    │  backend  (Node/Express, :4000)     │
                    │  contenedor: finanx-backend         │
                    │  pool pg (máx 10 conexiones)        │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │  db  (PostgreSQL 16 alpine)         │
                    │  contenedor: finanx-db  :5432       │
                    │  volumen: finanx_pgdata             │
                    │  init.sql → docker-entrypoint-initdb│
                    └─────────────────────────────────────┘
```

| Servicio | Contenedor | Puerto host | Imagen / build |
|---|---|---|---|
| `db` | `finanx-db` | **5432** | `postgres:16-alpine` |
| `backend` | `finanx-backend` | **4000** | build `./backend` |
| `frontend` | `finanx-frontend` | **8080 → 80** | build `./frontend` (nginx) |

### Detalles de orquestación (`docker-compose.yml`)

- **`db`**: credenciales `finanx` / `finanx` / BD `finanx`. Monta `./database/init.sql` en
  `/docker-entrypoint-initdb.d/init.sql` (**solo lectura**) — Postgres lo ejecuta automáticamente
  **la primera vez que se crea el volumen**. Volumen persistente `finanx_pgdata`.
  *Healthcheck:* `pg_isready -U finanx -d finanx`, cada 5 s, 12 reintentos.
- **`backend`**: `depends_on: db: condition: service_healthy` — no arranca hasta que Postgres
  responde. Healthcheck con un `fetch` a `/api/health` cada 10 s. `restart: unless-stopped`.
  `NODE_ENV=production` por defecto → **exige `JWT_SECRET` de ≥32 caracteres** o el proceso muere.
  El valor por defecto en compose es `finanx-prod-secret-cambiar-por-una-clave-segura-de-32-caracteres`.
- **`frontend`**: `depends_on: backend: condition: service_healthy`. Sin healthcheck propio.

> ⚠️ **Nota:** el `init.sql` solo se ejecuta en la **primera** creación del volumen. Si necesitas
> reaplicarlo hay que hacer `docker compose down -v` (borra datos) o ejecutar el SQL a mano. Por eso
> existen las migraciones sueltas en `database/` (ver [`03-BASE-DE-DATOS.md`](03-BASE-DE-DATOS.md)).

### Proxy y CORS

Hay **dos capas** que resuelven el `"/api"`:

1. **nginx** (`frontend/nginx.conf`, en Docker): `location /api/` → `proxy_pass http://backend:4000`,
   reenviando `X-Real-IP` y `X-Forwarded-For`. Además `try_files $uri $uri/ /index.html` para que la
   SPA funcione al recargar rutas profundas (ej. `/facturas/12`), y `gzip` activado.
2. **Vite** (`frontend/vite.config.js`, en modo desarrollo): `server.proxy['/api']` →
   `http://localhost:4000` con `changeOrigin: true`.

Por eso el frontend **siempre** llama a rutas relativas `'/api'` (ver `api.js`: `baseURL: '/api'`) y
funciona igual en los dos entornos.

En el backend, CORS usa **lista blanca** (`config.corsOrigins`), por defecto
`http://localhost:5173`, `http://localhost:8080`, `http://127.0.0.1:5173`, `http://127.0.0.1:8080`.
Ojo con el detalle fino: si el origen no está permitido, **no se devuelve error**, simplemente se
responde **sin** la cabecera `Access-Control-Allow-Origin` y es el navegador el que bloquea
(`cb(null, false)`). Las peticiones sin cabecera `Origin` (curl, Node, mismo origen) se aceptan.
Además `app.set('trust proxy', 1)` para que `req.ip` sea la IP real detrás de nginx (importante para
los rate limits por IP).

## Mapa de carpetas

```
Project Facturacion Finan-x/
├── README.md                    ← documento maestro (232 líneas, muy completo)
├── docker-compose.yml           ← orquestación de los 3 servicios
├── .gitignore                   ← preparado, pero el repo nunca se inicializó
│
├── database/                    ← ESQUEMA (fuente única de verdad)
│   ├── init.sql                 ← 11 tablas + vista factura_saldo + índices (251 líneas)
│   ├── migracion_notas_credito.sql
│   └── migracion_recuperacion_contrasena.sql
│
├── backend/                     ← API REST
│   ├── package.json             ← 8 dependencias, scripts: dev / start / seed / test
│   ├── Dockerfile
│   ├── .env / .env.example
│   ├── scripts/e2e.mjs          ← suite e2e de 99 casos
│   └── src/
│       ├── index.js             ← arranque de Express, montaje de routers, manejo de errores
│       ├── config.js            ← TODA la configuración por variables de entorno
│       ├── db.js                ← pool de pg (máx 10)
│       ├── seed.js              ← datos demo idempotentes
│       ├── utils.js             ← núcleo de dominio (Luhn, tarjetas, validaciones, HttpError)
│       ├── middleware/          ← auth.js · audit.js · notificar.js · rateLimit.js
│       └── routes/              ← 11 routers (auth, usuarios, clientes, productos, pedidos,
│                                   facturas, pagos, notas-credito, reportes, auditoria, mis)
│
├── frontend/                    ← SPA React
│   ├── package.json · vite.config.js · index.html · nginx.conf · Dockerfile
│   └── src/
│       ├── main.jsx · App.jsx   ← mapa de rutas y guardas
│       ├── api.js               ← cliente axios + interceptores
│       ├── auth.jsx             ← Context de sesión
│       ├── ui.jsx · styles.css  ← sistema visual
│       ├── components/          ← Layout.jsx · FacturaPreview.jsx
│       └── pages/               ← 14 páginas internas + portal/ (8 archivos)
│
├── mockups/                     ← 14 wireframes HTML + PDF (prototipos, NO la app real)
├── documentacion/               ← PDFs, HTMLs, specs MD, diagramas .puml/.svg
├── capturas/                    ← 7 capturas PNG + 3 scripts .cjs de captura
└── deep-docs/                   ← 📁 ESTA CARPETA (notas del agente, no es código)
```

## Cómo arranca el backend (`src/index.js`)

Orden real de la cadena de middlewares:

1. `app.set('trust proxy', 1)`
2. `helmet()` — cabeceras de seguridad (CSP, X-Content-Type-Options, X-Frame-Options…)
3. `cors({ origin(...) })` — lista blanca
4. `express.json()` — parseo de body
5. `GET /api/health` → `{ ok: true, servicio: 'FINAN-X API', hora }`
6. Los 11 routers montados bajo `/api/*` (nota: `misRouter` se monta en **`/api`**, no en `/api/mis`,
   porque sus rutas internas ya son `/mis-datos`, `/mi-saldo`, etc.)
7. **404** → `{ error: "Ruta no encontrada: METHOD /path" }`
8. **Manejador de errores** → si es `HttpError` responde con su `status` y `message`; cualquier otro
   error se registra como "Error no controlado" y devuelve **500** con mensaje genérico
   ("Error interno del servidor") para no filtrar detalles internos.

## Configuración (todo por entorno)

`backend/src/config.js` centraliza **toda** la configuración. Es el archivo a leer primero si algo
se comporta distinto entre entornos:

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `4000` | Puerto de la API |
| `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` | `localhost/5432/finanx/finanx/finanx` | Conexión a Postgres |
| `JWT_SECRET` | `finanx-dev-secret` | Firma de tokens. **En producción exige ≥32 caracteres o `process.exit(1)`** |
| `JWT_EXPIRES` | `8h` | Vida del token |
| `CORS_ORIGINS` | 4 orígenes localhost | Lista blanca de CORS |
| `LOGIN_MAX_FAILURES` | `5` | Intentos de login fallidos por IP antes de 429 (ventana 15 min) |
| `REGISTRO_RATE_LIMIT` | `20` | Máx. autoregistros por IP / hora |
| `OTP_RETORNO_DEMO` | `'on'` | **Si está `on`, el código OTP vuelve en la respuesta HTTP** (solo demo) |
| `OTP_VALIDEZ_MINUTOS` | `10` | Caducidad del OTP |
| `OTP_MAX_INTENTOS` | `5` | Intentos por OTP |
| `RECUPERAR_RATE_LIMIT` | `40` | Máx. intentos de recuperación por IP / 15 min |

En desarrollo, si no hay `JWT_SECRET`, avisa por consola y usa el secreto de desarrollo. En
producción **no arranca** sin un secreto fuerte. Buen detalle de seguridad.

## Autenticación y autorización (resumen)

- **JWT** firmado con `config.jwtSecret`, expira en 8 h, se envía como `Authorization: Bearer <token>`.
- `requireAuth` verifica el token y deja el payload en `req.user`.
- El payload distingue **`tipo: 'interno'`** (con `rol`) de **`tipo: 'cliente'`** (con `clienteId`).
- `requireRol(...roles)` exige usuario interno **y** que el rol esté en la lista.
- `requireCliente` exige `tipo: 'cliente'` **y** que exista `clienteId` en el token.

En el frontend, `api.js` guarda el token en `localStorage` (`fx_token`) y lo inyecta en cada
petición; ante un **401** limpia `fx_token` y `fx_user` y redirige a `/login` (salvo que ya estés ahí).

---

*Siguiente: [`03-BASE-DE-DATOS.md`](03-BASE-DE-DATOS.md) para el modelo de datos.*
