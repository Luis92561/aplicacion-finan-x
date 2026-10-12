# FINAN-X

Aplicación independiente de **facturación y pagos** — Frontend React, Backend Node.js/Express y base de datos PostgreSQL.

## Estructura

```
.
├── database/            # Esquema SQL (docker-entrypoint-initdb.d)
├── backend/             # API REST (Node.js + Express + pg) + pruebas e2e + Dockerfile
├── frontend/            # SPA (React + Vite + React Router + Axios) + Dockerfile + nginx
├── mockups/             # Prototipos de demostración para el cliente (wireframes HTML)
├── documentacion/       # Toda la documentación: guías (PDF/HTML) + specs (MD) + diagramas (.puml/.svg)
├── docker-compose.yml   # Stack completo: db + backend + frontend
└── levantar.sh          # Script de arranque (Docker o modo desarrollo) — abre el navegador solo
```

## Requisitos

- Docker (con Docker Compose)
- Node.js 20+ y npm (solo para modo desarrollo)

## ⚠️ Configuración obligatoria: `JWT_SECRET`

El backend **no arranca sin un `JWT_SECRET` propio**. El secreto firma los tokens de sesión: con uno
conocido se pueden fabricar tokens y suplantar a cualquier usuario, incluido el administrador.

Genere uno y guárdelo en un archivo `.env` en la **raíz del proyecto** (está en `.gitignore`, así que
no se sube al repositorio):

```bash
# 1. Generar el secreto
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 2. Guardarlo en .env (raíz del proyecto) — lo lee docker compose
echo "JWT_SECRET=<el secreto generado>" > .env
```

El backend **rechaza** arrancar si el secreto falta, mide menos de 32 caracteres o contiene alguno de
los valores de ejemplo que aparecen en el repositorio. Para el modo desarrollo, haga lo mismo en
`backend/.env` (hay una plantilla comentada en `backend/.env.example`).

## Puesta en marcha

> **Forma rápida:** ejecuta `./levantar.sh` desde la raíz: levanta todo con Docker y abre el navegador automáticamente. `./levantar.sh --dev` usa modo desarrollo (hot reload); `--stop` y `--purge` detienen el stack. Guía completa en `documentacion/Instrucciones_Despliegue.md`.

### Opción A — Todo en contenedores (un solo comando)

```bash
docker compose up -d --build
```

Levanta los tres servicios: PostgreSQL, API REST y frontend servido por nginx.

| Servicio   | URL                     | Contenedor      |
|------------|-------------------------|-----------------|
| Frontend   | http://localhost:8080   | `finanx-frontend` |
| API        | http://localhost:8080/api (proxy) o http://localhost:4000 | `finanx-backend` |
| PostgreSQL | localhost:5432 (finanx/finanx) | `finanx-db` |

- El seed demo se ejecuta automáticamente al arrancar el backend (es idempotente).
- Para detener: `docker compose down` (los datos persisten en el volumen `finanx_pgdata`).
- Para borrar datos: `docker compose down -v`.
- Los puertos 4000 (backend) y 5432 (db) son usados por el stack; apaga los servidores de desarrollo si los tienes corriendo.

### Opción B — Modo desarrollo (hot reload)

```bash
# 1. Base de datos
docker compose up -d db

# 2. Backend
cd backend
npm install
npm run seed     # crea roles, usuarios demo, clientes y productos
npm run dev      # http://localhost:4000  (API en /api)

# 3. Frontend
cd frontend
npm install
npm run dev      # http://localhost:5173  (proxy /api → localhost:4000)
```

## Credenciales demo

| Rol            | Correo                    | Contraseña     |
|----------------|---------------------------|----------------|
| Administrador  | `admin@finanx.test`       | `admin123`     |
| Facturador     | `facturador@finanx.test`  | `facturador123`|
| Cajero         | `cajero@finanx.test`      | `cajero123`    |
| Supervisor     | `supervisor@finanx.test`  | `supervisor123`|
| Cliente        | `cliente@finanx.test`     | `cliente123`   |

## API REST (resumen)

