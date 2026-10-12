# FINAN-X · Especificación Técnica

> **Propósito de este documento:** describir **cómo** está construido FINAN-X hasta el último detalle necesario para **recrearlo desde cero** con Claude Code u OpenCode (léalo junto con `SPEC_Funcional.md`; la secuencia de ejecución está en `PLAN_Creacion.md`).
>
> **Proyecto:** FINAN-X · **Desarrolladores:** Luis Alfredo Jaramillo Restrepo · Mayra Juliana Velez
> **Estado:** funcional · **Verificación:** suite e2e 154/154 aprobadas.

---

## 1. Stack y decisiones de arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5 + React Router 6 + Axios · SPA servida por nginx (con proxy `/api`) |
| Backend | Node.js 22 + Express 4 (ESM, `"type": "module"`) |
| Base de datos | PostgreSQL 16 (esquema + vista de saldo) |
| Autenticación | JWT (jsonwebtoken) + bcryptjs (hash de contraseñas y OTP) |
| Seguridad | helmet, CORS con lista blanca, express-rate-limit, consultas 100 % parametrizadas |
| Infra | Docker Compose (db → backend → frontend), con healthchecks |

Decisiones no negociables (están probadas en e2e):

1. **Consultas parametrizadas** (`$1, $2…` con `pg`) en todas las rutas — jamás interpolación de SQL.
2. **Totales calculados en el servidor**: el precio/impuesto de cada línea del pedido se lee de `productos` en el momento; el cliente nunca envía montos de línea.
3. **El saldo nunca se almacena**: se deriva de `facturas` + `pagos` + `notas_credito` (vista `factura_saldo`).
4. **Aislamiento por cliente**: rutas `mis-*` filtran siempre por el `clienteId` del JWT (404 ante recursos ajenos).
5. **Los datos de tarjeta son efímeros** (PCI-DSS): se validan (Luhn) y se descartan; en BD solo los últimos 4 dígitos, marca, vencimiento, banco, titular y número de cuenta (transferencia).
6. **OTP demo**: el código se cifra con bcrypt en BD; la entrega se abstrae en `notificar.js` (demo: consola + `demo_otp` en la respuesta si `OTP_RETORNO_DEMO=on`).
7. **Anti-spam por separado**: registro (20/h/IP), recuperación (40/15min/IP) y login por fallos (5/15min/IP, se resetea al acertar).
8. **Proceso de desarrollo:** metodología ágil con **entregas semanales (6 sprints, 21 ago – 28 sep 2026)** — detalle en §1.2 y `PLAN_Creacion.md`; cronograma visual en `diagrams/FINAN_X_Diagrama_Gantt.svg`.
9. **Entrega para el cliente:** carpeta `mockups/` con prototipos HTML estáticos (wireframes "tipo demo") distintos de la aplicación final.

### 1.1 Arquitectura hexagonal (puertos y adaptadores)

El proyecto se diseñó sobre una arquitectura hexagonal: el **núcleo de dominio** (reglas de negocio puras) no conoce la tecnología; los **puertos** definen los canales formales y los **adaptadores** los implementan. Cambiar base de datos, proveedor de SMS/correo o presentación no exige tocar las reglas.

```
                    ┌────────────────────────────────────────────┐
                    │             NÚCLEO (dominio)               │
                    │  Reglas puras, sin tecnología:             │
                    │  · sin sobrepago · 1 pedido → 1 factura    │
                    │  · totales/saldo calculados (vista)        │
                    │  · validarDatosPago (Luhn · CVV · vigencia)│
                    │  · reglas OTP (6 dígitos · 10 min · 5 intentos)│
                    └───────▲───────────────┬────────────────────┘
                            │               │
   PUERTOS DE ENTRADA (HTTP)│               │  PUERTOS DE SALIDA
   ┌────────────────────────┼────┐    ┌─────┼─────────────────────┐
   │ Adaptadores REST        │    │    │     │ PostgreSQL (db.js)   │
   │ auth.js (público)       │    │    │     │  pool pg · $n · vista │
   │ *.js (internos)         │    │    ├────►│  factura_saldo       │
   │ mis.js (portal aislado) │    │    │     ├──────────────────────┤
   │ guardas auth/rol/cliente│    │    │     │ notificar.js (OTP)   │
   │ limitadores por IP      │    │    │     │ demo consola · Twilio│
   └────────────────────────┘    │    │     │ /nodemailer (prod)   │
                                 │    │     ├──────────────────────┤
                                 │    │     │ bcrypt · JWT         │
                                 │    └────►│ adaptadores de       │
                                 │          │ seguridad            │
                                 │          └──────────────────────┘
```

| Pieza hexagonal | Implementación concreta |
|---|---|
| **Núcleo de dominio** | `utils.js` (`validarLuhn`, `derivarTipoTarjeta`, `validarDatosPago`, `round2`, `HttpError`) + invariantes de las rutas (sin sobrepago, anulación con motivo, cálculo de totales y de saldo en la vista). |
| **Puerto de entrada** | Casos de uso expuestos como REST (`routes/*.js`); contrato JSON con códigos 400/401/403/404/409/429. |
| **Adaptadores de entrada** | Express + `requireAuth`, `requireRol`, `requireCliente` + limitadores (login por fallos, registro 20/h, recuperación 40/15 min). |
| **Puerto de salida · persistencia** | Pool `db.js` (SQL parametrizado `$n`); vista `factura_saldo` como proyección de lectura (saldo derivado, jamás almacenado). |
| **Puerto de salida · notificaciones** | `middleware/notificar.js` → `enviarCodigo({canal, destino, codigo})`: adaptador demo (consola) y punto de extensión Twilio/nodemailer. El núcleo entrega al puerto, no conoce al proveedor. |
| **Puerto de salida · seguridad** | Adaptadores bcryptjs (hash/verificación) y jsonwebtoken (emisión/verificación JWT 8 h). |
| **Presentación** | SPA React (`frontend/`) = cliente del puerto de entrada; no contiene reglas de negocio ni acceso a BD. |

### 1.2 Metodología ágil — entregas semanales

Desarrollo mediante **Scrum simplificado con 6 sprints semanales** (21 ago – 28 sep 2026; entregas los viernes 28 ago · 4 · 11 · 18 · 25 sep y cierre final el lunes 28 sep); cada semana entrega una versión ejecutable y verificada (la suite e2e es la definición de terminado).

| Sprint | Semana (2026) | Entrega | Entregable | Fases del plan |
|---|---|---|---|---|
| 1 | 21–27 ago | vie 28 ago | Requisitos + infraestructura Docker sana | 0, 1 |
| 2 | 28 ago–3 sep | vie 4 sep | Modelo de datos + API REST del núcleo | 2, 3 |
| 3 | 4–10 sep | vie 11 sep | Panel interno (React) | 4 |
| 4 | 11–17 sep | vie 18 sep | Portal del cliente + seguridad + suite e2e base 74/74 | 5, 6, 7 |
| 5 | 18–24 sep | vie 25 sep | Notas de crédito + recuperación de contraseña OTP | 8, 9 |
| 6 | 25–28 sep | **lun 28 sep (cierre)** | Datos de pago en línea (PCI) + verificación 99/99 + documentación y mockups | 10, 11, 12 |

---

## 2. Estructura de carpetas