```
POST   /api/auth/login              Iniciar sesión (interno o cliente)
POST   /api/auth/registro           Autoregistro público de clientes (datos + credenciales)
GET    /api/clientes                Listar/buscar clientes
POST   /api/clientes                Crear cliente (valida duplicados por identificación)
GET    /api/clientes/:id            Detalle de cliente
PUT    /api/clientes/:id            Actualizar cliente
PATCH  /api/clientes/:id/estado     Activar / inactivar
POST   /api/clientes/:id/cuenta     Crear cuenta de acceso del cliente

GET    /api/productos               Listar/buscar productos
POST   /api/productos               Crear producto (código único)
PUT    /api/productos/:id           Actualizar producto
PATCH  /api/productos/:id/estado    Activar / inactivar

GET    /api/pedidos                 Listar pedidos
POST   /api/pedidos                 Crear pedido (cálculos en servidor)
GET    /api/pedidos/:id             Detalle con líneas
PUT    /api/pedidos/:id             Modificar (solo BORRADOR)
PATCH  /api/pedidos/:id/estado      Confirmar / cancelar

GET    /api/facturas                Listar facturas (con saldo)
POST   /api/facturas                Generar factura desde pedido { pedidoId }
GET    /api/facturas/:id            Detalle de factura
GET    /api/facturas/:id/pagos      Pagos de la factura
GET    /api/facturas/:id/saldo      Saldo pendiente
POST   /api/facturas/:id/anular     Anular factura (solo sin pagos) { motivo }

POST   /api/pagos                   Registrar pago (no supera el saldo)
GET    /api/pagos                   Listar pagos

GET    /api/notas-credito           Listar/buscar notas de crédito (devoluciones)
POST   /api/notas-credito           Crear nota de crédito { facturaId, valor, motivo } (no devuelve más de lo pagado)
GET    /api/notas-credito/:id       Detalle de nota de crédito
POST   /api/notas-credito/:id/anular Anular nota de crédito (lógica, exige motivo)

GET    /api/reportes/resumen        Estadísticas del dashboard
GET    /api/reportes/facturacion    Reporte de facturación por rango de fechas
GET    /api/reportes/historial/:clienteId   Historial financiero de un cliente
GET    /api/reportes/balance-clientes      Dashboard de saldos por cliente (cuentas por cobrar)

GET    /api/clientes/:id/resumen-correo    Texto del estado financiero del cliente (asunto + cuerpo para mailto)

GET    /api/auditoria               Historial de operaciones (auditoría)
GET    /api/usuarios                Gestión de usuarios internos (solo ADMIN)

-- Portal del cliente (aislado por clienteId de la sesión) --
GET    /api/mis-datos
GET    /api/mis-pedidos
GET    /api/mis-facturas
GET    /api/mis-pagos
GET    /api/mis-notas-credito
GET    /api/mi-saldo
GET    /api/mi-historial
POST   /api/mis-pagos               Abonar/pagar una factura propia desde el portal
```

## Pruebas automatizadas

```bash
cd backend
npm run seed   # una vez, para crear datos demo
npm test       # suite e2e (139 casos) — requiere backend corriendo
```

## Documentación

Toda la documentación del proyecto está centralizada en la carpeta **`documentacion/`** (ver su `LEEME.md` para el índice):

| Documento | Para quién | Formato |
|---|---|---|
| `A_Explicacion_Proyecto.pdf/.html` | Cualquier persona, sin necesidad de conocimientos técnicos | PDF/HTML |
| `B_Guia_Tecnica_Desarrolladores.pdf/.html` | Futuros desarrolladores del proyecto | PDF/HTML |
| `FINAN-X_Documentacion.pdf/.html` | Documentación técnica completa (arquitectura, modelo de datos, API, casos de uso, seguridad, pruebas) | PDF/HTML |
| `SPEC_Funcional.md` · `SPEC_Tecnico.md` · `PLAN_Creacion.md` | Reconstrucción del proyecto con Claude Code/OpenCode | Markdown |
| `mockups/` (raíz) | Prototipos de demostración para el cliente (`mockups/index.html`) | HTML |
| `diagrams/*.puml` y `*.svg` | Diagramas PlantUML fuente y renderizados | SVG |

Para recrear los diagramas: `bash documentacion/diagrams/render.sh`.

El **backlog de historias de usuario** (22 historias, formato «Como…, quiero…, para…», con criterios de aceptación y trazabilidad a fases) está en `documentacion/SPEC_Funcional.md` §2.3.

## Desarrollo (metodología y arquitectura)