```
project/
├── docker-compose.yml              # db + backend + frontend
├── README.md
├── database/
│   ├── init.sql                    # Esquema completo (docker-entrypoint-initdb.d)
│   ├── migracion_notas_credito.sql # Migración: tabla notas_credito + vista factura_saldo v2
│   └── migracion_recuperacion_contrasena.sql  # Migración: recuperaciones_clave + columnas de pago en línea
├── backend/
│   ├── Dockerfile                  # node:22-alpine → seed idempotente + arranque
│   ├── package.json                # ESM; scripts: dev/start/seed/test
│   ├── scripts/
│   │   ├── seed.js                 # Datos demo idempotentes (roles, usuarios, clientes, producto)
│   │   └── e2e.mjs                 # Suite end-to-end (154 comprobaciones) — npm test
│   └── src/
│       ├── index.js                # Express bootstrap: helmet, CORS, JSON, montaje de rutas, error handler
│       ├── config.js               # Variables de entorno (BD, JWT, CORS, límites, OTP)
│       ├── db.js                   # Pool de conexiones pg
│       ├── utils.js                # HttpError, round2, num, validarLuhn, derivarTipoTarjeta, validarDatosPago
│       ├── middleware/
│       │   ├── auth.js             # signToken, requireAuth, requireRol, requireCliente
│       │   ├── audit.js            # audit({usuario, usuarioTipo, modulo, operacion, descripcion})
│       │   ├── rateLimit.js        # Login por fallos: registrarFalloLogin, limpiarFallosLogin (en memoria)
│       │   └── notificar.js        # enviarCodigo({canal, destino, codigo}) — demo por consola
│       └── routes/
│           ├── auth.js             # login, registro, recuperar-solicitar, recuperar-cambiar
│           ├── usuarios.js         # solo ADMIN
│           ├── clientes.js         # CRUD + cuenta + resumen-correo
│           ├── productos.js
│           ├── pedidos.js
│           ├── facturas.js         # generar, detalle, pagos, saldo, anular
│           ├── pagos.js            # registro con validación de saldo y datos por método
│           ├── notas-credito.js
│           ├── reportes.js
│           ├── auditoria.js
│           └── mis.js              # portal del cliente (mis-*, aislado por clienteId)
├── mockups/                        # Prototipos de demostración para el cliente
│   ├── mockup-style.css            # (wireframes "tipo demo", estáticos — NO la app final)
│   ├── index.html                  # galería de pantallas
│   └── 01…14-*.html                # 14 pantallas: login, OTP, dashboard, clientes,
│                                   #   productos, pedidos, facturas, caja/pagos,
│                                   #   notas de crédito, reportes, portal, pago en
│                                   #   línea, registro de usuario, portal de internos
└── frontend/
    ├── Dockerfile                  # build Vite → nginx (SPA + proxy /api)
    ├── nginx.conf                  # SPA fallback + proxy_pass http://backend:4000
    └── src/
        ├── main.jsx  ·  App.jsx    # AuthProvider + rutas protegidas por tipo/rol
        ├── api.js                  # axios baseURL '/api', token en interceptor, cierre de sesión en 401
        ├── auth.jsx                # contexto: user en localStorage (fx_user/fx_token)
        ├── ui.jsx                  # Badge, Estado, Money, Fecha, FechaHora, DatosPago, Loading, Empty, ErrorBox
        ├── styles.css
        ├── components/  Layout.jsx · FacturaPreview.jsx
        ├── pages/       Login, Dashboard, Clientes, Productos, Pedidos, PedidoForm, PedidoDetalle,
        │                Facturas, FacturaDetalle, Pagos, Reportes, NotasCredito, BalanceClientes,
        │                Usuarios, Auditoria
        └── pages/portal/ MiSaldo, MisDatos, MisCompras, MisFacturas, MisPagos, MiHistorial,
                         MisNotasCredito, PagarModal
```

---

## 3. Modelo de datos (PostgreSQL)

> Este es el `database/init.sql` real (esquema autoritativo). Se aplica automáticamente al primer arranque del contenedor `db` (montado en `/docker-entrypoint-initdb.d/init.sql`). Las migraciones posteriores usan `ALTER/ADD COLUMN IF NOT EXISTS` para ser idempotentes.

```sql
-- Roles
CREATE TABLE IF NOT EXISTS roles (
  rol_id      SERIAL PRIMARY KEY,
  nombre      VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT
);

-- Usuarios internos (Administrador, Facturador, Cajero, Supervisor)
CREATE TABLE IF NOT EXISTS usuarios (
  usuario_id     SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  correo         VARCHAR(150) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  rol_id         INT NOT NULL REFERENCES roles(rol_id),
  estado         VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  cliente_id           SERIAL PRIMARY KEY,
  tipo_cliente         VARCHAR(20)  NOT NULL DEFAULT 'PERSONA',
  tipo_identificacion  VARCHAR(20)  NOT NULL DEFAULT 'CC',
  numero_identificacion VARCHAR(30) NOT NULL,
  nombre_razon_social  VARCHAR(200) NOT NULL,
  telefono             VARCHAR(30),
  correo               VARCHAR(150),
  direccion            VARCHAR(200),
  ciudad               VARCHAR(100),
  estado               VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cliente_identificacion UNIQUE (tipo_identificacion, numero_identificacion)
);

-- Cuentas de acceso de clientes (CLIENTE 1 ─── 0..1 USUARIO_CLIENTE)
CREATE TABLE IF NOT EXISTS usuario_cliente (
  usuario_cliente_id SERIAL PRIMARY KEY,
  cliente_id         INT NOT NULL UNIQUE REFERENCES clientes(cliente_id),
  username           VARCHAR(150) UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  estado             VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acceso      TIMESTAMPTZ
);

-- Productos
CREATE TABLE IF NOT EXISTS productos (
  producto_id        SERIAL PRIMARY KEY,
  codigo             VARCHAR(30) UNIQUE NOT NULL,
  nombre             VARCHAR(150) NOT NULL,
  descripcion        TEXT,
  categoria          VARCHAR(60),
  precio             NUMERIC(14,2) NOT NULL CHECK (precio >= 0),
  impuesto           NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (impuesto >= 0 AND impuesto <= 100),
  unidad_medida      VARCHAR(20) NOT NULL DEFAULT 'UND',
  estado             VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  pedido_id     SERIAL PRIMARY KEY,
  numero_pedido VARCHAR(20) UNIQUE,
  cliente_id    INT NOT NULL REFERENCES clientes(cliente_id),
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal      NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuestos     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado        VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',  -- BORRADOR / CONFIRMADO / CANCELADO / FACTURADO
  observaciones TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detalle de pedido
CREATE TABLE IF NOT EXISTS detalle_pedido (
  detalle_id     SERIAL PRIMARY KEY,
  pedido_id      INT NOT NULL REFERENCES pedidos(pedido_id) ON DELETE CASCADE,
  producto_id    INT NOT NULL REFERENCES productos(producto_id),
  cantidad       NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,2) NOT NULL,
  subtotal       NUMERIC(14,2) NOT NULL
);

-- Facturas (PEDIDO 1 ─── 0..1 FACTURA)
CREATE TABLE IF NOT EXISTS facturas (
  factura_id        SERIAL PRIMARY KEY,
  numero_factura    VARCHAR(20) UNIQUE,
  pedido_id         INT NOT NULL UNIQUE REFERENCES pedidos(pedido_id),
  cliente_id        INT NOT NULL REFERENCES clientes(cliente_id),
  fecha_emision     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_vencimiento DATE,
  subtotal          NUMERIC(14,2) NOT NULL,
  impuestos         NUMERIC(14,2) NOT NULL,
  total             NUMERIC(14,2) NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',  -- ACTIVA / ANULADA
  motivo_anulacion  TEXT,
  fecha_anulacion   TIMESTAMPTZ,
  usuario_anulacion INT REFERENCES usuarios(usuario_id),
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pagos (FACTURA 1 ─── N PAGO)
CREATE TABLE IF NOT EXISTS pagos (
  pago_id       SERIAL PRIMARY KEY,
  numero_pago   VARCHAR(20) UNIQUE,
  factura_id    INT NOT NULL REFERENCES facturas(factura_id),
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor         NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  metodo_pago   VARCHAR(30) NOT NULL,   -- EFECTIVO / TARJETA / TRANSFERENCIA / CHEQUE
  referencia    VARCHAR(60),
  observaciones TEXT,
  usuario_id    INT REFERENCES usuarios(usuario_id),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notas de crédito (FACTURA 1 ─── N NOTA_CREDITO)
CREATE TABLE IF NOT EXISTS notas_credito (
  nota_credito_id   SERIAL PRIMARY KEY,
  numero_nota       VARCHAR(20) UNIQUE,
  factura_id        INT NOT NULL REFERENCES facturas(factura_id),
  cliente_id        INT NOT NULL REFERENCES clientes(cliente_id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor             NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  motivo            TEXT NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id        INT REFERENCES usuarios(usuario_id),
  fecha_anulacion   TIMESTAMPTZ,
  usuario_anulacion INT REFERENCES usuarios(usuario_id),
  motivo_anulacion  TEXT
);

-- Auditoría (INTERNO / CLIENTE)
CREATE TABLE IF NOT EXISTS auditoria (
  auditoria_id      SERIAL PRIMARY KEY,
  usuario           VARCHAR(200),
  usuario_tipo      VARCHAR(20) NOT NULL DEFAULT 'INTERNO',
  fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modulo            VARCHAR(50),
  operacion         VARCHAR(30),
  registro_afectado VARCHAR(50),
  descripcion       TEXT
);

-- Vista de saldo por factura (estado de pago calculado).
-- Las notas de crédito ACTIVAS aumentan el saldo (reversan pagos).
CREATE OR REPLACE VIEW factura_saldo AS
SELECT
  f.factura_id, f.numero_factura, f.pedido_id, f.cliente_id, f.fecha_emision, f.fecha_vencimiento,
  f.subtotal::float8 AS subtotal, f.impuestos::float8 AS impuestos, f.total::float8 AS total,
  COALESCE(SUM(p.valor), 0)::float8 AS valor_pagado,
  (f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0))::float8 AS saldo,
  f.estado,
  CASE
    WHEN f.estado = 'ANULADA'                                     THEN 'ANULADA'
    WHEN COALESCE(SUM(p.valor), 0) - COALESCE(SUM(nc.valor), 0) <= 0 THEN 'PENDIENTE'
    WHEN f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0) <= 0 THEN 'PAGADA'
    ELSE 'PAGO_PARCIAL'
  END AS estado_pago,
  f.motivo_anulacion, f.fecha_anulacion,
  COALESCE(SUM(nc.valor), 0)::float8 AS notas_credito
FROM facturas f
LEFT JOIN pagos p ON p.factura_id = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA'
GROUP BY f.factura_id;

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_estado       ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_productos_estado      ON productos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente       ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado        ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido ON detalle_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente      ON facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado       ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_factura         ON pagos(factura_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_factura ON notas_credito(factura_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_cliente ON notas_credito(cliente_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha       ON auditoria(fecha_hora DESC);

-- Recuperación de contraseña (OTP) — añadida por migración (idempotente)
CREATE TABLE IF NOT EXISTS recuperaciones_clave (
  recuperacion_id    SERIAL PRIMARY KEY,
  usuario_cliente_id INT NOT NULL REFERENCES usuario_cliente(usuario_cliente_id) ON DELETE CASCADE,
  canal              VARCHAR(10) NOT NULL CHECK (canal IN ('EMAIL', 'SMS')),
  codigo_hash        TEXT NOT NULL,     -- OTP cifrado con bcrypt (nunca en claro)
  intentos           INT NOT NULL DEFAULT 0,
  usado              BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en          TIMESTAMPTZ NOT NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recuperaciones_cliente ON recuperaciones_clave(usuario_cliente_id, usado);

-- Datos de pago en línea (PCI-DSS: nunca CVV ni número completo)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS titular TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS tipo_tarjeta TEXT;             -- VISA / MASTERCARD / AMEX / OTRA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS ultimos_digitos_tarjeta TEXT;  -- solo 4 dígitos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS vencimiento_tarjeta TEXT;      -- MM/AA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS numero_cuenta TEXT;            -- transferencia
```