El proyecto se desarrolló con **metodología ágil y entregas semanales**: 6 sprints entre el 21 de agosto y el 28 de septiembre de 2026 (entregas los viernes 28 ago · 4 · 11 · 18 · 25 sep y cierre final el lunes 28 sep), cada uno cerrado con una versión ejecutable y verificada (la suite e2e verde es la definición de terminado). El cronograma visual está en `documentacion/diagrams/FINAN_X_Diagrama_Gantt.svg` y el detalle `fases → semanas` en `documentacion/PLAN_Creacion.md`.

La arquitectura es **hexagonal (puertos y adaptadores)**: un núcleo con las reglas de negocio puras (sin sobrepago, saldo calculado, validaciones de pago y de OTP), un puerto de entrada HTTP (API REST con guardas de autenticación/rol), y puertos de salida hacia PostgreSQL (`db.js` + vista `factura_saldo`), notificaciones (`notificar.js` para el OTP, demo por consola y extensible a Twilio/nodemailer) y seguridad (bcrypt + JWT). Ver `documentacion/B_Guia_Tecnica_Desarrolladores.html` `§2.1` y `SPEC_Tecnico.md` `§1.1`.

## Reglas de negocio aplicadas

- Cliente duplicado por tipo + número de identificación → rechazado (409).
- Cálculos financieros (subtotal, impuestos, total) siempre en el servidor.
- Los pagos no pueden superar el saldo pendiente de la factura.
- Estado de pago calculado: PENDIENTE / PAGO_PARCIAL / PAGADA.
- Anulación de factura es lógica y requiere motivo; **se impide si tiene pagos**.
- Un pedido facturado no se puede modificar ni volver a facturar (1 factura activa por pedido).
- Nota de crédito: solo sobre facturas ACTIVA, exige motivo y **no devuelve más de lo pagado**; anulación lógica con motivo. Al crearla, el valor devuelto revierte el pago y aumenta el saldo de la factura.
- Portal del cliente: el `clienteId` se toma del token autenticado; no se acepta un `clienteId` del navegador.
- La búsqueda de clientes cubre nombre/razón social, número de documento y NIT (`GET /api/clientes?q=`).
- Todas las operaciones sensibles quedan registradas en `auditoria`.

## Trazabilidad requisitos ↔ implementación

### Requisitos funcionales (documento de requisitos)

| Requisito | Implementación |
|---|---|
| RF-01 Generar facturas | `POST /api/facturas` → `backend/src/routes/facturas.js` · UI: `frontend/src/pages/PedidoDetalle.jsx`, `Facturas.jsx` |
| RF-02 Consultar facturas | `GET /api/facturas`, `GET /api/facturas/:id` → `facturas.js` · `frontend/src/pages/Facturas.jsx` |
| RF-03 Anular facturas | `POST /api/facturas/:id/anular` (lógica, exige motivo, bloqueada con pagos) → `facturas.js` · `FacturaDetalle.jsx` |
| RF-04 Registrar pagos | `POST /api/pagos` (validación de saldo) → `backend/src/routes/pagos.js` · `FacturaDetalle.jsx` |
| RF-05 Consultar pagos | `GET /api/pagos`, `GET /api/facturas/:id/pagos` → `pagos.js` · `frontend/src/pages/Pagos.jsx` |
| RF-06 Gestionar estado de pago | Estado calculado: vista `factura_saldo` en `database/init.sql` |
| RF-07 Asociar factura a pedido | `facturas.pedido_id` UNIQUE (1 pedido → 0..1 factura) en `init.sql` |
| RF-08 Consultar saldo pendiente | `GET /api/facturas/:id/saldo` → `facturas.js` · portal: `GET /api/mi-saldo` → `backend/src/routes/mis.js` |
| RF-09 Reportes de facturación | `GET /api/reportes/facturacion` → `backend/src/routes/reportes.js` · `frontend/src/pages/Reportes.jsx` |
| RF-10 Historial financiero | `GET /api/reportes/historial/:clienteId` → `reportes.js` · portal: `GET /api/mi-historial` |
| RF-11 Servicios para integración | API REST completa (resumen más arriba) |
| Notas de crédito (devoluciones) | `POST/GET /api/notas-credito`, `POST /:id/anular` → `backend/src/routes/notas-credito.js` · `frontend/src/pages/NotasCredito.jsx` · portal: `GET /api/mis-notas-credito` → `portal/MisNotasCredito.jsx` |
| Balance y cuentas por cobrar por cliente | `GET /api/reportes/balance-clientes` → `reportes.js` · `frontend/src/pages/BalanceClientes.jsx` |
| Estado financiero por correo | `GET /api/clientes/:id/resumen-correo` (mailto) → `clientes.js` · `BalanceClientes.jsx`, `Clientes.jsx`, `FacturaPreview.jsx` |
| Previsualización de factura | `FacturaPreview.jsx` (vista previa, imprimir con `@media print`, enviar por correo) → `Facturas.jsx`, `FacturaDetalle.jsx` |
| RF-C01..C06 Gestión de clientes | `backend/src/routes/clientes.js` · `frontend/src/pages/Clientes.jsx` |
| RF-P01..P05 Gestión de productos | `backend/src/routes/productos.js` · `frontend/src/pages/Productos.jsx` |
| RF-PD01..PD08 Gestión de pedidos | `backend/src/routes/pedidos.js` · `Pedidos.jsx`, `PedidoForm.jsx`, `PedidoDetalle.jsx` |
| RF-U01..U03 Usuarios y seguridad | `backend/src/routes/auth.js`, `usuarios.js`, `middleware/auth.js` · `Login.jsx`, `Usuarios.jsx` |
| RF-A01/A02 Auditoría | `backend/src/middleware/audit.js`, `routes/auditoria.js` · `frontend/src/pages/Auditoria.jsx` |