---

## 4. Contrato de la API REST

Convenciones: base `/api` · JSON · errores `{ "error": "mensaje" }` con códigos HTTP estándar (400/401/403/404/409/429/500). Autenticación: `Authorization: Bearer <token>`. Respuestas con `float8` en montos.

### 4.1 Autenticación (público)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` → `{ token, user }`. Interno: `{ tipo:'interno', usuarioId, nombre, correo, rol }`. Cliente: `{ tipo:'cliente', clienteId, nombre, username }`. 401 inválido; 403 inactivo; 429 tras 5 fallos/IP. |
| POST | `/api/auth/registro` | Autoregistro cliente (datos + username/password) → mismo contrato que login (cliente). Rate: 20/h/IP. |
| POST | `/api/auth/recuperar-solicitar` | `{ username, canal: 'EMAIL'|'SMS' }` → 200 genérico; describe. Si `OTP_RETORNO_DEMO=on` y la cuenta existe, incluye `demo_otp`, `destino` (enmascarado), `canal`. 400 sin username o canal inválido. Rate: 40/15min/IP. |
| POST | `/api/auth/recuperar-cambiar` | `{ username, codigo, nuevaClave }` → 200 `{ mensaje }`. 400 formato/expirado/sin solicitud; 401 código incorrecto; 404 cuenta; 429 limiter. Marca `usado`, audita `CLAVE_RECUPERADA`. |

### 4.2 Módulos internos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/usuarios` | ADMIN | Lista usuarios. |
| GET | `/api/usuarios/roles` | ADMIN | Lista roles. |
| POST | `/api/usuarios` | ADMIN | Crear usuario interno. |
| PATCH | `/api/usuarios/:id` | ADMIN | Actualizar/estado. |
| GET | `/api/clientes` | todos internos | Listar (filtros `q`, `estado`). |
| GET | `/api/clientes/:id` | todos internos | Detalle. |
| POST | `/api/clientes` | todos internos | Crear (identificación única). |
| PATCH | `/api/clientes/:id/estado` | todos internos | ACTIVO/INACTIVO. |
| POST | `/api/clientes/:id/cuenta` | todos internos | Crear cuenta de portal (username único). |
| GET | `/api/clientes/:id/resumen-correo` | todos internos | Resumen financiero (enlace `mailto:`). |
| GET/POST | `/api/productos` | todos internos | Listar / crear (código único, precio ≥ 0, impuesto 0–100). |
| PATCH | `/api/productos/:id/estado` | todos internos | ACTIVO/INACTIVO. |
| GET | `/api/pedidos` · `/api/pedidos/:id` | todos internos | Listar / detalle. |
| POST | `/api/pedidos` | todos internos | `{ clienteId, items:[{productoId,cantidad}] }` → calcula totales en servidor. |
| PATCH | `/api/pedidos/:id/estado` | todos internos | BORRADOR→CONFIRMADO/CANCELADO (reglas de transición). |
| GET | `/api/facturas` | todos internos | Listar. |
| POST | `/api/facturas` | todos internos | `{ pedidoId }` desde pedido CONFIRMADO (201) — 400/409 si no aplica. |
| GET | `/api/facturas/:id` | todos internos | Detalle (usa `factura_saldo`). |
| GET | `/api/facturas/:id/pagos` | todos internos | Pagos de la factura. |
| GET | `/api/facturas/:id/saldo` | todos internos | `{ total, pagado, saldo, estado_pago }`. |
| POST | `/api/facturas/:id/anular` | todos internos | `{ motivo }` obligatorio; una vez; 409 si no ACTIVA. |
| GET | `/api/pagos` | todos internos | Listar pagos (incluye columnas de medio: banco, tipo_tarjeta, ultimos_digitos…). |
| POST | `/api/pagos` | todos internos | Ver §4.3 (validación de datos por método + saldo). |
| GET | `/api/notas-credito` · `/:id` | todos internos | Listar / detalle. |
| POST | `/api/notas-credito` | todos internos | `{ facturaId, valor, motivo }`; valor ≤ recaudado (pagos − notas activas). |
| POST | `/api/notas-credito/:id/anular` | todos internos | `{ motivo }`; una vez (reanular 409). |
| GET | `/api/reportes/resumen` | ADMIN/SUPERVISOR/FACTURADOR | Resumen financiero. |
| GET | `/api/reportes/facturacion` | ídem | Serie de facturación. |
| GET | `/api/reportes/balance-clientes` | ídem | Balance agregado por cliente. |
| GET | `/api/reportes/historial/:clienteId` | ídem | Historial del cliente. |
| GET | `/api/auditoria?modulo=&desde=&hasta=` | ADMIN/SUPERVISOR | Registro de operaciones. |
| GET | `/api/health` | público | `{ ok: true, servicio: 'FINAN-X API', hora }`. |

### 4.3 POST /api/pagos y POST /api/mis-pagos (contrato de pago)
```jsonc
// Cuerpo
{
  "facturaId": 1,                  // factura ACTIVA del cliente (en mis-pagos, propia)
  "valor": 50000,                  // > 0 y ≤ saldo pendiente (si no → 400)
  "metodoPago": "TARJETA",         // EFECTIVO | TARJETA | TRANSFERENCIA | CHEQUE
  "referencia": "…",               // obligatoria para TRANSFERENCIA/CHEQUE (≥4)
  "observaciones": "…",            // opcional
  // Solo según método:
  "numeroTarjeta": "4111111111111111", // TARJETA · Luhn + 13–19 dígitos
  "codigoSeguridad": "123",            // TARJETA · 3–4 dígitos, NUNCA se almacena
  "vencimientoTarjeta": "12/30",       // TARJETA · MM/AA vigente
  "banco": "Bancolombia",              // TARJETA/TRANSFERENCIA/CHEQUE
  "titularTarjeta": "Nombre",          // TARJETA
  "numeroCuenta": "1234567890"         // TRANSFERENCIA · 4–20 dígitos
}

// Respuesta del POST (201)
{ "pago_id": 10, "numero_pago": "PAGO-000010", "valor": 50000, "saldo": 92800.0, "estado_pago": "PAGO_PARCIAL", "pago_registrado": true }
```
- Campos de tarjeta/transferencia inválidos o faltantes → **400 del servicio `validarDatosPago()`** (compartido por ambos orígenes).
- GET `/api/pagos` y GET `/api/mis-pagos` devuelven también `banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta, numero_cuenta`. **Nunca** `codigoSeguridad` ni número completo.