### Casos de uso (documento técnico)

| Caso de uso | Implementación |
|---|---|
| CU-09 Login del cliente | `POST /api/auth/login` (tipo=cliente) → `auth.js` · `frontend/src/pages/Login.jsx` |
| Autoregistro del cliente | `POST /api/auth/registro` (crea cliente + cuenta, login inmediato) → `auth.js` · `Login.jsx` (pestaña «Crear cuenta»)
| CU-10 Consultar mis datos | `GET /api/mis-datos` → `mis.js` · `frontend/src/pages/portal/MisDatos.jsx` |
| CU-11 Consultar mis compras | `GET /api/mis-pedidos` → `mis.js` · `frontend/src/pages/portal/MisCompras.jsx` |
| CU-12 Consultar mis facturas | `GET /api/mis-facturas` → `mis.js` · `frontend/src/pages/portal/MisFacturas.jsx` |
| CU-13 Consultar mis pagos/saldo | `GET /api/mis-pagos`, `GET /api/mi-saldo` → `mis.js` · `MisPagos.jsx`, `MiSaldo.jsx` |
| CU-14 Consultar mi historial | `GET /api/mi-historial` → `mis.js` · `frontend/src/pages/portal/MiHistorial.jsx` |
| CU-15..CU-19 Productos | `productos.js` · `frontend/src/pages/Productos.jsx` |
| CU-20..CU-24 Pedidos | `pedidos.js` · `Pedidos.jsx`, `PedidoForm.jsx`, `PedidoDetalle.jsx` |
| CU-25..CU-30 Facturación | `facturas.js` · `Facturas.jsx`, `FacturaDetalle.jsx` |

### Reglas de negocio y controles críticos (nivel de código)

| Regla | Dónde se aplica |
|---|---|
| Cliente duplicado (tipo + número) → 409 | `clientes.js` (consulta previa + `UNIQUE`) |
| Código de producto duplicado → 409 · precio negativo → 400 | `productos.js` |
| Totales calculados en servidor | `pedidos.js` (recalcula desde `productos.precio/impuesto`) |
| Facturar solo pedidos CONFIRMADO; refacturar → 409 | `facturas.js` |
| Pago no supera saldo → 400 | `pagos.js` (suma de pagos previos vs total) |
| Anulación con pagos → 409 · sin motivo → 400 | `facturas.js` |
| Aislamiento por clienteId del token | `middleware/auth.js` → `requireCliente` + filtros `WHERE cliente_id = $1` en `mis.js` |
| RBAC por rol en cada ruta | `middleware/auth.js` → `requireRol` |
| Auditoría de operaciones | `audit()` en cada mutación + `routes/auditoria.js` |
| Supresión de datos por estado (no DELETE) | `PATCH /estado` en clientes/productos; anulación lógica en facturas |