### 4.4 Portal del cliente (token de tipo `cliente`, aislado)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/mis-datos` | Datos del cliente autenticado. |
| GET | `/api/mis-pedidos` · `/api/mis-pedidos/:id` | Compras propias. |
| GET | `/api/mis-facturas` · `/api/mis-facturas/:id` | Facturas propias con saldo. |
| GET | `/api/mis-pagos` | Pagos propios (con medio de pago no sensible). |
| GET | `/api/mi-saldo` | Saldo total del cliente. |
| GET | `/api/mis-notas-credito` | Notas de crédito propias. |
| GET | `/api/mi-historial` | Historial financiero (facturas, pagos, notas + saldo móvil). |
| POST | `/api/mis-pagos` | Pago/abono de factura **propia** (mismo contrato §4.3). Factura ajena/inexistente → 404. |
| GET | `/api/mis-pagos` | Portal: lista pagos. |

### 4.5 Detalles JWT
- `signToken(payload)` con `jwtSecret` y `expiresIn: JWT_EXPIRES` (8 h).
- Payload interno: `{ tipo:'interno', usuarioId, nombre, correo, rol, iat, exp }`.
- Payload cliente: `{ tipo:'cliente', clienteId, nombre, username, iat, exp }`.
- Protección: rutas internas `requireAuth` + `requireRol(...)`; portal `requireAuth` + `requireCliente`.
- En producción `JWT_SECRET` debe tener ≥ 32 caracteres (config lo exige y aborta).

---

## 5. Lógica de validación de pago (`backend/src/utils.js`)

```js
// Luhn (dígito verificador) — acepta 13–19 dígitos
validarLuhn(numero) → boolean

// Marca comercial por prefijo: ^4=VISA · ^5[1-5] o ^2[2-7]=MASTERCARD · ^3[47]=AMEX · resto OTRA
derivarTipoTarjeta(numero) → 'VISA'|'MASTERCARD'|'AMEX'|'OTRA'

// Devuelve solo los campos seguros para persistir (nunca CVV ni PAN):
validarDatosPago(metodoPago, body) →
  TARJETA        { banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta }
  TRANSFERENCIA  { banco, numero_cuenta }
  CHEQUE         { banco }
  EFECTIVO       {}
// Lanza HttpError(400, mensaje) ante cualquier campo faltante/inválido.
```

Reglas exactas: TARJETA → `^\d{13,19}$` + Luhn; CVV `^\d{3,4}$`; vencimiento `/^(0[1-9]|1[0-2])\/\d{2}$/` y fecha (último día del mes) ≥ hoy; banco no vacío; titular ≥ 3. TRANSFERENCIA → banco, `^\d{4,20}$`, referencia ≥ 4. CHEQUE → banco, referencia ≥ 4.

---

## 6. Configuración y variables de entorno

`backend/src/config.js` + `docker-compose.yml`:

| Variable | Default | Uso |
|---|---|---|
| `PORT` | 4000 | Puerto de la API |
| `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` | db / 5432 / finanx / finanx / finanx | Conexión BD |
| `JWT_SECRET` | `finanx-prod-secret-cambiar-por-una-clave-segura...` | Firma JWT (prod exige ≥32) |
| `JWT_EXPIRES` | 8h | Vigencia del token |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080` | Orígenes permitidos |
| `LOGIN_MAX_FAILURES` | 5 | Fallos de login por IP antes del 429 (ventana 15 min) |
| `REGISTRO_RATE_LIMIT` | 20 | Autoregistros/hora/IP |
| `RECUPERAR_RATE_LIMIT` | 40 | Solicitudes de recuperación/15 min/IP (contador propio) |
| `OTP_RETORNO_DEMO` | on | `off` en producción: el código NO viaja en la respuesta |
| `OTP_VALIDEZ_MINUTOS` | 10 | Vigencia del OTP |
| `OTP_MAX_INTENTOS` | 5 | Intentos máx. con el código |
| `NODE_ENV` | production | Exige JWT_SECRET fuerte |

**docker-compose.yml** (resumen):
- **db**: `postgres:16-alpine`, volumen nombrado `finanx_pgdata` (persistencia), monta `./database/init.sql` en `/docker-entrypoint-initdb.d/init.sql:ro`, healthcheck `pg_isready`.
- **backend**: build `./backend`, env arriba, expone 4000, `depends_on: db (healthy)`, healthcheck curl a `/api/health`, `restart: unless-stopped`.
- **frontend**: build `./frontend`, expone 8080→80, `depends_on: backend (healthy)`.

Dockerfiles: backend `node:22-alpine`, `npm ci --omit=dev`, `CMD sh -c "node src/seed.js && node src/index.js"` (seed idempotente). Frontend multi-etapa: Vite build → `nginx:1.27-alpine` con `nginx.conf` (proxy `/api` → `http://backend:4000` + `try_files` SPA).

---

## 7. Seguridad (implementación)

| Medida | Dónde |
|---|---|
| Helmet (CSP, nosniff, X-Frame-Options…) | `index.js` |
| CORS lista blanca (`config.corsOrigins`) | `index.js` |
| Consultas parametrizadas en 100 % de rutas | todos los routers |
| Contraseñas y OTP con bcrypt (cost 10) | auth.js, usuarios.js, clientes.js |
| JWT firmado, expiración 8 h | middleware/auth.js |
| RBAC interno (`requireRol`) y aislamiento cliente (`requireCliente`) | middleware/auth.js |
| Anti fuerza bruta login (en memoria, reset al acertar) | middleware/rateLimit.js |
| Rate limits público (registro, recuperación) | routes/auth.js |
| Auditoría de operaciones (interno y cliente) | middleware/audit.js |
| PCI: nunca persistir CVV/PAN | utils.js `validarDatosPago` + migración |
| OTP: un solo uso, 10 min, 5 intentos, cifrado | routes/auth.js + `recuperaciones_clave` |
| Anti-enumeración en recuperación (respuesta genérica) | routes/auth.js |
| `app.set('trust proxy', 1)` (req.ip real tras nginx) | index.js |

---

## 8. Resumen de la suite e2e (`backend/scripts/e2e.mjs`)

`npm test` ejecuta la suite contra `http://localhost:4000/api` (backend vivo + seed). Utility: `call(method, path, {token, body})` y `check(nombre, cond, extra)`. Secciones:

1. Autenticación (login válido/inválido/sin token, admin y cliente; token aislado)
2. RBAC (403 con token de cliente en rutas internas)
3. Clientes y productos (duplicados → 400, validaciones)
4. Pedidos y totales en servidor
5. Facturación (pedido confirmado, refacturación → error, detalle, saldo)
6. Pagos (parcial, completo → PAGADA, sobrepago → 400, anulaciones)
7. Aislamiento del portal (factura ajena → 404)
8. Portal: pago con tarjeta, sobrepago, consultas `mis-*`
9. Notas de crédito (crear, límite → 400, sobrepasar → 400, anular)
10. Balance por cliente y resumen-correo
11. Seguridad: cabeceras, CORS, fuerza bruta → 429 y reset
12. **Recuperación OTP** y **datos de pago en línea**
- Resumen final `=== Resultado: N aprobadas, M fallidas ===` (salida 0/1).

> Nota: contadores de rate-limit en memoria — re-ejecuciones seguidas (<15 min) comparten ventana; si aparece 429 en secciones públicas, `docker compose restart backend` o espere la ventana.

---

## 9. Cómo levantar y verificar

```bash
# 1. Arranque (crea BD con esquema + seed idempotente)
docker compose up -d --build

# 2. Verificación de salud
curl http://localhost:4000/api/health        # → {"ok":true,...}
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@finanx.test","password":"admin123"}'

# 3. Pruebas end-to-end (154 comprobaciones)
cd backend && npm test

# 4. Aplicar migraciones posteriores (si la BD ya existía)
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_notas_credito.sql
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_recuperacion_contrasena.sql

# 5. Frontend
#    http://localhost:8080  (panel interno) y portal del cliente con cliente@finanx.test / cliente123

# 6. Mockups de demostración (opcional, para mostrar al cliente)
open mockups/index.html   # galería de prototipos wireframe — no es la aplicación final
```

Credenciales demo: `admin@finanx.test/admin123` · `facturador@finanx.test/facturador123` · `cajero@finanx.test/cajero123` · `supervisor@finanx.test/supervisor123` · `cliente@finanx.test/cliente123`.

**Tarjeta de prueba válida** (cumple Luhn): `4111111111111111` (VISA), vencimiento `12/30`, CVV `123`.

---

## 10. Referencia cruzada con el repositorio

| Archivo autoritativo | Rol en la reconstrucción |
|---|---|
| `database/init.sql` | Esquema (fuente única) |
| `backend/src/seed.js` | Datos demo idempotentes |
| `backend/src/routes/*.js` | Contrato exacto de la API |
| `backend/scripts/e2e.mjs` | Pruebas de aceptación (154 comprobaciones) |
| `docker-compose.yml` + Dockerfiles | Infraestructura reproducible |
| `frontend/src/App.jsx` | Mapa de rutas y guardas |
| `frontend/src/styles.css` | Sistema visual (clases `.card`, `.table-wrap`, `.alert-*`, `.login-card`, `.badge`, etc.) |