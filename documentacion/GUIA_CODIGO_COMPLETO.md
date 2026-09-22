# FINAN-X · Guía completa del código

### Frontend + Backend + Base de datos, explicados paso a paso para principiantes

**Proyecto:** Sistema de facturación y pagos FINAN-X
**Fecha:** 21 de septiembre de 2026
**Contenido:** transcripción comentada de **todo** el código que hace funcionar la aplicación: base de datos (PostgreSQL), servidor o *backend* (Node.js + Express) y aplicación de navegador o *frontend* (React + Vite). Al final también aprenderás a **abrir la base de datos directamente en PostgreSQL**.

---

## Índice

1. [Cómo usar este documento](#1-cómo-usar-este-documento)
2. [Conceptos previos para principiantes](#2-conceptos-previos-para-principiantes)
3. [Mapa del proyecto (los archivos que vas a leer)](#3-mapa-del-proyecto)
4. [PARTE 1 · La base de datos (PostgreSQL)](#parte-1--la-base-de-datos-postgresql)
5. [PARTE 2 · El backend (Node.js + Express)](#parte-2--el-backend-nodejs--express)
6. [PARTE 3 · El frontend (React)](#parte-3--el-frontend-react)
7. [PARTE 4 · Cómo abrir la base de datos directamente en PostgreSQL](#parte-4--cómo-abrir-la-base-de-datos-directamente-en-postgresql)
8. [Anexo A · Archivos de despliegue (Docker)](#anexo-a--archivos-de-despliegue-docker)
9. [Anexo B · Pruebas automáticas (e2e)](#anexo-b--pruebas-automáticas-e2e)

---

## Leyenda

| Icono | Significado |
|---|---|
| 📖 | Explicación para principiantes |
| 💻 | Código (transcripción fiel del archivo real) |
| 🗄️ | Base de datos |
| ⚙️ | Backend (servidor) |
| 🎨 | Frontend (navegador) |
| 🔑 | Concepto clave |

---

## 1. Cómo usar este documento

Este documento está hecho para **leerse de arriba hacia abajo**, como un curso corto:

1. Primero entiendes los **conceptos** (sección 2) para que nada te suene a chino.
2. Luego ves el **mapa de archivos** (sección 3): así sabes *dónde* vive cada cosa.
3. Después lees las **tres partes técnicas**, siempre en el mismo orden: **base de datos → backend → frontend**. Ese es exactamente el orden en que fluyen los datos cuando usas la app:
   - El navegador (frontend) pide algo → el servidor (backend) lo procesa → la base de datos guarda o devuelve la información → el servidor la formatea → el navegador la dibuja.
4. En la **parte 4** está lo que pediste de **abrir PostgreSQL directamente**.

Cada archivo aparece con el mismo formato:

> **Archivo:** `ruta/del/archivo`
> **Qué hace:** …
> **Qué aprender aquí:** …
>
> 💻 **Código:**

No tienes que memorizar nada: la idea es que cuando veas el código de la aplicación entiendas qué está haciendo cada línea, y sepas responder "¿dónde está la lógica de X?".

---

## 2. Conceptos previos para principiantes

### 2.1 ¿Qué es una aplicación web de "tres capas"?

FINAN-X se divide en tres programas que trabajan juntos:

```
┌─────────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  🎨 FRONTEND        │      │  ⚙️ BACKEND           │      │  🗄️ BASE DE DATOS │
│  (React en el       │ HTTP │  (Node.js + Express) │  SQL │  (PostgreSQL)     │
│  navegador)         │ ───► │  reglas de negocio   │ ───► │  guarda TODO      │
│  lo que el usuario  │ ◄─── │  valida, calcula,    │ ◄─── │  usuarios,        │
│  ve y toca          │ JSON │  autoriza            │      │  facturas, pagos… │
└─────────────────────┘      └──────────────────────┘      └──────────────────┘
```

- **Frontend (🎨):** la página web. Vive en el navegador. Está hecha con **React**: componentes que se dibujan y se actualizan cuando hay datos nuevos. Habla con el backend mediante peticiones HTTP (con la librería **axios**).
- **Backend (⚙️):** el servidor. Recibe peticiones del navegador, **valida** quién eres (JWT), aplica las **reglas del negocio** (no se puede pagar más del saldo, no se puede facturar dos veces el mismo pedido…), habla con la base de datos y responde con **JSON**.
- **Base de datos (🗄️):** PostgreSQL. Simplemente **almacena** todo: clientes, productos, pedidos, facturas, pagos, auditoría… Se comunica con el backend mediante el lenguaje **SQL**.

### 2.2 Endpoint (la "puerta" de una API)

Una **API REST** es un conjunto de *puertas* llamadas **endpoints**: una dirección (`/api/facturas`) más un verbo HTTP (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).

- `GET /api/facturas` → "dame la lista de facturas" (no cambia nada).
- `POST /api/facturas` → "crea una factura nueva" (envía datos en el cuerpo).

🔑 **Regla mental:** `GET` = leer, `POST` = crear, `PUT/PATCH` = actualizar, `DELETE` = borrar.

### 2.3 JSON (el idioma entre navegador y servidor)

Cuando el frontend y el backend se hablan, los datos viajan como **JSON** — texto con llaves `{}` y corchetes `[]`:

```json
{
  "numero_factura": "FAC-000001",
  "total": 5354000,
  "estado": "ACTIVA"
}
```

### 2.4 JWT (la "carné de identidad" temporal)

Las contraseñas **no se guardan en texto plano** (se guarda un *hash* con bcrypt, ver 2.5). Cuando inicias sesión, el backend te entrega un **token JWT**: un texto largo firmado con un secreto que contiene quién eres (tipo de usuario, rol, id…).

El navegador lo guarda y, en cada petición siguiente, lo envía en la cabecera:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

🔑 **Por qué es útil:** el servidor no necesita recordar tu sesión (es "sin estado"); basta con verificar la firma del token en cada petición. Eso lo hace el *middleware* `requireAuth`.

### 2.5 bcrypt (cómo se guardan las contraseñas)

En las tablas verás columnas `password_hash`. Nunca se guarda `cliente123`; se guarda un **hash** generado con bcrypt (`$2b$10$...`). Cuando alguien inicia sesión se hace `bcrypt.compare(contraseña_escrita, hash_guardado)`, que devuelve verdadero o falso **sin revelar la contraseña original**.

### 2.6 Middleware (los "porteros" de cada petición)

Un **middleware** es una función que corre *antes* de la respuesta final de un endpoint. FINAN-X usa cuatro:

- `requireAuth` → ¿el token es válido? (¿quién eres?)
- `requireRol` → ¿tu rol tiene permiso? (¿puedes hacer esto?)
- `requireCliente` → ¿eres cliente con cuenta vinculada? (portal)
- `audit` → registra la operación en la tabla `auditoria` (¿qué hiciste?)

### 2.7 React en 60 segundos

- **Componentes:** funciones que devuelven HTML (JSX). Ej.: `<MiSaldo />`.
- **Estado (`useState`):** datos que, al cambiar, redibujan el componente. Ej.: la lista de facturas.
- **Efectos (`useEffect`):** código que corre al montar el componente, típicamente para **cargar datos** de la API.
- **Props:** datos que un componente le pasa a otro (como parámetros).
- **Rutas (`react-router-dom`):** asocian direcciones (`/portal`, `/pedidos`) con componentes.

### 2.8 ¿Y cómo entra "todo" en tu computador? Docker

La app no se instala pieza por pieza: corre dentro de **contenedores Docker** definidos en `docker-compose.yml`. Hay 3 contenedores:

| Contenedor | Qué contiene | Puerto |
|---|---|---|
| `finanx-db` | PostgreSQL 16 | 5432 |
| `finanx-backend` | API Node.js | 4000 |
| `finanx-frontend` | Página web (servida por nginx) | 8080 |

El navegador solo habla con el frontend (`http://localhost:8080`). Cuando el frontend llama a `/api/...`, **nginx lo reenvía** al backend (ver Anexo A). Por eso en el código del frontend las direcciones empiezan por `/api` y no por `http://localhost:4000`.

---

## 3. Mapa del proyecto

```
Project Facturacion Finan-x/
│
├── docker-compose.yml          ← orquesta los 3 contenedores
├── levantar.sh                 ← script para arrancar/detener la app
├── iniciar-app.sh              ← script amigable (arranca y abre el navegador)
│
├── database/                   🗄️
│   ├── init.sql                ← esquema completo (tablas, vista, índices)
│   ├── migracion_notas_credito.sql        ← evoluciona la BD (notas de crédito)
│   └── migracion_recuperacion_contrasena.sql ← evoluciona la BD (OTP + datos de tarjeta)
│
├── backend/                    ⚙️
│   ├── package.json            ← dependencias y comandos (npm start, seed, test)
│   ├── Dockerfile              ← cómo se construye el contenedor del backend
│   └── src/
│       ├── index.js            ← punto de entrada: monta la API
│       ├── config.js           ← configuración (secreto JWT, CORS, límites…)
│       ├── db.js               ← conexión a PostgreSQL
│       ├── utils.js            ← utilidades (Luhn, redondeo, validar pagos…)
│       ├── seed.js             ← carga datos demo (roles, usuarios, productos…)
│       ├── middleware/
│       │   ├── auth.js         ← JWT: requireAuth, requireRol, requireCliente
│       │   ├── audit.js        ← escribe en la tabla auditoria
│       │   ├── rateLimit.js    ← anti fuerza-bruta en el login
│       │   └── notificar.js    ← envío de códigos OTP (demo)
│       └── routes/
│           ├── auth.js         ← login, registro, recuperar contraseña
│           ├── clientes.js     ← CRUD de clientes
│           ├── productos.js    ← CRUD de productos
│           ├── usuarios.js     ← usuarios internos (solo ADMIN)
│           ├── pedidos.js      ← pedidos y detalles
│           ├── facturas.js     ← emisión, detalle, anulación
│           ├── pagos.js        ← registro de pagos (caja interna)
│           ├── notas-credito.js← devoluciones
│           ├── reportes.js     ← resumen, facturación, balances, historial
│           ├── auditoria.js    ← consulta de auditoría
│           └── mis.js          ← PORTAL DEL CLIENTE (mis-*)
│   └── scripts/e2e.mjs         ← 99 pruebas automáticas de extremo a extremo
│
└── frontend/                   🎨
    ├── package.json            ← dependencias y comandos (vite)
    ├── Dockerfile              ← build de la página + nginx
    ├── nginx.conf              ← proxy de /api hacia el backend
    └── src/
        ├── main.jsx            ← punto de entrada de React
        ├── App.jsx             ← define TODAS las rutas y sus "guardias"
        ├── auth.jsx            ← contexto de sesión (login/logout)
        ├── api.js              ← instancia de axios con el token
        ├── ui.jsx              ← componentes de interfaz reutilizables
        ├── styles.css          ← todo el diseño (colores, tablas, modales…)
        ├── components/
        │   ├── Layout.jsx      ← barra lateral + navegación
        │   └── FacturaPreview.jsx ← factura imprimible
        ├── pages/              ← pantallas del panel interno
        │   ├── Login.jsx, Dashboard.jsx, Clientes.jsx, Productos.jsx,
        │   ├── Pedidos.jsx, PedidoForm.jsx, PedidoDetalle.jsx,
        │   ├── Facturas.jsx, FacturaDetalle.jsx, Pagos.jsx,
        │   ├── NotasCredito.jsx, Reportes.jsx, BalanceClientes.jsx,
        │   ├── Usuarios.jsx, Auditoria.jsx
        └── pages/portal/       ← pantallas del portal del cliente
            ├── MiSaldo.jsx, MisDatos.jsx, MisCompras.jsx, MisFacturas.jsx,
            ├── MisPagos.jsx, MiHistorial.jsx, MisNotasCredito.jsx
            └── PagarModal.jsx  ← modal para pagar/abonar (incluye código Efecty)
```

---

# PARTE 1 · La base de datos (PostgreSQL)

## 1.1 Cómo nace la base de datos

Cuando levantas el proyecto con Docker, el contenedor `finanx-db` arranca con la imagen `postgres:16-alpine`. La primera vez que el contenedor se crea (con el volumen `finanx_pgdata` vacío), PostgreSQL **ejecuta automáticamente** el archivo `database/init.sql` que ves a continuación: crea las tablas, la vista de saldos y los índices.

> 💡 Si **borras el volumen** (`docker compose down -v`), la próxima vez que levantes todo el `init.sql` volverá a ejecutarse desde cero. Eso es normal en este proyecto académico (la base es "declarativa": se recrea con un archivo).

Las credenciales de la base salen de `docker-compose.yml`:

| Parámetro | Valor |
|---|---|
| Usuario | `finanx` |
| Contraseña | `finanx` |
| Base de datos | `finanx` |
| Puerto | `5432` (visible en tu computador) |

## 1.2 El modelo de datos, explicado como diagrama

```
roles ──< usuarios (internos: ADMIN, FACTURADOR, CAJERO, SUPERVISOR)
                                          │
clientes ──< usuario_cliente (cuenta del portal, 1 por cliente)
    │
    ├──< pedidos ──< detalle_pedido ──> productos
    │       │
    │       └── (0..1) facturas ──< pagos
    │                     │        └─ (datos de tarjeta/transferencia/cheque)
    │                     └──< notas_credito (devoluciones)
    │
    └── (vista) factura_saldo = facturas + pagos + notas crédito (saldos)
                       
recuperaciones_clave ── (solicitudes OTP para cambiar la contraseña)
auditoria = bitácora de todas las operaciones
```

## 1.3 Tabla por tabla, en cristiano

- **`roles`** — los 4 cargos del personal interno (Administrador, Facturador, Cajero, Supervisor).
- **`usuarios`** — el personal interno: nombre, correo, `password_hash` (nunca la contraseña) y rol.
- **`clientes`** — personas o empresas que compran. La identificación debe ser **única** por tipo (`CC`, `NIT`, `CE`, `PASAPORTE`).
- **`usuario_cliente`** — la **cuenta de acceso al portal**: un usuario/clave ligado a un cliente (relación 1 a 1).
- **`productos`** — catálogo: código único, precio, impuesto (%), unidad de medida, estado.
- **`pedidos`** — una venta: cliente, fechas, y los totales (subtotal, impuestos, total). Estados: `BORRADOR → CONFIRMADO → FACTURADO` (o `CANCELADO`).
- **`detalle_pedido`** — las líneas del pedido: qué productos, cuántas unidades, a qué precio.
- **`facturas`** — documento formal de cobro. Nace de un pedido (relación 1 a 1) y puede estar `ACTIVA` o `ANULADA`.
- **`pagos`** — abonos sobre una factura (una factura puede tener **muchos** pagos). Guarda el método (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `CHEQUE`) y, por seguridad, **solo los últimos 4 dígitos** de la tarjeta (nunca el número completo ni el CVV).
- **`notas_credito`** — devoluciones: solo se pueden crear sobre facturas activas y **hasta el monto pagado** (para no "devolver" dinero que no se ha recibido). También se pueden anular con motivo.
- **`recuperaciones_clave`** — solicitudes de recuperación de contraseña: guarda el código de 6 dígitos **cifrado** (bcrypt), cuántos intentos se han hecho, si ya se usó y cuándo expira.
- **`auditoria`** — bitácora de todo: quién, cuándo, qué módulo, qué operación y descripción.
- **Vista `factura_saldo`** — ⭐ la piedra angular. No es una tabla: es una "ventana" calculada que por cada factura muestra **total, pagado, saldo y estado de pago** (`PENDIENTE`, `PAGO_PARCIAL`, `PAGADA`, `ANULADA`). Las notas de crédito activas **aumentan** el saldo (porque reversan pagos). Todos los saldos del sistema salen de aquí.
- **Índices** — aceleradores de búsqueda en las columnas más consultadas.

## 1.4 Código completo

### Archivo `database/init.sql`

**Archivo:** `database/init.sql` · 251 líneas

````sql
-- ============================================================
-- FINAN-X · Esquema de base de datos (PostgreSQL)
-- Basado en: Documento de Requisitos y Documento Técnico
-- ============================================================

-- ------------------------------------------------------------
-- Roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  rol_id      SERIAL PRIMARY KEY,
  nombre      VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT
);

-- ------------------------------------------------------------
-- Usuarios internos (Administrador, Facturador, Cajero, Supervisor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  usuario_id     SERIAL PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  correo         VARCHAR(150) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  rol_id         INT NOT NULL REFERENCES roles(rol_id),
  estado         VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  cliente_id           SERIAL PRIMARY KEY,
  tipo_cliente         VARCHAR(20)  NOT NULL DEFAULT 'PERSONA',  -- PERSONA / EMPRESA
  tipo_identificacion  VARCHAR(20)  NOT NULL DEFAULT 'CC',        -- CC / NIT / CE / PASAPORTE
  numero_identificacion VARCHAR(30) NOT NULL,
  nombre_razon_social  VARCHAR(200) NOT NULL,
  telefono             VARCHAR(30),
  correo               VARCHAR(150),
  direccion            VARCHAR(200),
  ciudad               VARCHAR(100),
  estado               VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',     -- ACTIVO / INACTIVO
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cliente_identificacion UNIQUE (tipo_identificacion, numero_identificacion)
);

-- ------------------------------------------------------------
-- Cuentas de acceso de clientes (USUARIO_CLIENTE)
-- CLIENTE 1 ──── 0..1 USUARIO_CLIENTE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_cliente (
  usuario_cliente_id SERIAL PRIMARY KEY,
  cliente_id         INT NOT NULL UNIQUE REFERENCES clientes(cliente_id),
  username           VARCHAR(150) UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  estado             VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acceso      TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Productos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  producto_id        SERIAL PRIMARY KEY,
  codigo             VARCHAR(30) UNIQUE NOT NULL,
  nombre             VARCHAR(150) NOT NULL,
  descripcion        TEXT,
  categoria          VARCHAR(60),
  precio             NUMERIC(14,2) NOT NULL CHECK (precio >= 0),
  impuesto           NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (impuesto >= 0 AND impuesto <= 100),
  unidad_medida      VARCHAR(20) NOT NULL DEFAULT 'UND',
  estado             VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',  -- ACTIVO / INACTIVO
  fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Pedidos
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Detalle de pedido
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_pedido (
  detalle_id     SERIAL PRIMARY KEY,
  pedido_id      INT NOT NULL REFERENCES pedidos(pedido_id) ON DELETE CASCADE,
  producto_id    INT NOT NULL REFERENCES productos(producto_id),
  cantidad       NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,2) NOT NULL,
  subtotal       NUMERIC(14,2) NOT NULL
);

-- ------------------------------------------------------------
-- Facturas  (PEDIDO 1 ─── 0..1 FACTURA)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Pagos  (FACTURA 1 ─── N PAGO)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Notas crédito (devoluciones sobre facturas)
-- FACTURA 1 ─── N NOTA_CREDITO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notas_credito (
  nota_credito_id   SERIAL PRIMARY KEY,
  numero_nota       VARCHAR(20) UNIQUE,
  factura_id        INT NOT NULL REFERENCES facturas(factura_id),
  cliente_id        INT NOT NULL REFERENCES clientes(cliente_id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor             NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  motivo            TEXT NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',  -- ACTIVA / ANULADA
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id        INT REFERENCES usuarios(usuario_id),
  fecha_anulacion   TIMESTAMPTZ,
  usuario_anulacion INT REFERENCES usuarios(usuario_id),
  motivo_anulacion  TEXT
);

-- ------------------------------------------------------------
-- Auditoría
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  auditoria_id      SERIAL PRIMARY KEY,
  usuario           VARCHAR(200),
  usuario_tipo      VARCHAR(20) NOT NULL DEFAULT 'INTERNO',  -- INTERNO / CLIENTE
  fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modulo            VARCHAR(50),
  operacion         VARCHAR(30),
  registro_afectado VARCHAR(50),
  descripcion       TEXT
);

-- ------------------------------------------------------------
-- Vista de saldo por factura (estado de pago calculado)
-- Las notas de crédito activas aumentan el saldo (reversan pagos).
-- La columna notas_credito va al FINAL para conservar la
-- compatibilidad con CREATE OR REPLACE VIEW.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW factura_saldo AS
SELECT
  f.factura_id,
  f.numero_factura,
  f.pedido_id,
  f.cliente_id,
  f.fecha_emision,
  f.fecha_vencimiento,
  f.subtotal::float8   AS subtotal,
  f.impuestos::float8  AS impuestos,
  f.total::float8      AS total,
  COALESCE(SUM(p.valor), 0)::float8 AS valor_pagado,
  (f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0))::float8 AS saldo,
  f.estado,
  CASE
    WHEN f.estado = 'ANULADA'                                          THEN 'ANULADA'
    WHEN COALESCE(SUM(p.valor), 0) - COALESCE(SUM(nc.valor), 0) <= 0   THEN 'PENDIENTE'
    WHEN f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0) <= 0 THEN 'PAGADA'
    ELSE 'PAGO_PARCIAL'
  END AS estado_pago,
  f.motivo_anulacion,
  f.fecha_anulacion,
  COALESCE(SUM(nc.valor), 0)::float8 AS notas_credito
FROM facturas f
LEFT JOIN pagos p ON p.factura_id = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA'
GROUP BY f.factura_id;

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clientes_estado        ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_productos_estado       ON productos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente        ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado         ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido  ON detalle_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente       ON facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado        ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_factura          ON pagos(factura_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_factura  ON notas_credito(factura_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_cliente  ON notas_credito(cliente_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha        ON auditoria(fecha_hora DESC);

-- ------------------------------------------------------------
-- Recuperación de contraseña con código de un solo uso (OTP)
-- El código se guarda CIFRADO (bcrypt) y caduca; nunca en texto plano.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recuperaciones_clave (
  recuperacion_id    SERIAL PRIMARY KEY,
  usuario_cliente_id INT NOT NULL REFERENCES usuario_cliente(usuario_cliente_id) ON DELETE CASCADE,
  canal              VARCHAR(10) NOT NULL CHECK (canal IN ('EMAIL', 'SMS')),
  codigo_hash        TEXT NOT NULL,
  intentos           INT NOT NULL DEFAULT 0,
  usado              BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en          TIMESTAMPTZ NOT NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recuperaciones_cliente ON recuperaciones_clave(usuario_cliente_id, usado);

-- ------------------------------------------------------------
-- Datos de pago en línea (tarjeta / transferencia / cheque).
-- Por buenas prácticas de seguridad (PCI-DSS) NUNCA se almacenan
-- el número completo de la tarjeta ni el CVV: solo los últimos 4 dígitos.
-- ------------------------------------------------------------
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS titular TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS tipo_tarjeta TEXT;             -- VISA / MASTERCARD / AMEX / OTRA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS ultimos_digitos_tarjeta TEXT;  -- solo 4 dígitos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS vencimiento_tarjeta TEXT;      -- MM/AA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS numero_cuenta TEXT;            -- transferencia
````

---

## 1.5 Migraciones (cómo evoluciona la BD sin perder datos)

Un buen sistema no edita la tabla original "a lo bruto": usa **migraciones** (archivos SQL que añaden lo nuevo). Estas dos migraciones añadieron las notas de crédito y el módulo de recuperación de contraseña + datos de tarjeta. Para aplicarlas sobre una BD ya existente se usa el comando que verás en la Parte 4:

```
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_notas_credito.sql
```

### Archivo `database/migracion_notas_credito.sql`

**Archivo:** `database/migracion_notas_credito.sql` · 49 líneas

````sql
-- Migración FINAN-X: notas de crédito (devoluciones) + vista de saldo actualizada
CREATE TABLE IF NOT EXISTS notas_credito (
  nota_credito_id   SERIAL PRIMARY KEY,
  numero_nota       VARCHAR(20) UNIQUE,
  factura_id        INT NOT NULL REFERENCES facturas(factura_id),
  cliente_id        INT NOT NULL REFERENCES clientes(cliente_id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor             NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  motivo            TEXT NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',  -- ACTIVA / ANULADA
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id        INT REFERENCES usuarios(usuario_id),
  fecha_anulacion   TIMESTAMPTZ,
  usuario_anulacion INT REFERENCES usuarios(usuario_id),
  motivo_anulacion  TEXT
);
CREATE INDEX IF NOT EXISTS idx_notas_credito_factura ON notas_credito(factura_id);
CREATE INDEX IF NOT EXISTS idx_notas_credito_cliente  ON notas_credito(cliente_id);

-- Vista de saldo: las notas de crédito activas aumentan el saldo (reversan pagos).
-- La nueva columna notas_credito se agrega al FINAL para mantener compatibilidad
-- con CREATE OR REPLACE VIEW sobre la vista existente.
CREATE OR REPLACE VIEW factura_saldo AS
SELECT
  f.factura_id,
  f.numero_factura,
  f.pedido_id,
  f.cliente_id,
  f.fecha_emision,
  f.fecha_vencimiento,
  f.subtotal::float8   AS subtotal,
  f.impuestos::float8  AS impuestos,
  f.total::float8      AS total,
  COALESCE(SUM(p.valor), 0)::float8 AS valor_pagado,
  (f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0))::float8 AS saldo,
  f.estado,
  CASE
    WHEN f.estado = 'ANULADA'                                          THEN 'ANULADA'
    WHEN COALESCE(SUM(p.valor), 0) - COALESCE(SUM(nc.valor), 0) <= 0   THEN 'PENDIENTE'
    WHEN f.total - COALESCE(SUM(p.valor), 0) + COALESCE(SUM(nc.valor), 0) <= 0 THEN 'PAGADA'
    ELSE 'PAGO_PARCIAL'
  END AS estado_pago,
  f.motivo_anulacion,
  f.fecha_anulacion,
  COALESCE(SUM(nc.valor), 0)::float8 AS notas_credito
FROM facturas f
LEFT JOIN pagos p ON p.factura_id = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA'
GROUP BY f.factura_id;
````

### Archivo `database/migracion_recuperacion_contrasena.sql`

**Archivo:** `database/migracion_recuperacion_contrasena.sql` · 31 líneas

````sql
-- ------------------------------------------------------------
-- FINAN-X · Migración: recuperación de contraseña (código OTP) y
--            datos de pago en línea (tarjeta / transferencia)
-- Aplicar con: docker exec -i finanx-db psql -U finanx -d finanx < migracion_recuperacion_contrasena.sql
-- ------------------------------------------------------------

-- 1) Solicitudes de recuperación de contraseña con código de un solo uso (OTP)
--    El código se guarda CIFRADO (bcrypt) y caduca; nunca en texto plano.
CREATE TABLE IF NOT EXISTS recuperaciones_clave (
  recuperacion_id    SERIAL PRIMARY KEY,
  usuario_cliente_id INT NOT NULL REFERENCES usuario_cliente(usuario_cliente_id) ON DELETE CASCADE,
  canal              VARCHAR(10) NOT NULL CHECK (canal IN ('EMAIL', 'SMS')),
  codigo_hash        TEXT NOT NULL,
  intentos           INT NOT NULL DEFAULT 0,
  usado              BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en          TIMESTAMPTZ NOT NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recuperaciones_cliente ON recuperaciones_clave(usuario_cliente_id, usado);

-- 2) Datos de pago en línea (tarjeta / transferencia / cheque).
--    Por buenas prácticas de seguridad (PCI-DSS) NUNCA se almacenan
--    el número completo de la tarjeta ni el código de seguridad (CVV).
--    Solo se guardan los últimos 4 dígitos y datos no sensibles.
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS titular TEXT;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS tipo_tarjeta TEXT;              -- VISA / MASTERCARD / AMEX / OTRA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS ultimos_digitos_tarjeta TEXT;   -- solo 4 dígitos
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS vencimiento_tarjeta TEXT;       -- MM/AA
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS numero_cuenta TEXT;             -- transferencia
````

---

# PARTE 2 · El backend (Node.js + Express)

## 2.1 ¿Qué es el backend en este proyecto?

Es un servidor **Node.js** que usa el framework **Express**: en vez de configurar a mano cada detalle de HTTP, Express te deja escribir "rutas" (endpoints) en pocas líneas. El flujo de una petición es:

```
Navegador ──► POST /api/pagos ──► middleware (auth, roles) ──► ruta pagos() ──► SQL ──► PostgreSQL
                                                                   │
                                   respuesta JSON ◄── validaciones/auditoría
```

🔑 **Regla de oro del proyecto:** el frontend casi no calcula nada; **todas las reglas de negocio están en el backend** (y las que son "de integridad", en la base de datos). Si alguien llama a la API directamente, las reglas siguen aplicándose.

## 2.2 El archivo de configuración del paquete

### Archivo `backend/package.json`

**Archivo:** `backend/package.json` · 23 líneas

````json
{
  "name": "finanx-backend",
  "version": "1.0.0",
  "description": "API REST de FINAN-X (facturación y pagos)",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "seed": "node src/seed.js",
    "test": "node scripts/e2e.mjs"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.5.1",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.13.0"
  }
}
````

**Léelo así:**
- `"type": "module"` → usa los `import` modernos de JavaScript (verás `import ... from '...'`).
- `npm start` → arranca la API; `npm run dev` → la arranca y la reinicia sola al guardar; `npm run seed` → carga los datos demo; `npm test` → corre las 99 pruebas e2e.
- Dependencias principales: **express** (servidor), **pg** (hablar con PostgreSQL), **jsonwebtoken** (JWT), **bcryptjs** (hashes), **helmet** (cabeceras de seguridad), **cors** (permitir orígenes), **express-rate-limit** (anti-abuso), **dotenv** (variables de entorno).

## 2.3 El punto de entrada: `index.js`

Este archivo es el "director de orquesta". Hace 4 cosas:
1. Crea la app Express y le pone **middlewares globales** (`helmet`, `cors`, `json`).
2. Define el endpoint de salud `GET /api/health` (para comprobar que la API vive).
3. **Monta cada grupo de rutas** en su prefijo: todo lo de `/api/auth` va a `routes/auth.js`, etc.
4. Pone dos "redes de seguridad": si ninguna ruta coincide responde **404**; si una ruta lanza un error, lo convierte en una respuesta JSON clara (500 si es interno).

### Archivo `backend/src/index.js`

**Archivo:** `backend/src/index.js` · 65 líneas

````js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';
import clientesRouter from './routes/clientes.js';
import productosRouter from './routes/productos.js';
import pedidosRouter from './routes/pedidos.js';
import facturasRouter from './routes/facturas.js';
import pagosRouter from './routes/pagos.js';
import notasCreditoRouter from './routes/notas-credito.js';
import reportesRouter from './routes/reportes.js';
import auditoriaRouter from './routes/auditoria.js';
import misRouter from './routes/mis.js';
import { HttpError } from './utils.js';

const app = express();

// req.ip real detrás de nginx (que reenvía X-Forwarded-For) — una sola capa de proxy.
app.set('trust proxy', 1);

// Cabeceras de seguridad (CSP, X-Content-Type-Options, X-Frame-Options, etc.).
app.use(helmet());

// CORS restringido a los orígenes permitidos (el navegador rechaza los demás).
app.use(cors({
  origin(origin, cb) {
    // Solicitudes sin cabecera Origin (curl, Node, misma-origen) se aceptan.
    if (!origin) return cb(null, true);
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    // Origen no permitido: se responde sin Access-Control-Allow-Origin → el navegador lo bloquea.
    return cb(null, false);
  },
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'FINAN-X API', hora: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/facturas', facturasRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/notas-credito', notasCreditoRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/auditoria', auditoriaRouter);
app.use('/api', misRouter); // /api/mis-*

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, () => {
  console.log(`FINAN-X API escuchando en http://localhost:${config.port}  (${config.db.database}@${config.db.host}:${config.db.port})`);
});
````

Para verlo completo en tu proyecto (son 65 líneas), abre `backend/src/index.js` en VS Code. Los middlewares `router.use(requireAuth, requireRol(...))` que verás en cada ruta son los "porteros" de los que hablamos.

## 2.4 Configuración: `config.js`

Centraliza **todo lo configurable** en un solo objeto, tomado de variables de entorno (con valores por defecto seguros para desarrollo). Fíjate en las validaciones de producción: si `NODE_ENV=production` y el secreto JWT es corto, **el servidor se niega a arrancar** (seguridad).

### Archivo `backend/src/config.js`

**Archivo:** `backend/src/config.js` · 42 líneas

````js
import 'dotenv/config';

const esProduccion = process.env.NODE_ENV === 'production';

// Refuerzo de seguridad: en producción se exige un secreto JWT fuerte (≥32 caracteres).
if (esProduccion) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      'FINAN-X: en producción es obligatorio definir JWT_SECRET con al menos 32 caracteres. ' +
      'Configúrelo en docker-compose o en las variables de entorno antes de arrancar.'
    );
    process.exit(1);
  }
} else if (!process.env.JWT_SECRET) {
  console.warn('FINAN-X: usando JWT_SECRET de desarrollo "finanx-dev-secret". Defina JWT_SECRET para producción.');
}

export const config = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'finanx',
    password: process.env.PGPASSWORD || 'finanx',
    database: process.env.PGDATABASE || 'finanx',
  },
  jwtSecret: process.env.JWT_SECRET || 'finanx-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES || '8h',
  /** Orígenes permitidos por CORS (el navegador solo recibe la cabecera si el origen está aquí). */
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080')
    .split(',').map((s) => s.trim()).filter(Boolean),
  /** Intentos fallidos de login permitidos por IP antes de bloquear 429 (ventana de 15 min). */
  loginMaxFallidos: Number(process.env.LOGIN_MAX_FAILURES) || 5,
  /** Máximo de solicitudes de autoregistro por IP en 1 hora (anti-spam). */
  registroRateMax: Number(process.env.REGISTRO_RATE_LIMIT) || 20,
  /** OTP (código de un solo uso) para recuperar contraseña. */
  otpDemo: (process.env.OTP_RETORNO_DEMO || 'on') !== 'off',      // 'on': el código vuelve en la respuesta (solo demo)
  otpValidezMinutos: Number(process.env.OTP_VALIDEZ_MINUTOS) || 10,
  otpMaxIntentos: Number(process.env.OTP_MAX_INTENTOS) || 5,
  /** Máximo de solicitudes/intentos de recuperación de contraseña por IP en 15 min (anti-spam OTP). */
  recuperarRateMax: Number(process.env.RECUPERAR_RATE_LIMIT) || 40,
};
````

## 2.5 Conexión a la base: `db.js`

Crea un **pool de conexiones** (hasta 10 a la vez) usando los datos de `config.js`. Un pool es más eficiente que abrir/conectar una conexión en cada consulta.

### Archivo `backend/src/db.js`

**Archivo:** `backend/src/db.js` · 15 líneas

````js
import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 10,
});

pool.on('error', (err) => console.error('Error inesperado en el pool de PG:', err.message));

export default pool;
````

## 2.6 Middleware de autenticación: `middleware/auth.js`

Contiene la "tripulación" que protege todas las rutas:
- `signToken(payload)` → crea un JWT que expira a las 8 horas (ver `config.jwtExpiresIn`).
- `requireAuth` → lee la cabecera `Authorization: Bearer …`, verifica la firma y adjunta `req.user` (quién eres). Si el token falta o es inválido → **401**.
- `requireRol(...)` → además exige que seas usuario **interno** y con **uno de los roles** indicados → si no, **403**.
- `requireCliente` → exige que el token sea de un **cliente** con `clienteId` → ese id es el que se usa SIEMPRE en el portal (aislamiento: nadie ve facturas ajenas).

### Archivo `backend/src/middleware/auth.js`

**Archivo:** `backend/src/middleware/auth.js` · 43 líneas

````js
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Exige un token válido. Adjunta req.user = { tipo, ... } */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

/** Autorización por rol (solo usuarios internos). */
export function requireRol(...roles) {
  return (req, res, next) => {
    if (req.user.tipo !== 'interno') {
      return res.status(403).json({ error: 'Operación reservada para usuarios internos' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: `Requiere rol: ${roles.join(', ')}` });
    }
    next();
  };
}

/** Exige que el token sea de un cliente y tenga clienteId (aislamiento por cliente). */
export function requireCliente(req, res, next) {
  if (req.user.tipo !== 'cliente') {
    return res.status(403).json({ error: 'Operación reservada para clientes' });
  }
  if (!req.user.clienteId) {
    return res.status(403).json({ error: 'La cuenta no está vinculada a un cliente' });
  }
  next();
}
````

## 2.7 Middleware de auditoría: `middleware/audit.js`

La función `audit({...})` inserta una fila en la tabla `auditoria`. Se llama en casi todos los endpoints que **cambian** datos, con el módulo, la operación y una descripción legible.

### Archivo `backend/src/middleware/audit.js`

**Archivo:** `backend/src/middleware/audit.js` · 18 líneas

````js
import pool from '../db.js';

/** Registra una operación relevante en auditoría. */
export async function audit({ usuario, usuarioTipo = 'INTERNO', modulo, operacion, registro = '', descripcion = '' }) {
  try {
    await pool.query(
      `INSERT INTO auditoria (usuario, usuario_tipo, modulo, operacion, registro_afectado, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuario || null, usuarioTipo, modulo, operacion, String(registro || ''), descripcion || '']
    );
  } catch (err) {
    console.error('Fallo al registrar auditoría:', err.message);
  }
}

export const AUDITOR = {
  modulo: (m) => (usuario) => ({ usuario, modulo: m, operacion: '', registro: '', descripcion: '' }),
};
````

## 2.8 Middleware anti fuerza-bruta: `middleware/rateLimit.js`

Protege el inicio de sesión: si una IP acumula **5 intentos fallidos** en 15 minutos, los siguientes responden **429** ("espere 15 minutos"). Clave: solo cuenta *fallos*; un acierto limpia el contador, así un usuario legítimo nunca se bloquea por equivocarse. En producción real este contador iría a Redis, pero para una sola instancia la memoria alcanza.

### Archivo `backend/src/middleware/rateLimit.js`

**Archivo:** `backend/src/middleware/rateLimit.js` · 54 líneas

````js
/**
 * FINAN-X · Limitador de intentos fallidos de inicio de sesión (por IP, en memoria).
 *
 * Estrategia: solo se cuentan los intentos FALLIDOS (401). Un login exitoso
 * limpia el contador, de modo que un usuario legítimo nunca queda bloqueado
 * por equivocarse unas veces. Al superar el umbral, cada NUEVO fallo responde 429.
 *
 * Nota: al ser en memoria, en un despliegue multi-instancia habría que mover
 * este contador a Redis. Para este proyecto (una sola instancia) es suficiente.
 */
import { config } from '../config.js';

const fallosPorIp = new Map(); // ip -> { contador, ventanaInicia }
const VENTANA_MS = 15 * 60 * 1000;

function ipDe(req) {
  return req.ip || req.socket?.remoteAddress || 'desconocido';
}

/** Evita que el Map crezca sin límite: descarta entradas vencidas o poda. */
function podar(ahora) {
  if (fallosPorIp.size <= 5000) return;
  for (const [ip, r] of fallosPorIp) {
    if (ahora - r.ventanaInicia >= VENTANA_MS) fallosPorIp.delete(ip);
  }
}

/**
 * Registra un intento fallido. Si la IP ya superó el umbral en la ventana,
 * responde 429 y devuelve true (ya respondió). Si no, devuelve false.
 */
export function registrarFalloLogin(req, res) {
  const ip = ipDe(req);
  const ahora = Date.now();
  podar(ahora);
  const r = fallosPorIp.get(ip);
  if (r && ahora - r.ventanaInicia < VENTANA_MS) {
    r.contador += 1;
    if (r.contador >= config.loginMaxFallidos) {
      res.status(429).json({
        error: 'Demasiados intentos fallidos de inicio de sesión. Espere 15 minutos antes de volver a intentar.',
      });
      return true;
    }
  } else {
    fallosPorIp.set(ip, { contador: 1, ventanaInicia: ahora });
  }
  return false;
}

/** Un login exitoso limpia el contador de la IP. */
export function limpiarFallosLogin(req) {
  fallosPorIp.delete(ipDe(req));
}
````

## 2.9 Middleware de notificaciones: `middleware/notificar.js`

Como este es un proyecto académico/demo, no hay proveedor real de SMS ni correo: `enviarCodigo` solo escribe el código OTP en la consola del backend (y en modo demo la API lo devuelve en la respuesta, ver `config.otpDemo`). El comentario del archivo te indica los proveedores reales a conectar en producción.

### Archivo `backend/src/middleware/notificar.js`

**Archivo:** `backend/src/middleware/notificar.js` · 18 líneas

````js
/**
 * FINAN-X · Envío de códigos de un solo uso (OTP) para recuperación de contraseña.
 *
 * Este entorno (académico/demostración) no dispone de un proveedor real de SMS o correo,
 * por lo que el código se escribe en la consola del backend y (en modo demo) la API lo
 * devuelve en la respuesta para poder probar el flujo completo.
 *
 * Para producción, conecte aquí su proveedor real (no cambie la firma de la función):
 *   - SMS: Twilio / MessageBird / AWS SNS
 *   - Correo: nodemailer con SMTP / Resend / SendGrid
 */
export async function enviarCodigo({ canal, destino, codigo }) {
  const destinoVisible = destino && String(destino).length > 4
    ? `${String(destino).slice(0, 2)}***${String(destino).slice(-2)}`
    : '(sin contacto registrado)';
  // eslint-disable-next-line no-console
  console.log(`[OTP] canal=${canal} destino=${destinoVisible} codigo=${codigo} — DEMO: en producción se enviaría por ${canal === 'SMS' ? 'SMS' : 'correo electrónico'}`);
}
````

## 2.10 Utilidades: `utils.js`

Funciones sueltas que se usan en varias rutas:
- `HttpError(status, mensaje)` → errores con código HTTP (los atrapa el manejador de `index.js`).
- `round2` → redondea a 2 decimales para dinero (evita los clásicos errores de punto flotante: `0.1 + 0.2`).
- `validarLuhn` / `derivarTipoTarjeta` → valida y marca las tarjetas (VISA, MASTERCARD, AMEX).
- `validarDatosPago(metodo, body)` → ⭐ valida y **limpia** los datos según el método: para `TARJETA` exige 13-19 dígitos + Luhn + CVV de 3-4 + vencimiento no vencido + banco + titular, y **devuelve solo lo seguro** (últimos 4 dígitos, nunca el CVV). Para `TRANSFERENCIA` exige banco, cuenta (4-20 dígitos) y referencia. Para `CHEQUE`, banco y número. Para `EFECTIVO` no exige nada.

### Archivo `backend/src/utils.js`

**Archivo:** `backend/src/utils.js` · 95 líneas

````js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Redondea a 2 decimales para evitar errores de punto flotante en cálculos monetarios. */
export const round2 = (n) => Math.round((Number(n || 0)) * 100) / 100;

export const num = (v) => Number(v || 0);

/** Algoritmo de Luhn: valida el dígito verificador de un número de tarjeta. */
export function validarLuhn(numero) {
  const n = String(numero || '').replace(/\D/g, '');
  if (!/^\d{13,19}$/.test(n)) return false;
  let suma = 0;
  let doble = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

/** Marca comercial de una tarjeta según los primeros dígitos (solo para mostrar). */
export function derivarTipoTarjeta(numero) {
  const n = String(numero || '').replace(/\D/g, '');
  if (/^4/.test(n)) return 'VISA';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'MASTERCARD';
  if (/^3[47]/.test(n)) return 'AMEX';
  return 'OTRA';
}

/**
 * Valida y normaliza los datos requeridos por método de pago (pago en línea).
 * - TARJETA: número (13–19 dígitos + Luhn), CVV (nunca se almacena), vencimiento MM/AA, banco, titular.
 * - TRANSFERENCIA: banco, número de cuenta y referencia del comprobante.
 * - CHEQUE: banco y número de cheque (referencia).
 * - EFECTIVO: sin datos adicionales.
 * Devuelve solo los campos seguros para persistir (nunca CVV ni número completo).
 */
export function validarDatosPago(metodoPago, body = {}) {
  const b = body || {};
  const limpiar = (v) => String(v || '').trim();
  const numeros = (v) => String(v || '').replace(/\D/g, '');

  if (metodoPago === 'TARJETA') {
    const n = numeros(b.numeroTarjeta);
    const cvv = numeros(b.codigoSeguridad);
    const vto = limpiar(b.vencimientoTarjeta);
    const banco = limpiar(b.banco);
    const titular = limpiar(b.titularTarjeta);
    if (!/^\d{13,19}$/.test(n)) throw new HttpError(400, 'Tarjeta: el número es inválido (13 a 19 dígitos)');
    if (!validarLuhn(n)) throw new HttpError(400, 'Tarjeta: el número no pasa la validación de dígito verificador (Luhn)');
    if (!/^\d{3,4}$/.test(cvv)) throw new HttpError(400, 'Tarjeta: código de seguridad inválido (3 o 4 dígitos)');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(vto)) throw new HttpError(400, 'Tarjeta: vencimiento inválido (formato MM/AA)');
    const [mm, aa] = vto.split('/').map(Number);
    const vence = new Date(2000 + aa, mm, 0); // último día del mes de vencimiento
    if (vence < new Date()) throw new HttpError(400, 'Tarjeta: la tarjeta está vencida');
    if (!banco) throw new HttpError(400, 'Tarjeta: indique el banco emisor');
    if (titular.length < 3) throw new HttpError(400, 'Tarjeta: indique el titular de la tarjeta');
    return {
      banco, titular,
      tipo_tarjeta: derivarTipoTarjeta(n),
      ultimos_digitos_tarjeta: n.slice(-4),
      vencimiento_tarjeta: vto,
    };
  }

  if (metodoPago === 'TRANSFERENCIA') {
    const banco = limpiar(b.banco);
    const cuenta = numeros(b.numeroCuenta);
    const ref = limpiar(b.referencia);
    if (!banco) throw new HttpError(400, 'Transferencia: indique el banco');
    if (!/^\d{4,20}$/.test(cuenta)) throw new HttpError(400, 'Transferencia: número de cuenta inválido (4 a 20 dígitos)');
    if (ref.length < 4) throw new HttpError(400, 'Transferencia: indique una referencia (n.º de comprobante)');
    return { banco, numero_cuenta: cuenta };
  }

  if (metodoPago === 'CHEQUE') {
    const banco = limpiar(b.banco);
    const ref = limpiar(b.referencia);
    if (!banco) throw new HttpError(400, 'Cheque: indique el banco');
    if (ref.length < 4) throw new HttpError(400, 'Cheque: indique el número del cheque (referencia)');
    return { banco };
  }

  return {}; // EFECTIVO: sin datos adicionales
}
````

## 2.11 Ruta de autenticación: `routes/auth.js`

Aquí viven **tres** funcionalidades:

1. **`POST /api/auth/login`** — recibe `{username, password}` y busca, primero, entre los usuarios internos (por correo) y, si no, entre las cuentas de cliente (`usuario_cliente`). Verifica el hash con bcrypt, actualiza `ultimo_acceso`, firma el token y audita `LOGIN` (o `LOGIN_FALLIDO` + cuenta de fallo para el bloquear fuerza-bruta).
2. **`POST /api/auth/registro`** — el **autoregistro del cliente** (el botón "Crear cuenta" del login): valida que no exista otro cliente con la misma identificación ni el mismo usuario, inserta **cliente + cuenta** en una **transacción** (todo o nada), y deja al cliente autenticado para que entre directo al portal.
3. **`POST /api/auth/recuperar-solicitar`** y **`.../recuperar-cambiar`** — recuperación de contraseña con **código OTP de 6 dígitos**: se genera, se guarda cifrado en `recuperaciones_clave` con expiración y límite de intentos, y en modo demo la respuesta trae `demo_otp` para poder probar.

### Archivo `backend/src/routes/auth.js`

**Archivo:** `backend/src/routes/auth.js` · 273 líneas

````js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { config } from '../config.js';
import { signToken } from '../middleware/auth.js';
import { registrarFalloLogin, limpiarFallosLogin } from '../middleware/rateLimit.js';
import { audit } from '../middleware/audit.js';
import { enviarCodigo } from '../middleware/notificar.js';
import { HttpError } from '../utils.js';

const router = Router();

// Anti-spam: máx. de solicitudes de autoregistro por IP en 1 hora.
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.registroRateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de registro desde esta dirección. Intente más tarde.' },
});

// Anti-spam: recuperación de contraseña (solicitar código + validar/cambiar) por IP.
// Límite holgado (15 min) para no bloquear usuarios legítimos ni las pruebas e2e re-ejecutadas.
const recuperarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.recuperarRateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación desde esta dirección. Intente más tarde.' },
});

// POST /api/auth/login  — usuario interno o cliente
router.post('/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  try {
    if (!username || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');

    // 1) Buscar usuario interno por correo
    const interno = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.correo, u.password_hash, u.estado, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.rol_id = u.rol_id
       WHERE LOWER(u.correo) = LOWER($1)`,
      [username]
    );

    if (interno.rowCount) {
      const u = interno.rows[0];
      if (u.estado !== 'ACTIVO') throw new HttpError(403, 'La cuenta está inactiva');
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) throw new HttpError(401, 'Credenciales incorrectas');

      const user = { tipo: 'interno', usuarioId: u.usuario_id, nombre: u.nombre, correo: u.correo, rol: u.rol };
      const token = signToken(user);
      limpiarFallosLogin(req); // un acierto resetea el contador de fallos de la IP
      await audit({ usuario: u.correo, modulo: 'Autenticación', operacion: 'LOGIN', descripcion: `Inicio de sesión de ${u.correo} (${u.rol})` });
      return res.json({ token, user });
    }

    // 2) Buscar cuenta de cliente
    const cli = await pool.query(
      `SELECT uc.usuario_cliente_id, uc.cliente_id, uc.username, uc.password_hash, uc.estado AS cuenta_estado,
              c.nombre_razon_social, c.estado AS cliente_estado
       FROM usuario_cliente uc JOIN clientes c ON c.cliente_id = uc.cliente_id
       WHERE LOWER(uc.username) = LOWER($1)`,
      [username]
    );

    if (cli.rowCount) {
      const c = cli.rows[0];
      if (c.cuenta_estado !== 'ACTIVO') throw new HttpError(403, 'La cuenta está inactiva');
      if (c.cliente_estado !== 'ACTIVO') throw new HttpError(403, 'El cliente está inactivo');
      const ok = await bcrypt.compare(password, c.password_hash);
      if (!ok) throw new HttpError(401, 'Credenciales incorrectas');

      await pool.query('UPDATE usuario_cliente SET ultimo_acceso = NOW() WHERE usuario_cliente_id = $1', [c.usuario_cliente_id]);

      const user = {
        tipo: 'cliente', usuarioClienteId: c.usuario_cliente_id, clienteId: c.cliente_id,
        nombre: c.nombre_razon_social, username: c.username,
      };
      const token = signToken(user);
      limpiarFallosLogin(req); // un acierto resetea el contador de fallos de la IP
      await audit({ usuario: c.username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'LOGIN', descripcion: `Inicio de sesión del cliente ${c.nombre_razon_social}` });
      return res.json({ token, user });
    }

    throw new HttpError(401, 'Credenciales incorrectas');
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      await audit({ usuario: username || '?', modulo: 'Autenticación', operacion: 'LOGIN_FALLIDO', descripcion: `Intento fallido para ${username || '?'}` });
      // Protección contra fuerza bruta: los fallos consecutivos de una IP la bloquean (429).
      if (registrarFalloLogin(req, res)) return; // ya respondió 429
    }
    next(err);
  }
});

router.post('/registro', registroLimiter, async (req, res, next) => {
  const b = req.body || {};
  const {
    tipoCliente = 'PERSONA', tipoIdentificacion = 'CC', numeroIdentificacion, nombreRazonSocial,
    telefono, correo, direccion, ciudad, username, password,
  } = b;
  try {
    if (!numeroIdentificacion || !nombreRazonSocial) throw new HttpError(400, 'Número de identificación y nombre son obligatorios');
    if (!username || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');
    if (String(password).length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
    if (!/^[a-zA-Z0-9._@-]{3,}$/.test(String(username))) throw new HttpError(400, 'El usuario debe tener al menos 3 caracteres (letras, números, . _ @ -)');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Regla: no duplicar cliente por tipo + número de identificación
      const dupIdent = await client.query(
        'SELECT 1 FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
        [tipoIdentificacion, numeroIdentificacion]
      );
      if (dupIdent.rowCount) throw new HttpError(409, 'Ya existe un cliente con esa identificación');

      // El usuario no debe chocar con cuentas de clientes ni con correos de usuarios internos
      const dupUser = await client.query(
        `SELECT 1 FROM usuario_cliente WHERE LOWER(username) = LOWER($1)
         UNION
         SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER($1)`,
        [username]
      );
      if (dupUser.rowCount) throw new HttpError(409, 'Ese nombre de usuario ya está en uso');

      const cli = await client.query(
        `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING cliente_id`,
        [tipoCliente, tipoIdentificacion, numeroIdentificacion, nombreRazonSocial, telefono || null, correo || null, direccion || null, ciudad || null]
      );
      const clienteId = cli.rows[0].cliente_id;

      const hash = await bcrypt.hash(password, 10);
      const uc = await client.query(
        'INSERT INTO usuario_cliente (cliente_id, username, password_hash) VALUES ($1, $2, $3) RETURNING usuario_cliente_id',
        [clienteId, username, hash]
      );

      await client.query('COMMIT');

      await audit({
        usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Clientes', operacion: 'AUTORREGISTRO',
        registro: clienteId, descripcion: `Autoregistro del cliente ${nombreRazonSocial} (${tipoIdentificacion} ${numeroIdentificacion})`,
      });

      // El cliente queda autenticado y puede entrar al portal de inmediato
      const user = { tipo: 'cliente', usuarioClienteId: uc.rows[0].usuario_cliente_id, clienteId, nombre: nombreRazonSocial, username };
      const token = signToken(user);
      return res.status(201).json({ token, user });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/** Genera un código de un solo uso de 6 dígitos. */
function generarOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Enmascara el destino (correo/teléfono) para mostrarlo de forma segura. */
function enmascarar(destino) {
  const s = String(destino || '');
  if (s.length <= 4) return '***';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

// POST /api/auth/recuperar-solicitar — pide el código de un solo uso (se envía por SMS o correo)
router.post('/recuperar-solicitar', recuperarLimiter, async (req, res, next) => {
  try {
    const { username, canal = 'EMAIL' } = req.body || {};
    if (!username) throw new HttpError(400, 'Indique su usuario o correo');
    if (!['EMAIL', 'SMS'].includes(canal)) throw new HttpError(400, 'Canal de entrega inválido (EMAIL o SMS)');

    const uc = await pool.query(
      `SELECT uc.usuario_cliente_id, c.correo, c.telefono
       FROM usuario_cliente uc JOIN clientes c ON c.cliente_id = uc.cliente_id
       WHERE LOWER(uc.username) = LOWER($1)`,
      [username]
    );

    if (uc.rowCount) {
      const destino = canal === 'SMS' ? uc.rows[0].telefono : uc.rows[0].correo;
      const codigo = generarOtp();
      // Solo una solicitud vigente por cuenta: invalida las anteriores
      await pool.query(
        'UPDATE recuperaciones_clave SET usado = TRUE WHERE usuario_cliente_id = $1 AND usado = FALSE',
        [uc.rows[0].usuario_cliente_id]
      );
      await pool.query(
        `INSERT INTO recuperaciones_clave (usuario_cliente_id, canal, codigo_hash, expira_en)
         VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
        [uc.rows[0].usuario_cliente_id, canal, await bcrypt.hash(codigo, 10), config.otpValidezMinutos]
      );
      await enviarCodigo({ canal, destino, codigo });
      await audit({
        usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'RECUPERAR_SOLICITAR',
        descripcion: `Solicitud de recuperación de contraseña vía ${canal === 'SMS' ? 'SMS' : 'correo'}`,
      });
      // Respuesta genérica para no revelar si la cuenta existe; en modo demo se entrega el código
      const base = {
        mensaje: `Si la cuenta existe, recibirá su código de seguridad por ${canal === 'SMS' ? 'SMS' : 'correo electrónico'}.`,
      };
      if (config.otpDemo) base.demo_otp = codigo;
      if (config.otpDemo) base.destino = destino ? enmascarar(destino) : null;
      if (config.otpDemo) base.canal = canal;
      return res.json(base);
    }

    res.json({ mensaje: 'Si la cuenta existe, recibirá un código de seguridad.' });
  } catch (e) { next(e); }
});

// POST /api/auth/recuperar-cambiar — valida el código de un solo uso y registra la nueva contraseña
router.post('/recuperar-cambiar', recuperarLimiter, async (req, res, next) => {
  try {
    const { username = '', codigo = '', nuevaClave = '' } = req.body || {};
    if (!username) throw new HttpError(400, 'Indique su usuario o correo');
    if (!/^\d{6}$/.test(String(codigo))) throw new HttpError(400, 'El código de seguridad debe tener 6 dígitos');
    if (String(nuevaClave).length < 6) throw new HttpError(400, 'La nueva contraseña debe tener al menos 6 caracteres');

    const uc = await pool.query(
      `SELECT usuario_cliente_id FROM usuario_cliente WHERE LOWER(username) = LOWER($1) AND estado = 'ACTIVO'`,
      [username]
    );
    if (!uc.rowCount) throw new HttpError(404, 'Cuenta no encontrada o inactiva');

    const rec = await pool.query(
      `SELECT recuperacion_id, codigo_hash, intentos, expira_en FROM recuperaciones_clave
       WHERE usuario_cliente_id = $1 AND usado = FALSE
       ORDER BY recuperacion_id DESC LIMIT 1`,
      [uc.rows[0].usuario_cliente_id]
    );
    if (!rec.rowCount) throw new HttpError(400, 'No hay una solicitud vigente de recuperación. Solicite un código nuevo.');
    const r = rec.rows[0];
    if (r.intentos >= config.otpMaxIntentos) {
      await pool.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE recuperacion_id = $1', [r.recuperacion_id]);
      throw new HttpError(429, 'Demasiados intentos con el código. Solicite uno nuevo.');
    }
    if (new Date(r.expira_en).getTime() < Date.now()) throw new HttpError(400, 'El código de seguridad expiró. Solicite uno nuevo.');

    const ok = await bcrypt.compare(String(codigo), r.codigo_hash);
    if (!ok) {
      const nuevos = r.intentos + 1;
      await pool.query('UPDATE recuperaciones_clave SET intentos = $1 WHERE recuperacion_id = $2', [nuevos, r.recuperacion_id]);
      if (nuevos >= config.otpMaxIntentos) {
        await pool.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE recuperacion_id = $1', [r.recuperacion_id]);
      }
      throw new HttpError(401, 'Código de seguridad incorrecto');
    }

    const hash = await bcrypt.hash(String(nuevaClave), 10);
    await pool.query('UPDATE usuario_cliente SET password_hash = $1 WHERE usuario_cliente_id = $2', [hash, uc.rows[0].usuario_cliente_id]);
    await pool.query('UPDATE recuperaciones_clave SET usado = TRUE WHERE usuario_cliente_id = $1', [uc.rows[0].usuario_cliente_id]);
    await audit({
      usuario: username, usuarioTipo: 'CLIENTE', modulo: 'Autenticación', operacion: 'CLAVE_RECUPERADA',
      descripcion: 'Contraseña restablecida mediante código de seguridad',
    });
    res.json({ mensaje: 'Contraseña actualizada. Ya puede iniciar sesión con su nueva contraseña.' });
  } catch (e) { next(e); }
});

export default router;
````

## 2.12 Ruta de clientes: `routes/clientes.js`

CRUD completo para el personal interno (crear, listar/filtrar, ver, actualizar, activar/inactivar) más dos extras:
- `POST /:id/cuenta` — crea la cuenta de acceso del portal para un cliente (solo si no la tiene, con validación de usuario duplicado).
- `GET /:id/resumen-correo` — arma el **texto del estado financiero** del cliente (facturas activas, saldos, notas de crédito) listo para pegar en un `mailto:`.

### Archivo `backend/src/routes/clientes.js`

**Archivo:** `backend/src/routes/clientes.js` · 210 líneas

````js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Clientes';

// GET /api/clientes?q=&estado=&tipo=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', tipo = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length} OR c.correo ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`c.estado = $${params.length}`); }
    if (tipo) { params.push(tipo); conds.push(`c.tipo_cliente = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await pool.query(
      `SELECT c.cliente_id, c.tipo_cliente, c.tipo_identificacion, c.numero_identificacion,
              c.nombre_razon_social, c.telefono, c.correo, c.direccion, c.ciudad, c.estado, c.fecha_creacion,
              (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = c.cliente_id)::int AS total_pedidos,
              (SELECT COALESCE(SUM(f.total - COALESCE((SELECT SUM(pg.valor) FROM pagos pg WHERE pg.factura_id = f.factura_id), 0)), 0)::float8
               FROM facturas f WHERE f.cliente_id = c.cliente_id AND f.estado = 'ACTIVA') AS saldo_pendiente,
              (SELECT COUNT(*) FROM usuario_cliente uc WHERE uc.cliente_id = c.cliente_id)::int AS tiene_cuenta
       FROM clientes c ${where}
       ORDER BY c.cliente_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await pool.query(
      `SELECT c.*,
              (SELECT COALESCE(SUM(f.total - COALESCE((SELECT SUM(pg.valor) FROM pagos pg WHERE pg.factura_id = f.factura_id), 0)), 0)::float8
               FROM facturas f WHERE f.cliente_id = c.cliente_id AND f.estado = 'ACTIVA') AS saldo_pendiente
       FROM clientes c WHERE c.cliente_id = $1`,
      [id]
    );
    if (!rows.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/clientes  — valida duplicados (regla de negocio)
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const { tipoCliente = 'PERSONA', tipoIdentificacion = 'CC', numeroIdentificacion, nombreRazonSocial, telefono, correo, direccion, ciudad } = b;
    if (!numeroIdentificacion || !nombreRazonSocial) throw new HttpError(400, 'Número de identificación y nombre son obligatorios');

    const dup = await pool.query(
      'SELECT 1 FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
      [tipoIdentificacion, numeroIdentificacion]
    );
    if (dup.rowCount) throw new HttpError(409, 'Ya existe un cliente con esa identificación');

    const r = await pool.query(
      `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING cliente_id`,
      [tipoCliente, tipoIdentificacion, numeroIdentificacion, nombreRazonSocial, telefono || null, correo || null, direccion || null, ciudad || null]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: r.rows[0].cliente_id, descripcion: `Cliente ${nombreRazonSocial} (${tipoIdentificacion} ${numeroIdentificacion})` });
    res.status(201).json({ cliente_id: r.rows[0].cliente_id });
  } catch (e) { next(e); }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const exists = await pool.query('SELECT nombre_razon_social FROM clientes WHERE cliente_id = $1', [id]);
    if (!exists.rowCount) throw new HttpError(404, 'Cliente no encontrado');

    await pool.query(
      `UPDATE clientes SET tipo_cliente = $1, tipo_identificacion = $2, numero_identificacion = $3,
              nombre_razon_social = $4, telefono = $5, correo = $6, direccion = $7, ciudad = $8
       WHERE cliente_id = $9`,
      [b.tipoCliente, b.tipoIdentificacion, b.numeroIdentificacion, b.nombreRazonSocial, b.telefono || null, b.correo || null, b.direccion || null, b.ciudad || null, id]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ACTUALIZAR', registro: id, descripcion: `Actualización de cliente ${b.nombreRazonSocial}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /api/clientes/:id/estado
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) throw new HttpError(400, 'Estado inválido');
    const r = await pool.query('UPDATE clientes SET estado = $1 WHERE cliente_id = $2 RETURNING nombre_razon_social', [estado, id]);
    if (!r.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ESTADO', registro: id, descripcion: `Cliente ${r.rows[0].nombre_razon_social} → ${estado}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/clientes/:id/cuenta  — crea cuenta de acceso del cliente
router.post('/:id/cuenta', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { username, password } = req.body || {};
    if (!username || !password) throw new HttpError(400, 'Usuario y contraseña son obligatorios');

    const cli = await pool.query('SELECT nombre_razon_social, estado FROM clientes WHERE cliente_id = $1', [id]);
    if (!cli.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    if (cli.rows[0].estado !== 'ACTIVO') throw new HttpError(400, 'El cliente debe estar activo');

    const cuenta = await pool.query('SELECT 1 FROM usuario_cliente WHERE cliente_id = $1', [id]);
    if (cuenta.rowCount) throw new HttpError(409, 'El cliente ya tiene una cuenta de acceso');

    const userDup = await pool.query('SELECT 1 FROM usuario_cliente WHERE LOWER(username) = LOWER($1)', [username]);
    if (userDup.rowCount) throw new HttpError(409, 'Ese nombre de usuario ya está en uso');

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuario_cliente (cliente_id, username, password_hash) VALUES ($1, $2, $3)',
      [id, username, hash]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'CUENTA', registro: id, descripcion: `Cuenta de acceso creada para ${cli.rows[0].nombre_razon_social} (${username})` });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/clientes/:id/resumen-correo — texto del estado financiero para enviar por correo
router.get('/:id/resumen-correo', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cli = await pool.query(
      `SELECT c.cliente_id, c.tipo_identificacion, c.numero_identificacion, c.nombre_razon_social,
              c.correo, c.telefono, c.ciudad, c.estado
       FROM clientes c WHERE c.cliente_id = $1`,
      [id]
    );
    if (!cli.rowCount) throw new HttpError(404, 'Cliente no encontrado');
    const c = cli.rows[0];

    const facturas = await pool.query(
      `SELECT v.numero_factura, v.fecha_emision, v.fecha_vencimiento, v.total::float8,
              v.valor_pagado::float8, v.saldo::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 AND v.estado = 'ACTIVA'
       ORDER BY v.fecha_emision DESC LIMIT 50`,
      [id]
    );
    const notas = await pool.query(
      `SELECT numero_nota, fecha, valor::float8, motivo FROM notas_credito
       WHERE cliente_id = $1 AND estado = 'ACTIVA' ORDER BY fecha DESC`,
      [id]
    );

    const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0));
    const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const saldoPend = facturas.rows.reduce((s, f) => s + Number(f.saldo), 0);
    const pagado = facturas.rows.reduce((s, f) => s + Number(f.valor_pagado), 0);

    const lineas = [];
    lineas.push(`Estimado(a) ${c.nombre_razon_social}:`);
    lineas.push('');
    lineas.push(`Su estado financiero al ${fecha} en FINAN-X es el siguiente:`);
    lineas.push('');
    lineas.push('FACTURAS ACTIVAS');
    lineas.push('────────────────');
    if (!facturas.rows.length) {
      lineas.push('  No tiene facturas activas en este momento.');
    } else {
      for (const f of facturas.rows) {
        lineas.push(`• ${f.numero_factura} · emitida ${f.fecha_emision.toISOString().slice(0, 10)} · total ${fmt(f.total)} · pagado ${fmt(f.valor_pagado)} · saldo ${fmt(f.saldo)} · ${f.estado_pago}`);
      }
    }
    lineas.push('');
    lineas.push(`SALDO TOTAL PENDIENTE: ${fmt(saldoPend)}`);
    lineas.push(`TOTAL PAGADO: ${fmt(pagado)}`);
    if (notas.rows.length) {
      lineas.push('');
      lineas.push('NOTAS DE CRÉDITO ACTIVAS');
      lineas.push('────────────────────────');
      for (const n of notas.rows) {
        lineas.push(`• ${n.numero_nota} · ${n.fecha.toISOString().slice(0, 10)} · ${fmt(n.valor)} · ${n.motivo}`);
      }
    }
    lineas.push('');
    lineas.push('Puede consultar sus facturas, pagos y saldos en el portal de clientes FINAN-X o contactando nuestra oficina.');
    lineas.push('');
    lineas.push('Atentamente,');
    lineas.push('Equipo FINAN-X');

    res.json({
      destinatario: c.correo || null,
      asunto: `Su estado financiero en FINAN-X · ${fecha}`,
      cuerpo: lineas.join('\n'),
      cliente: { cliente_id: c.cliente_id, nombre_razon_social: c.nombre_razon_social, correo: c.correo },
    });
  } catch (e) { next(e); }
});

export default router;
````

## 2.13 Ruta de productos: `routes/productos.js`

CRUD del catálogo: código único (duplicado → 409), precio no negativo, impuesto entre 0 y 100%, y baja **lógica** (estado `INACTIVO`) para conservar el historial.

### Archivo `backend/src/routes/productos.js`

**Archivo:** `backend/src/routes/productos.js` · 86 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Productos';

// GET /api/productos?q=&estado=&categoria=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', categoria = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(p.nombre ILIKE $${params.length} OR p.codigo ILIKE $${params.length} OR p.descripcion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`p.estado = $${params.length}`); }
    if (categoria) { params.push(categoria); conds.push(`p.categoria ILIKE $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await pool.query(
      `SELECT p.producto_id, p.codigo, p.nombre, p.descripcion, p.categoria, p.precio::float8, p.impuesto::float8,
              p.unidad_medida, p.estado, p.fecha_creacion
       FROM productos p ${where} ORDER BY p.producto_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/productos  — código único
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const { codigo, nombre, descripcion, categoria, precio, impuesto = 0, unidadMedida = 'UND' } = b;
    if (!codigo || !nombre) throw new HttpError(400, 'Código y nombre son obligatorios');
    if (!(Number(precio) >= 0)) throw new HttpError(400, 'El precio no puede ser negativo');

    const dup = await pool.query('SELECT 1 FROM productos WHERE codigo = $1', [codigo]);
    if (dup.rowCount) throw new HttpError(409, 'Ya existe un producto con ese código');

    const r = await pool.query(
      `INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, impuesto, unidad_medida)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING producto_id`,
      [codigo, nombre, descripcion || null, categoria || null, precio, impuesto, unidadMedida]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: r.rows[0].producto_id, descripcion: `Producto ${nombre} (${codigo}) a $${precio}` });
    res.status(201).json({ producto_id: r.rows[0].producto_id });
  } catch (e) { next(e); }
});

// PUT /api/productos/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const exists = await pool.query('SELECT 1 FROM productos WHERE producto_id = $1', [id]);
    if (!exists.rowCount) throw new HttpError(404, 'Producto no encontrado');
    await pool.query(
      `UPDATE productos SET nombre = $1, descripcion = $2, categoria = $3, precio = $4, impuesto = $5, unidad_medida = $6, fecha_actualizacion = NOW()
       WHERE producto_id = $7`,
      [b.nombre, b.descripcion || null, b.categoria || null, b.precio, b.impuesto, b.unidadMedida, id]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ACTUALIZAR', registro: id, descripcion: `Actualización del producto ${b.nombre}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /api/productos/:id/estado  — baja lógica, conserva historial
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) throw new HttpError(400, 'Estado inválido');
    const r = await pool.query('UPDATE productos SET estado = $1, fecha_actualizacion = NOW() WHERE producto_id = $2 RETURNING nombre', [estado, id]);
    if (!r.rowCount) throw new HttpError(404, 'Producto no encontrado');
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ESTADO', registro: id, descripcion: `Producto ${r.rows[0].nombre} → ${estado}` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
````

## 2.14 Ruta de usuarios internos: `routes/usuarios.js`

Solo permitida para `ADMIN` (`router.use(requireAuth, requireRol('ADMIN'))`). Crea usuarios internos con rol, y permite cambiarles estado o contraseña. Nunca devuelve los hashes.

### Archivo `backend/src/routes/usuarios.js`

**Archivo:** `backend/src/routes/usuarios.js` · 71 líneas

````js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN'));

// GET /api/usuarios
router.get('/', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.correo, u.estado, u.fecha_creacion, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.rol_id = u.rol_id
       ORDER BY u.usuario_id`
    );
    res.json(rows.rows.map((u) => ({ ...u, fecha_creacion: u.fecha_creacion })));
  } catch (e) { next(e); }
});

// GET /api/usuarios/roles
router.get('/roles', async (req, res, next) => {
  try {
    const rows = await pool.query('SELECT rol_id, nombre FROM roles ORDER BY rol_id');
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/usuarios
router.post('/', async (req, res, next) => {
  try {
    const { nombre, correo, rol, password } = req.body || {};
    if (!nombre || !correo || !rol || !password) throw new HttpError(400, 'nombre, correo, rol y password son obligatorios');
    const rolRes = await pool.query('SELECT rol_id FROM roles WHERE nombre = $1', [rol]);
    if (!rolRes.rowCount) throw new HttpError(400, `Rol inválido: ${rol}`);
    const dup = await pool.query('SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER($1)', [correo]);
    if (dup.rowCount) throw new HttpError(409, 'Ya existe un usuario con ese correo');
    const hash = await bcrypt.hash(password, 10);
    const resInsert = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol_id) VALUES ($1, $2, $3, $4) RETURNING usuario_id`,
      [nombre, correo, hash, rolRes.rows[0].rol_id]
    );
    await audit({ usuario: req.user.correo, modulo: 'Usuarios', operacion: 'CREAR', registro: resInsert.rows[0].usuario_id, descripcion: `Creación del usuario ${correo} (${rol})` });
    res.status(201).json({ usuario_id: resInsert.rows[0].usuario_id });
  } catch (e) { next(e); }
});

// PATCH /api/usuarios/:id  — estado y/o contraseña
router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado, password } = req.body || {};
    const usu = await pool.query('SELECT correo FROM usuarios WHERE usuario_id = $1', [id]);
    if (!usu.rowCount) throw new HttpError(404, 'Usuario no encontrado');

    if (estado) {
      await pool.query('UPDATE usuarios SET estado = $1 WHERE usuario_id = $2', [estado, id]);
      await audit({ usuario: req.user.correo, modulo: 'Usuarios', operacion: 'ESTADO', registro: id, descripcion: `Usuario ${usu.rows[0].correo} → ${estado}` });
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE usuarios SET password_hash = $1 WHERE usuario_id = $2', [hash, id]);
      await audit({ usuario: req.user.correo, modulo: 'Usuarios', operacion: 'CLAVE', registro: id, descripcion: 'Cambio de contraseña' });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
````

## 2.15 Ruta de pedidos: `routes/pedidos.js`

Lista, crea, actualiza estado y cancela pedidos. Lo importante está en el **POST**: dentro de una transacción inserta el pedido y sus líneas, **calcula subtotal, impuestos y total en el servidor** (nunca confía en lo que manda el navegador), asigna el número `PED-000001`, y audita. La cancelación solo se permite en `BORRADOR`/`CONFIRMADO`.

### Archivo `backend/src/routes/pedidos.js`

**Archivo:** `backend/src/routes/pedidos.js` · 188 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2 } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Pedidos';

// GET /api/pedidos?q=&estado=&clienteId=&desde=&hasta=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', clienteId = '', desde = '', hasta = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(p.numero_pedido ILIKE $${params.length} OR c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`p.estado = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`p.cliente_id = $${params.length}`); }
    if (desde) { params.push(desde); conds.push(`p.fecha >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`p.fecha <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT p.pedido_id, p.numero_pedido, p.fecha, p.subtotal::float8, p.impuestos::float8, p.total::float8,
              p.estado, p.observaciones, c.cliente_id, c.nombre_razon_social, c.numero_identificacion,
              (SELECT numero_factura FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS numero_factura
       FROM pedidos p JOIN clientes c ON c.cliente_id = p.cliente_id
       ${where} ORDER BY p.pedido_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/pedidos/:id  — detalle con líneas y factura
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ped = await pool.query(
      `SELECT p.*, p.subtotal::float8, p.impuestos::float8, p.total::float8,
              c.nombre_razon_social, c.numero_identificacion,
              (SELECT factura_id FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS factura_id,
              (SELECT numero_factura FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS numero_factura
       FROM pedidos p JOIN clientes c ON c.cliente_id = p.cliente_id WHERE p.pedido_id = $1`,
      [id]
    );
    if (!ped.rowCount) throw new HttpError(404, 'Pedido no encontrado');
    const lineas = await pool.query(
      `SELECT d.detalle_id, d.producto_id, d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8,
              pr.codigo, pr.nombre AS producto_nombre, pr.impuesto::float8
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [id]
    );
    res.json({ ...ped.rows[0], lineas: lineas.rows });
  } catch (e) { next(e); }
});

// POST /api/pedidos — los cálculos se hacen en el servidor
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { clienteId, observaciones = '', items = [] } = req.body || {};
    if (!clienteId) throw new HttpError(400, 'Debe indicar un cliente');
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Debe agregar al menos un producto');

    await client.query('BEGIN');

    const cli = await client.query('SELECT cliente_id FROM clientes WHERE cliente_id = $1 AND estado = $2', [clienteId, 'ACTIVO']);
    if (!cli.rowCount) throw new HttpError(400, 'El cliente no existe o está inactivo');

    const ins = await client.query('INSERT INTO pedidos (cliente_id, observaciones) VALUES ($1, $2) RETURNING pedido_id', [clienteId, observaciones || null]);
    const pedidoId = ins.rows[0].pedido_id;

    let subtotal = 0;
    let impuestos = 0;

    for (const item of items) {
      const cantidad = Number(item.cantidad);
      if (!item.productoId || !(cantidad > 0)) throw new HttpError(400, 'Cada línea requiere producto y cantidad mayor que cero');

      const prod = await client.query('SELECT * FROM productos WHERE producto_id = $1 AND estado = $2', [item.productoId, 'ACTIVO']);
      if (!prod.rowCount) throw new HttpError(400, `Producto ${item.productoId} no existe o está inactivo`);

      const precioUnitario = Number(prod.rows[0].precio);
      const lineaSubtotal = round2(precioUnitario * cantidad);
      const lineaImpuesto = round2(lineaSubtotal * (Number(prod.rows[0].impuesto) / 100));
      subtotal = round2(subtotal + lineaSubtotal);
      impuestos = round2(impuestos + lineaImpuesto);

      await client.query(
        `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)`,
        [pedidoId, item.productoId, cantidad, precioUnitario, lineaSubtotal]
      );
    }

    const total = round2(subtotal + impuestos);
    const numero = `PED-${String(pedidoId).padStart(6, '0')}`;
    await client.query(
      `UPDATE pedidos SET numero_pedido = $1, subtotal = $2, impuestos = $3, total = $4 WHERE pedido_id = $5`,
      [numero, subtotal, impuestos, total, pedidoId]
    );

    await client.query('COMMIT');
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: numero, descripcion: `Pedido ${numero} por $${total}` });
    res.status(201).json({ pedido_id: pedidoId, numero_pedido: numero, total });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// PUT /api/pedidos/:id  — solo en estado BORRADOR
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const { observaciones = '', items = [] } = req.body || {};

    await client.query('BEGIN');
    const ped = await client.query('SELECT estado, numero_pedido FROM pedidos WHERE pedido_id = $1', [id]);
    if (!ped.rowCount) throw new HttpError(404, 'Pedido no encontrado');
    if (ped.rows[0].estado !== 'BORRADOR') throw new HttpError(409, 'Solo se puede modificar un pedido en estado BORRADOR');
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Debe agregar al menos un producto');

    await client.query('DELETE FROM detalle_pedido WHERE pedido_id = $1', [id]);

    let subtotal = 0;
    let impuestos = 0;
    for (const item of items) {
      const cantidad = Number(item.cantidad);
      if (!item.productoId || !(cantidad > 0)) throw new HttpError(400, 'Cada línea requiere producto y cantidad mayor que cero');
      const prod = await client.query('SELECT * FROM productos WHERE producto_id = $1 AND estado = $2', [item.productoId, 'ACTIVO']);
      if (!prod.rowCount) throw new HttpError(400, `Producto ${item.productoId} no existe o está inactivo`);
      const precioUnitario = Number(prod.rows[0].precio);
      const lineaSubtotal = round2(precioUnitario * cantidad);
      const lineaImpuesto = round2(lineaSubtotal * (Number(prod.rows[0].impuesto) / 100));
      subtotal = round2(subtotal + lineaSubtotal);
      impuestos = round2(impuestos + lineaImpuesto);
      await client.query(
        `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)`,
        [id, item.productoId, cantidad, precioUnitario, lineaSubtotal]
      );
    }

    const total = round2(subtotal + impuestos);
    await client.query(
      `UPDATE pedidos SET observaciones = $1, subtotal = $2, impuestos = $3, total = $4 WHERE pedido_id = $5`,
      [observaciones || null, subtotal, impuestos, total, id]
    );
    await client.query('COMMIT');
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ACTUALIZAR', registro: ped.rows[0].numero_pedido, descripcion: `Modificación del pedido por $${total}` });
    res.json({ ok: true, total });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// PATCH /api/pedidos/:id/estado  — { estado: 'CONFIRMADO' | 'CANCELADO' }
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};
    const ped = await pool.query('SELECT estado, numero_pedido FROM pedidos WHERE pedido_id = $1', [id]);
    if (!ped.rowCount) throw new HttpError(404, 'Pedido no encontrado');
    const actual = ped.rows[0].estado;
    const permitido =
      (estado === 'CONFIRMADO' && actual === 'BORRADOR') ||
      (estado === 'CANCELADO' && ['BORRADOR', 'CONFIRMADO'].includes(actual));
    if (!permitido) throw new HttpError(409, `Transición ${actual} → ${estado} no permitida`);

    await pool.query('UPDATE pedidos SET estado = $1 WHERE pedido_id = $2', [estado, id]);
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ESTADO', registro: ped.rows[0].numero_pedido, descripcion: `Pedido → ${estado}` });
    res.json({ ok: true, estado });
  } catch (e) { next(e); }
});

export default router;
````

## 2.16 Ruta de facturas: `routes/facturas.js`

- `GET /` — consulta con filtros (texto, estado, estado de pago, cliente, fechas) usando la vista `factura_saldo`.
- `GET /:id` — detalle completo: factura + líneas del pedido + pagos + notas de crédito.
- `POST /` — **emitir factura desde un pedido**: valida que el pedido exista, esté `CONFIRMADO` y aún no tenga factura (regla 1 pedido = 1 factura); copia los totales, asigna `FAC-000001` y audita.
- `POST /:id/anular` — **anulación lógica**: exige motivo, marca `ANULADA` guardando quién y cuándo (la vista `factura_saldo` la muestra como `ANULADA` en estado de pago).

### Archivo `backend/src/routes/facturas.js`

**Archivo:** `backend/src/routes/facturas.js` · 183 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Facturas';

// GET /api/facturas?q=&estado=&estadoPago=&clienteId=&desde=&hasta=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', estadoPago = '', clienteId = '', desde = '', hasta = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(f.numero_factura ILIKE $${params.length} OR c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`f.estado = $${params.length}`); }
    if (estadoPago) { params.push(estadoPago); conds.push(`v.estado_pago = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`f.cliente_id = $${params.length}`); }
    if (desde) { params.push(desde); conds.push(`f.fecha_emision >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`f.fecha_emision <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT f.factura_id, f.numero_factura, f.pedido_id, f.fecha_emision, f.fecha_vencimiento,
              f.subtotal::float8, f.impuestos::float8, f.total::float8, f.estado,
              v.saldo::float8, v.valor_pagado::float8, v.notas_credito::float8, v.estado_pago,
              c.cliente_id, c.nombre_razon_social, c.numero_identificacion
       FROM facturas f
       JOIN clientes c ON c.cliente_id = f.cliente_id
       JOIN factura_saldo v ON v.factura_id = f.factura_id
       ${where} ORDER BY f.factura_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/facturas  — { pedidoId }: genera factura desde un pedido confirmado
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { pedidoId } = req.body || {};
    if (!pedidoId) throw new HttpError(400, 'Debe indicar el pedidoId');

    await client.query('BEGIN');

    const ped = await client.query(
      `SELECT p.pedido_id, p.cliente_id, p.subtotal, p.impuestos, p.total, p.estado, p.numero_pedido
       FROM pedidos p WHERE p.pedido_id = $1`,
      [pedidoId]
    );
    if (!ped.rowCount) throw new HttpError(404, 'El pedido no existe');
    const p = ped.rows[0];
    if (p.estado === 'CANCELADO') throw new HttpError(409, 'No se puede facturar un pedido cancelado');
    if (p.estado !== 'CONFIRMADO') throw new HttpError(409, 'El pedido debe estar CONFIRMADO antes de facturarse');

    const yaFacturado = await client.query('SELECT 1 FROM facturas WHERE pedido_id = $1', [pedidoId]);
    if (yaFacturado.rowCount) throw new HttpError(409, 'El pedido ya tiene una factura asociada');

    const cli = await client.query('SELECT nombre_razon_social FROM clientes WHERE cliente_id = $1', [p.cliente_id]);
    if (!cli.rowCount) throw new HttpError(400, 'El cliente del pedido no existe');

    const ins = await client.query(
      `INSERT INTO facturas (pedido_id, cliente_id, subtotal, impuestos, total, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5, NOW() + interval '30 days') RETURNING factura_id`,
      [pedidoId, p.cliente_id, p.subtotal, p.impuestos, p.total]
    );
    const facturaId = ins.rows[0].factura_id;
    const numero = `FAC-${String(facturaId).padStart(6, '0')}`;
    await client.query('UPDATE facturas SET numero_factura = $1 WHERE factura_id = $2', [numero, facturaId]);
    await client.query(`UPDATE pedidos SET estado = 'FACTURADO' WHERE pedido_id = $1`, [pedidoId]);

    await client.query('COMMIT');
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'GENERAR', registro: numero, descripcion: `Factura ${numero} generada del pedido ${p.numero_pedido} para ${cli.rows[0].nombre_razon_social}` });
    res.status(201).json({ factura_id: facturaId, numero_factura: numero });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// GET /api/facturas/:id — detalle con líneas del pedido y pagos
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const f = await pool.query(
      `SELECT f.*, f.subtotal::float8, f.impuestos::float8, f.total::float8,
              v.saldo::float8, v.valor_pagado::float8, v.estado_pago,
              p.numero_pedido, c.nombre_razon_social, c.numero_identificacion, c.direccion, c.ciudad,
              c.correo, c.telefono
       FROM facturas f
       JOIN factura_saldo v ON v.factura_id = f.factura_id
       JOIN pedidos p ON p.pedido_id = f.pedido_id
       JOIN clientes c ON c.cliente_id = f.cliente_id
       WHERE f.factura_id = $1`,
      [id]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');

    const lineas = await pool.query(
      `SELECT d.producto_id, d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8,
              pr.codigo, pr.nombre AS producto_nombre, pr.impuesto::float8
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [f.rows[0].pedido_id]
    );
    const pagos = await pool.query(
      `SELECT p.pago_id, p.numero_pago, p.fecha, p.valor::float8, p.metodo_pago, p.referencia, p.observaciones
       FROM pagos p WHERE p.factura_id = $1 ORDER BY p.fecha`,
      [id]
    );
    const notas = await pool.query(
      `SELECT nc.nota_credito_id, nc.numero_nota, nc.fecha, nc.valor::float8, nc.motivo, nc.estado, nc.motivo_anulacion
       FROM notas_credito nc WHERE nc.factura_id = $1 ORDER BY nc.fecha`,
      [id]
    );
    res.json({ ...f.rows[0], lineas: lineas.rows, pagos: pagos.rows, notas_credito: notas.rows });
  } catch (e) { next(e); }
});

// GET /api/facturas/:id/pagos
router.get('/:id/pagos', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT pago_id, numero_pago, fecha, valor::float8, metodo_pago, referencia, observaciones
       FROM pagos WHERE factura_id = $1 ORDER BY fecha DESC`,
      [Number(req.params.id)]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/facturas/:id/saldo
router.get('/:id/saldo', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT v.numero_factura, v.total::float8, v.valor_pagado::float8, v.saldo::float8, v.estado_pago, v.estado
       FROM factura_saldo v WHERE v.factura_id = $1`,
      [Number(req.params.id)]
    );
    if (!rows.rowCount) throw new HttpError(404, 'Factura no encontrada');
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/facturas/:id/anular  — { motivo } · anulación lógica, solo sin pagos
router.post('/:id/anular', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { motivo } = req.body || {};
    if (!motivo || !motivo.trim()) throw new HttpError(400, 'Debe indicar el motivo de anulación');

    const f = await pool.query(
      `SELECT f.estado, f.numero_factura, f.total,
              (SELECT COUNT(*) FROM pagos WHERE factura_id = f.factura_id)::int AS pagos
       FROM facturas f WHERE f.factura_id = $1`,
      [id]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'La factura no está activa');
    if (f.rows[0].pagos > 0) throw new HttpError(409, 'No se puede anular una factura con pagos registrados (regla de negocio)');

    await pool.query(
      `UPDATE facturas SET estado = 'ANULADA', motivo_anulacion = $1, fecha_anulacion = NOW(), usuario_anulacion = $2
       WHERE factura_id = $3`,
      [motivo, req.user.usuarioId, id]
    );
    await audit({ usuario: req.user.correo, modulo: MODULO, operacion: 'ANULAR', registro: f.rows[0].numero_factura, descripcion: `Anulación de ${f.rows[0].numero_factura}: ${motivo}` });
    // El pedido vuelve a quedar disponible para refacturación
    await pool.query(`UPDATE pedidos SET estado = 'CONFIRMADO' WHERE pedido_id = (SELECT pedido_id FROM facturas WHERE factura_id = $1)`, [id]);
    res.json({ ok: true, estado: 'ANULADA' });
  } catch (e) { next(e); }
});

export default router;
````

## 2.17 Ruta de pagos (caja interna): `routes/pagos.js`

Es la que usa el **cajero**. `POST /api/pagos` recibe `{facturaId, valor, metodoPago, ...}`:
1. Bloquea si la factura no existe o no está `ACTIVA`.
2. Calcula el saldo y **rechaza valores que superen el saldo** (400).
3. Valida/limpia los datos del método con `validarDatosPago`.
4. Inserta el pago en transacción, asigna `PAG-000001`, recalcula saldo y `estado_pago`.
5. Audita.

> 🔑 **Atención a una diferencia clave:** aquí en caja el efectivo **sí** se registra normalmente (`metodoPago='EFECTIVO'`). Es en el **portal del cliente** donde el efectivo no se registra directo, sino mediante el **código de pago Efecty** (ver `routes/mis.js` y `PagarModal.jsx`).

### Archivo `backend/src/routes/pagos.js`

**Archivo:** `backend/src/routes/pagos.js` · 99 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2, validarDatosPago } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'Pagos';

// GET /api/pagos?q=&facturaId=&clienteId=&desde=&hasta=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', facturaId = '', clienteId = '', desde = '', hasta = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(pg.numero_pago ILIKE $${params.length} OR f.numero_factura ILIKE $${params.length} OR pg.referencia ILIKE $${params.length})`);
    }
    if (facturaId) { params.push(facturaId); conds.push(`pg.factura_id = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`f.cliente_id = $${params.length}`); }
    if (desde) { params.push(desde); conds.push(`pg.fecha >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`pg.fecha <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT pg.pago_id, pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.referencia, pg.observaciones,
              pg.banco, pg.titular, pg.tipo_tarjeta, pg.ultimos_digitos_tarjeta, pg.vencimiento_tarjeta, pg.numero_cuenta,
              f.factura_id, f.numero_factura, c.cliente_id, c.nombre_razon_social
       FROM pagos pg
       JOIN facturas f ON f.factura_id = pg.factura_id
       JOIN clientes c ON c.cliente_id = f.cliente_id
       ${where} ORDER BY pg.pago_id DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// POST /api/pagos — { facturaId, valor, metodoPago, referencia, observaciones }
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { facturaId, valor, metodoPago = 'EFECTIVO', referencia = '', observaciones = '' } = req.body || {};

    await client.query('BEGIN');

    if (!facturaId || !(Number(valor) > 0)) throw new HttpError(400, 'Factura y valor (mayor que cero) son obligatorios');

    const f = await client.query(
      `SELECT f.factura_id, f.numero_factura, f.total, f.estado,
              COALESCE(SUM(p.valor), 0)::float8 AS pagado
       FROM facturas f LEFT JOIN pagos p ON p.factura_id = f.factura_id
       WHERE f.factura_id = $1 GROUP BY f.factura_id`,
      [facturaId]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se pueden registrar pagos en facturas activas');

    const saldo = round2(Number(f.rows[0].total) - Number(f.rows[0].pagado));
    const valorNum = round2(Number(valor));
    if (valorNum > saldo) throw new HttpError(400, `El valor supera el saldo pendiente ($ ${saldo.toLocaleString('en-US')})`);

    // Datos requeridos según el método de pago (tarjeta/transferencia/cheque); nunca se guardan CVV ni número completo
    const datosPago = validarDatosPago(metodoPago, req.body);

    const ins = await client.query(
      `INSERT INTO pagos (factura_id, valor, metodo_pago, referencia, observaciones, usuario_id,
                          banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta, numero_cuenta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING pago_id`,
      [facturaId, valorNum, metodoPago, referencia || null, observaciones || null, req.user.usuarioId ?? null,
        datosPago.banco || null, datosPago.titular || null, datosPago.tipo_tarjeta || null,
        datosPago.ultimos_digitos_tarjeta || null, datosPago.vencimiento_tarjeta || null, datosPago.numero_cuenta || null]
    );
    const pagoId = ins.rows[0].pago_id;
    const numero = `PAG-${String(pagoId).padStart(6, '0')}`;
    await client.query('UPDATE pagos SET numero_pago = $1 WHERE pago_id = $2', [numero, pagoId]);

    const nuevoPagado = round2(Number(f.rows[0].pagado) + valorNum);
    const nuevoSaldo = round2(Number(f.rows[0].total) - nuevoPagado);
    const estadoPago = nuevoSaldo <= 0 ? 'PAGADA' : 'PAGO_PARCIAL';

    await client.query('COMMIT');
    await audit({
      usuario: req.user.correo, modulo: MODULO, operacion: 'REGISTRAR', registro: numero,
      descripcion: `Pago de $${valorNum} en ${f.rows[0].numero_factura} (${metodoPago}) · saldo $${nuevoSaldo}`,
    });
    res.status(201).json({ pago_id: pagoId, numero_pago: numero, valor: valorNum, saldo: nuevoSaldo, estado_pago: estadoPago });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

export default router;
````

## 2.18 Ruta de notas de crédito: `routes/notas-credito.js`

Las devoluciones, con sus reglas de negocio:
- Solo sobre facturas **activas**.
- Solo por el monto "disponible": `pagado - notas_credito_activas_previas` (no se puede devolver más de lo pagado; las notas previas activas reducen lo disponible).
- El **motivo es obligatorio**, y la anulación también exige motivo (y conserva el registro para auditoría).

### Archivo `backend/src/routes/notas-credito.js`

**Archivo:** `backend/src/routes/notas-credito.js` · 146 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2 } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));

const MODULO = 'NotasCrédito';

// GET /api/notas-credito?q=&estado=&clienteId=&facturaId=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', estado = '', clienteId = '', facturaId = '' } = req.query;
    const conds = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(nc.numero_nota ILIKE $${params.length} OR f.numero_factura ILIKE $${params.length} OR c.nombre_razon_social ILIKE $${params.length} OR c.numero_identificacion ILIKE $${params.length})`);
    }
    if (estado) { params.push(estado); conds.push(`nc.estado = $${params.length}`); }
    if (clienteId) { params.push(clienteId); conds.push(`nc.cliente_id = $${params.length}`); }
    if (facturaId) { params.push(facturaId); conds.push(`nc.factura_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await pool.query(
      `SELECT nc.nota_credito_id, nc.numero_nota, nc.factura_id, nc.cliente_id, nc.fecha, nc.valor::float8,
              nc.motivo, nc.estado, nc.fecha_anulacion, nc.motivo_anulacion,
              f.numero_factura, c.nombre_razon_social, c.numero_identificacion
       FROM notas_credito nc
       JOIN facturas f ON f.factura_id = nc.factura_id
       JOIN clientes c ON c.cliente_id = nc.cliente_id
       ${where} ORDER BY nc.fecha DESC LIMIT 300`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/notas-credito/:id
router.get('/:id', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT nc.*, nc.valor::float8, f.numero_factura, c.nombre_razon_social, c.numero_identificacion
       FROM notas_credito nc
       JOIN facturas f ON f.factura_id = nc.factura_id
       JOIN clientes c ON c.cliente_id = nc.cliente_id
       WHERE nc.nota_credito_id = $1`,
      [Number(req.params.id)]
    );
    if (!rows.rowCount) throw new HttpError(404, 'Nota de crédito no encontrada');
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// POST /api/notas-credito — { facturaId, valor, motivo }
// Reglas: factura ACTIVA · motivo obligatorio · el devuelto no supera lo pagado
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { facturaId, valor, motivo } = req.body || {};

    await client.query('BEGIN');
    if (!facturaId) throw new HttpError(400, 'Debe indicar la factura');
    if (!(Number(valor) > 0)) throw new HttpError(400, 'El valor de la nota crédito debe ser mayor que cero');
    if (!motivo || !String(motivo).trim()) throw new HttpError(400, 'Debe indicar el motivo de la devolución');

    const f = await client.query(
      `SELECT f.factura_id, f.numero_factura, f.cliente_id, f.estado,
              COALESCE(SUM(p.valor), 0)::float8 AS pagado,
              COALESCE(SUM(CASE WHEN nc.estado = 'ACTIVA' THEN nc.valor END), 0)::float8 AS notas_previas
       FROM facturas f
       LEFT JOIN pagos p ON p.factura_id = f.factura_id
       LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id
       WHERE f.factura_id = $1
       GROUP BY f.factura_id`,
      [facturaId]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se pueden crear notas crédito sobre facturas activas');

    const pagado = Number(f.rows[0].pagado);
    const notasPrevias = Number(f.rows[0].notas_previas);
    const disponible = round2(pagado - notasPrevias);
    const valorNum = round2(Number(valor));
    if (disponible <= 0) throw new HttpError(409, 'No hay pagos disponibles para devolver en esta factura');
    if (valorNum > disponible) throw new HttpError(400, `El valor supera lo pagado disponible ($ ${disponible.toLocaleString('en-US')})`);

    const ins = await client.query(
      `INSERT INTO notas_credito (factura_id, cliente_id, valor, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING nota_credito_id`,
      [facturaId, f.rows[0].cliente_id, valorNum, String(motivo).trim(), req.user.usuarioId ?? null]
    );
    const notaId = ins.rows[0].nota_credito_id;
    const numero = `NC-${String(notaId).padStart(6, '0')}`;
    await client.query('UPDATE notas_credito SET numero_nota = $1 WHERE nota_credito_id = $2', [numero, notaId]);

    const nuevoSaldo = round2(pagado - notasPrevias - valorNum);
    await client.query('COMMIT');

    await audit({
      usuario: req.user.correo, modulo: MODULO, operacion: 'CREAR', registro: numero,
      descripcion: `Nota crédito ${numero} de $${valorNum} sobre ${f.rows[0].numero_factura}: ${motivo}`,
    });
    res.status(201).json({ nota_credito_id: notaId, numero_nota: numero, valor: valorNum, saldo_restante_devolver: nuevoSaldo });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// POST /api/notas-credito/:id/anular — { motivo } · anulación lógica
router.post('/:id/anular', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { motivo } = req.body || {};
    if (!motivo || !String(motivo).trim()) throw new HttpError(400, 'Debe indicar el motivo de anulación');

    const n = await pool.query(
      `SELECT nc.numero_nota, nc.estado, f.numero_factura, c.nombre_razon_social
       FROM notas_credito nc
       JOIN facturas f ON f.factura_id = nc.factura_id
       JOIN clientes c ON c.cliente_id = nc.cliente_id
       WHERE nc.nota_credito_id = $1`,
      [id]
    );
    if (!n.rowCount) throw new HttpError(404, 'Nota de crédito no encontrada');
    if (n.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'La nota de crédito ya no está activa');

    await pool.query(
      `UPDATE notas_credito SET estado = 'ANULADA', fecha_anulacion = NOW(), usuario_anulacion = $1, motivo_anulacion = $2
       WHERE nota_credito_id = $3`,
      [req.user.usuarioId ?? null, String(motivo).trim(), id]
    );
    await audit({
      usuario: req.user.correo, modulo: MODULO, operacion: 'ANULAR', registro: n.rows[0].numero_nota,
      descripcion: `Anulación de ${n.rows[0].numero_nota} (${n.rows[0].numero_factura}): ${motivo}`,
    });
    res.json({ ok: true, estado: 'ANULADA' });
  } catch (e) { next(e); }
});

export default router;
````

## 2.19 Ruta de reportes: `routes/reportes.js`

Endpoints de consulta para el panel gerencial:
- `GET /resumen` → tarjetas del Dashboard (clientes activos, facturas, pagos recibidos, cuentas por cobrar…).
- `GET /facturacion?desde=&hasta=` → facturación de un rango + desglose de pagos por método.
- `GET /balance-clientes` → resumen global + tabla de saldos por cliente (el "dashboard de cuentas por cobrar").
- `GET /historial/:clienteId` → historial financiero de un cliente (facturas + pagos).

Todos usan la vista `factura_saldo` o subconsultas equivalentes, así los números coinciden siempre con el portal.

### Archivo `backend/src/routes/reportes.js`

**Archivo:** `backend/src/routes/reportes.js` · 122 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'SUPERVISOR', 'FACTURADOR'));

// GET /api/reportes/resumen  — estadísticas del dashboard
router.get('/resumen', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM clientes WHERE estado = 'ACTIVO')::int  AS clientes_activos,
        (SELECT COUNT(*) FROM productos WHERE estado = 'ACTIVO')::int AS productos_activos,
        (SELECT COUNT(*) FROM pedidos)::int                          AS total_pedidos,
        (SELECT COUNT(*)::int FROM pedidos WHERE estado = 'CONFIRMADO')::int AS pedidos_por_facturar,
        (SELECT COUNT(*)::int FROM facturas WHERE estado = 'ACTIVA')::int AS facturas_activas,
        (SELECT COUNT(*)::int FROM facturas WHERE estado = 'ANULADA')::int AS facturas_anuladas,
        (SELECT COALESCE(SUM(valor),0)::float8 FROM pagos)            AS pagos_recibidos,
        (SELECT COALESCE(SUM(f.total - COALESCE((SELECT SUM(p.valor) FROM pagos p WHERE p.factura_id = f.factura_id), 0)), 0)::float8
         FROM facturas f WHERE f.estado = 'ACTIVA')                   AS saldo_pendiente_total`
    );
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/reportes/facturacion?desde=&hasta=
router.get('/facturacion', async (req, res, next) => {
  try {
    const { desde = '', hasta = '' } = req.query;
    const params = [];
    const conds = [];
    if (desde) { params.push(desde); conds.push(`f.fecha_emision >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); conds.push(`f.fecha_emision <= ($${params.length}::date + interval '1 day')`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const facturas = await pool.query(
      `SELECT
        COUNT(*)::int AS total_facturas,
        COUNT(*) FILTER (WHERE f.estado = 'ACTIVA')::int AS activas,
        COUNT(*) FILTER (WHERE f.estado = 'ANULADA')::int AS anuladas,
        COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'ACTIVA'), 0)::float8 AS total_facturado,
        COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'ANULADA'), 0)::float8 AS total_anulado,
        COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'ACTIVA') -
          COALESCE((SELECT SUM(p.valor) FROM pagos p JOIN facturas f2 ON f2.factura_id = p.factura_id WHERE f2.estado = 'ACTIVA'), 0), 0)::float8 AS saldo_pendiente
       FROM facturas f ${where}`,
      params
    );
    const pagos = await pool.query(
      `SELECT COALESCE(SUM(valor), 0)::float8 AS total_pagado, COUNT(*)::int AS total_pagos,
              COUNT(*) FILTER (WHERE metodo_pago = 'EFECTIVO')::int AS efectivo,
              COUNT(*) FILTER (WHERE metodo_pago = 'TRANSFERENCIA')::int AS transferencia,
              COUNT(*) FILTER (WHERE metodo_pago = 'TARJETA')::int AS tarjeta,
              COUNT(*) FILTER (WHERE metodo_pago = 'CHEQUE')::int AS cheque
       FROM pagos p JOIN facturas f ON f.factura_id = p.factura_id ${where}`,
      params
    );
    res.json({ ...facturas.rows[0], ...pagos.rows[0] });
  } catch (e) { next(e); }
});

// GET /api/reportes/balance-clientes — dashboard de saldos por cliente
router.get('/balance-clientes', async (req, res, next) => {
  try {
    const ranges = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE saldo_pendiente > 0)::int AS clientes_con_saldo,
        SUM(saldo_pendiente)::float8 AS saldo_total,
        SUM(total_facturado)::float8 AS facturado_total,
        SUM(total_pagado)::float8 AS pagado_total
       FROM (
         SELECT c.cliente_id,
           COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_facturado,
           COALESCE(SUM(v.valor_pagado - v.notas_credito) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_pagado,
           COALESCE(SUM(v.saldo) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS saldo_pendiente
         FROM clientes c LEFT JOIN factura_saldo v ON v.cliente_id = c.cliente_id
         GROUP BY c.cliente_id
       ) t`
    );
    const rows = await pool.query(
      `SELECT c.cliente_id, c.tipo_identificacion, c.numero_identificacion, c.nombre_razon_social,
              c.correo, c.telefono, c.ciudad, c.estado,
              COUNT(v.factura_id) FILTER (WHERE v.estado = 'ACTIVA')::int AS facturas_activas,
              COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_facturado,
              COALESCE(SUM(v.valor_pagado - v.notas_credito) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS total_pagado,
              COALESCE(SUM(v.saldo) FILTER (WHERE v.estado = 'ACTIVA'), 0)::float8 AS saldo_pendiente,
              (SELECT COUNT(*) FROM pedidos p2 WHERE p2.cliente_id = c.cliente_id)::int AS total_pedidos
       FROM clientes c LEFT JOIN factura_saldo v ON v.cliente_id = c.cliente_id
       GROUP BY c.cliente_id
       ORDER BY saldo_pendiente DESC, c.nombre_razon_social`
    );
    res.json({ resumen: ranges.rows[0], clientes: rows.rows });
  } catch (e) { next(e); }
});

// GET /api/reportes/historial/:clienteId  — historial financiero de un cliente
router.get('/historial/:clienteId', async (req, res, next) => {
  try {
    const clienteId = Number(req.params.clienteId);
    const cli = await pool.query(
      `SELECT cliente_id, nombre_razon_social, numero_identificacion, ciudad, estado FROM clientes WHERE cliente_id = $1`,
      [clienteId]
    );
    if (!cli.rowCount) throw new HttpError(404, 'Cliente no encontrado');

    const facturas = await pool.query(
      `SELECT v.factura_id, v.numero_factura, v.fecha_emision, v.total::float8, v.valor_pagado::float8, v.saldo::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 ORDER BY v.fecha_emision DESC`,
      [clienteId]
    );
    const pagos = await pool.query(
      `SELECT pg.pago_id, pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.referencia, f.numero_factura
       FROM pagos pg JOIN facturas f ON f.factura_id = pg.factura_id
       WHERE f.cliente_id = $1 ORDER BY pg.fecha DESC`,
      [clienteId]
    );
    res.json({ cliente: cli.rows[0], facturas: facturas.rows, pagos: pagos.rows });
  } catch (e) { next(e); }
});

export default router;
````

## 2.20 Ruta de auditoría: `routes/auditoria.js`

Consulta (con filtros) de la bitácora. Solo `ADMIN` y `SUPERVISOR`.

### Archivo `backend/src/routes/auditoria.js`

**Archivo:** `backend/src/routes/auditoria.js` · 27 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'SUPERVISOR'));

// GET /api/auditoria?modulo=&usuario=&operacion=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { modulo = '', usuario = '', operacion = '', limit = 200 } = req.query;
    const conds = [];
    const params = [];
    if (modulo) { params.push(modulo); conds.push(`a.modulo ILIKE $${params.length}`); }
    if (usuario) { params.push(`%${usuario}%`); conds.push(`a.usuario ILIKE $${params.length}`); }
    if (operacion) { params.push(operacion); conds.push(`a.operacion = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await pool.query(
      `SELECT a.auditoria_id, a.usuario, a.usuario_tipo, a.fecha_hora, a.modulo, a.operacion, a.registro_afectado, a.descripcion
       FROM auditoria a ${where} ORDER BY a.auditoria_id DESC LIMIT ${Math.min(Number(limit) || 200, 500)}`,
      params
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

export default router;
````

## 2.21 ⭐ El portal del cliente: `routes/mis.js`

Este archivo es **el más importante para entender el portal**. Sus claves:

- `router.use(requireAuth, requireCliente)` — **todas** las rutas exigen sesión de cliente, y el `clienteId` **siempre sale del token** (no de la URL). Así un cliente jamás puede ver o pagar facturas de otro (aislamiento).
- Endpoints de consulta: `mis-datos`, `mis-pedidos` (+ detalle), `mis-facturas` (+ detalle con líneas y pagos), `mis-pagos`, `mi-saldo` (resumen con chips + facturas pendientes), `mis-notas-credito`, `mi-historial`.
- **`GET /mis-pagos/efecty-codigo?facturaId=&valor=`** — ⭐ el **código de pago Efecty** (el flujo que implementamos). Es **determinístico** (misma factura + mismo valor = mismo código) y está compuesto por 14 dígitos (4 del id de factura + 10 del valor en centavos) + 2 dígitos de verificación (algoritmo ISO 7064 mod 97-10). Validaciones: factura debe existir **y ser de este cliente** (404 si no), estar `ACTIVA` (409), con saldo pendiente (409), y el valor entre $0.01 y el saldo (400). No registra ningún pago: solo **genera el código y lo audita** (`CODIGO_EFECTY`), con vigencia de 24 horas en el mensaje.
- **`POST /mis-pagos`** — pago/abono desde el portal (tarjeta/transferencia/cheque). Es como el de caja pero con aislamiento por cliente **y una regla extra**: si `metodoPago === 'EFECTIVO'` responde **400** con el mensaje de que el efectivo se paga con el código Efecty, para que el "botón de registrar pago" nunca pueda usarse con efectivo en el portal.

### Archivo `backend/src/routes/mis.js`

**Archivo:** `backend/src/routes/mis.js` · 293 líneas

````js
import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireCliente } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { HttpError, round2, validarDatosPago } from '../utils.js';

const router = Router();

// Todas las rutas del portal requieren sesión de cliente.
// El clienteId SIEMPRE se toma del token autenticado (aislamiento por cliente).
router.use(requireAuth, requireCliente);

// GET /api/mis-datos
router.get('/mis-datos', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT cliente_id, tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social,
              telefono, correo, direccion, ciudad, estado
       FROM clientes WHERE cliente_id = $1`,
      [req.user.clienteId]
    );
    if (!rows.rowCount) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows.rows[0]);
  } catch (e) { next(e); }
});

// GET /api/mis-pedidos
router.get('/mis-pedidos', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT p.pedido_id, p.numero_pedido, p.fecha, p.subtotal::float8, p.impuestos::float8, p.total::float8, p.estado,
              (SELECT numero_factura FROM facturas WHERE pedido_id = p.pedido_id LIMIT 1) AS numero_factura
       FROM pedidos p WHERE p.cliente_id = $1 ORDER BY p.pedido_id DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/mis-pedidos/:id — detalle (verifica pertenencia)
router.get('/mis-pedidos/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ped = await pool.query(
      `SELECT p.pedido_id, p.numero_pedido, p.fecha, p.subtotal::float8, p.impuestos::float8, p.total::float8, p.estado, p.observaciones
       FROM pedidos p WHERE p.pedido_id = $1 AND p.cliente_id = $2`,
      [id, req.user.clienteId]
    );
    if (!ped.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const lineas = await pool.query(
      `SELECT d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8, pr.nombre AS producto_nombre, pr.codigo
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [id]
    );
    res.json({ ...ped.rows[0], lineas: lineas.rows });
  } catch (e) { next(e); }
});

// GET /api/mis-facturas
router.get('/mis-facturas', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT v.factura_id, v.cliente_id, v.numero_factura, v.pedido_id, v.fecha_emision, v.fecha_vencimiento,
              v.total::float8, v.valor_pagado::float8, v.saldo::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 ORDER BY v.fecha_emision DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/mis-facturas/:id
router.get('/mis-facturas/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const f = await pool.query(
      `SELECT v.*, v.total::float8, v.valor_pagado::float8, v.saldo::float8, p.numero_pedido
       FROM factura_saldo v JOIN pedidos p ON p.pedido_id = v.pedido_id
       WHERE v.factura_id = $1 AND v.cliente_id = $2`,
      [id, req.user.clienteId]
    );
    if (!f.rowCount) return res.status(404).json({ error: 'Factura no encontrada' });
    const lineas = await pool.query(
      `SELECT d.cantidad::float8, d.precio_unitario::float8, d.subtotal::float8, pr.nombre AS producto_nombre, pr.codigo
       FROM detalle_pedido d JOIN productos pr ON pr.producto_id = d.producto_id
       WHERE d.pedido_id = $1 ORDER BY d.detalle_id`,
      [f.rows[0].pedido_id]
    );
    const pagos = await pool.query(
      `SELECT numero_pago, fecha, valor::float8, metodo_pago, referencia
       FROM pagos WHERE factura_id = $1 ORDER BY fecha`,
      [id]
    );
    res.json({ ...f.rows[0], lineas: lineas.rows, pagos: pagos.rows });
  } catch (e) { next(e); }
});

// GET /api/mis-pagos
router.get('/mis-pagos', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT pg.pago_id, pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.referencia, pg.observaciones,
              pg.banco, pg.titular, pg.tipo_tarjeta, pg.ultimos_digitos_tarjeta, pg.vencimiento_tarjeta, pg.numero_cuenta,
              f.numero_factura, f.estado
       FROM pagos pg JOIN facturas f ON f.factura_id = pg.factura_id
       WHERE f.cliente_id = $1 ORDER BY pg.fecha DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// Código de pago Efecty: determinístico por factura + valor.
// 14 dígitos (factura 4 + valor en centavos 10) + 2 dígitos de verificación (ISO 7064 mod 97-10).
function codigoEfecty(facturaId, valor) {
  const cents = Math.max(1, Math.round(Number(valor) * 100));
  const base = `${String(facturaId).padStart(4, '0')}${String(cents).padStart(10, '0').slice(-10)}`;
  const c = 98n - ((BigInt(base) * 100n) % 97n); // 1..97
  return `EFY-${base}${c < 10n ? `0${c}` : String(c)}`;
}

// GET /api/mis-pagos/efecty-codigo?facturaId=&valor=
// Genera el código para pagar en efectivo en un punto Efecty. El efectivo NO se
// registra en el portal: el cliente paga físicamente con este código (vigencia 24 h).
router.get('/mis-pagos/efecty-codigo', async (req, res, next) => {
  try {
    const facturaId = Number(req.query.facturaId);
    if (!facturaId) throw new HttpError(400, 'Indique el número de factura (facturaId)');

    const f = await pool.query(
      `SELECT f.factura_id, f.numero_factura, f.total, f.estado,
              COALESCE(SUM(p.valor), 0)::float8 AS pagado
       FROM facturas f LEFT JOIN pagos p ON p.factura_id = f.factura_id
       WHERE f.factura_id = $1 AND f.cliente_id = $2
       GROUP BY f.factura_id`,
      [facturaId, req.user.clienteId]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se generan códigos para facturas activas');

    const saldo = round2(Number(f.rows[0].total) - Number(f.rows[0].pagado));
    if (saldo <= 0) throw new HttpError(409, 'La factura ya está pagada');
    const valor = round2(req.query.valor ? Number(req.query.valor) : saldo);
    if (!(valor > 0) || valor > saldo) {
      throw new HttpError(400, `El valor debe estar entre $0.01 y el saldo pendiente ($ ${saldo.toLocaleString('en-US')})`);
    }

    const codigo = codigoEfecty(facturaId, valor);
    await audit({
      usuario: req.user.username, usuarioTipo: 'CLIENTE', modulo: 'Pagos', operacion: 'CODIGO_EFECTY',
      registro: f.rows[0].numero_factura,
      descripcion: `Código Efecty ${codigo} generado por $${valor} (saldo $${saldo})`,
    });

    res.json({
      codigo,
      factura_id: facturaId,
      numero_factura: f.rows[0].numero_factura,
      valor,
      saldo,
      vigencia_horas: 24,
      mensaje: 'Presenta este código en cualquier punto Efecty para pagar en efectivo. El sistema lo validará contra tu factura.',
    });
  } catch (e) { next(e); }
});

// GET /api/mi-saldo
router.get('/mi-saldo', async (req, res, next) => {
  try {
    const resumen = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN v.estado = 'ACTIVA' AND v.saldo > 0 THEN v.saldo ELSE 0 END), 0)::float8 AS saldo_pendiente,
        COALESCE(SUM(CASE WHEN v.estado = 'ACTIVA' THEN v.total ELSE 0 END), 0)::float8 AS total_activo,
        COALESCE(SUM(CASE WHEN v.estado = 'ACTIVA' THEN v.valor_pagado ELSE 0 END), 0)::float8 AS total_pagado,
        COUNT(*) FILTER (WHERE v.estado = 'ACTIVA' AND v.saldo > 0)::int AS facturas_pendientes,
        COUNT(*) FILTER (WHERE v.estado_pago = 'PAGADA')::int AS facturas_pagadas
       FROM factura_saldo v WHERE v.cliente_id = $1`,
      [req.user.clienteId]
    );
    const detalle = await pool.query(
      `SELECT v.factura_id, v.numero_factura, v.fecha_emision, v.total::float8, v.valor_pagado::float8, v.saldo::float8, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 AND v.estado = 'ACTIVA' AND v.saldo > 0
       ORDER BY v.fecha_emision DESC`,
      [req.user.clienteId]
    );
    res.json({ ...resumen.rows[0], facturas: detalle.rows });
  } catch (e) { next(e); }
});

// GET /api/mis-notas-credito — notas crédito del cliente autenticado
router.get('/mis-notas-credito', async (req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT nc.nota_credito_id, nc.numero_nota, nc.factura_id, nc.fecha, nc.valor::float8, nc.motivo,
              nc.estado, nc.fecha_anulacion, nc.motivo_anulacion, f.numero_factura
       FROM notas_credito nc JOIN facturas f ON f.factura_id = nc.factura_id
       WHERE nc.cliente_id = $1 ORDER BY nc.fecha DESC LIMIT 300`,
      [req.user.clienteId]
    );
    res.json(rows.rows);
  } catch (e) { next(e); }
});

// GET /api/mi-historial
router.get('/mi-historial', async (req, res, next) => {
  try {
    const facturas = await pool.query(
      `SELECT v.numero_factura, v.fecha_emision, v.total::float8, v.estado, v.estado_pago
       FROM factura_saldo v WHERE v.cliente_id = $1 ORDER BY v.fecha_emision DESC`,
      [req.user.clienteId]
    );
    const pagos = await pool.query(
      `SELECT pg.numero_pago, pg.fecha, pg.valor::float8, pg.metodo_pago, pg.banco, pg.tipo_tarjeta,
              pg.ultimos_digitos_tarjeta, pg.numero_cuenta, f.numero_factura
       FROM pagos pg JOIN facturas f ON f.factura_id = pg.factura_id
       WHERE f.cliente_id = $1 ORDER BY pg.fecha DESC`,
      [req.user.clienteId]
    );
    const notas = await pool.query(
      `SELECT nc.numero_nota, nc.fecha, nc.valor::float8, nc.motivo, nc.estado, f.numero_factura
       FROM notas_credito nc JOIN facturas f ON f.factura_id = nc.factura_id
       WHERE nc.cliente_id = $1 ORDER BY nc.fecha DESC`,
      [req.user.clienteId]
    );
    res.json({ facturas: facturas.rows, pagos: pagos.rows, notas: notas.rows });
  } catch (e) { next(e); }
});

// POST /api/mis-pagos — abono/pago de una factura propia desde el portal
// (aislamiento: la factura debe pertenecer al clienteId de la sesión)
router.post('/mis-pagos', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { facturaId, valor, metodoPago = 'EFECTIVO', referencia = '', observaciones = '' } = req.body || {};
    if (!facturaId || !(Number(valor) > 0)) throw new HttpError(400, 'Factura y valor (mayor que cero) son obligatorios');

    const f = await client.query(
      `SELECT f.factura_id, f.numero_factura, f.total, f.estado,
              COALESCE(SUM(p.valor), 0)::float8 AS pagado
       FROM facturas f LEFT JOIN pagos p ON p.factura_id = f.factura_id
       WHERE f.factura_id = $1 AND f.cliente_id = $2
       GROUP BY f.factura_id`,
      [facturaId, req.user.clienteId]
    );
    if (!f.rowCount) throw new HttpError(404, 'Factura no encontrada');
    if (f.rows[0].estado !== 'ACTIVA') throw new HttpError(409, 'Solo se pueden registrar pagos en facturas activas');

    const saldo = round2(Number(f.rows[0].total) - Number(f.rows[0].pagado));
    const valorNum = round2(Number(valor));
    if (valorNum > saldo) throw new HttpError(400, `El valor supera el saldo pendiente ($ ${saldo.toLocaleString('en-US')})`);

    // El efectivo no se registra desde el portal: se paga en un punto Efecty con un código generado.
    if (metodoPago === 'EFECTIVO') {
      throw new HttpError(400, 'El efectivo no se registra desde el portal: genera tu código de pago Efecty y paga en cualquier punto Efecty');
    }

    // Datos requeridos según el método (tarjeta/transferencia/cheque); nunca se guardan CVV ni número completo
    const datosPago = validarDatosPago(metodoPago, req.body);

    const ins = await client.query(
      `INSERT INTO pagos (factura_id, valor, metodo_pago, referencia, observaciones,
                          banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta, numero_cuenta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING pago_id`,
      [facturaId, valorNum, metodoPago, referencia || null, observaciones || null,
        datosPago.banco || null, datosPago.titular || null, datosPago.tipo_tarjeta || null,
        datosPago.ultimos_digitos_tarjeta || null, datosPago.vencimiento_tarjeta || null, datosPago.numero_cuenta || null]
    );
    const pagoId = ins.rows[0].pago_id;
    const numero = `PAG-${String(pagoId).padStart(6, '0')}`;
    await client.query('UPDATE pagos SET numero_pago = $1 WHERE pago_id = $2', [numero, pagoId]);

    const nuevoPagado = round2(Number(f.rows[0].pagado) + valorNum);
    const nuevoSaldo = round2(Number(f.rows[0].total) - nuevoPagado);
    const estadoPago = nuevoSaldo <= 0 ? 'PAGADA' : 'PAGO_PARCIAL';

    await client.query('COMMIT');
    await audit({
      usuario: req.user.username, usuarioTipo: 'CLIENTE', modulo: 'Pagos', operacion: 'PAGO_PORTAL',
      registro: numero, descripcion: `Pago desde el portal de $${valorNum} en ${f.rows[0].numero_factura} (${metodoPago}) · saldo $${nuevoSaldo}`,
    });
    res.status(201).json({ pago_id: pagoId, numero_pago: numero, valor: valorNum, saldo: nuevoSaldo, estado_pago: estadoPago });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

export default router;
````

## 2.22 Datos demo: `seed.js`

El "sembrador" idempotente que crea los datos con los que pruebas la app: 4 roles, 4 usuarios internos (`admin@finanx.test`…), 2 clientes demo, la cuenta del portal (`cliente@finanx.test/cliente123`) y 5 productos. **Idempotente** significa que puedes ejecutarlo muchas veces y no duplica nada (usa `ON CONFLICT DO NOTHING` y comprobaciones previas). Además espera pacientes a que la base de datos esté lista (hasta 30 intentos de 2s).

### Archivo `backend/src/seed.js`

**Archivo:** `backend/src/seed.js` · 127 líneas

````js
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from './db.js';

async function waitForDb() {
  for (let i = 0; i < 30; i += 1) {
    try {
      await pool.query('SELECT 1');
      console.log('✔ Conexión a PostgreSQL establecida');
      return;
    } catch (err) {
      console.log(`⏳ Esperando base de datos (${i + 1}/30)...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('No se pudo conectar a PostgreSQL. ¿Está corriendo `docker compose up -d db`?');
}

async function seed() {
  await waitForDb();

  const roles = [
    ['ADMIN', 'Administración del sistema y gestión de usuarios'],
    ['FACTURADOR', 'Gestión de clientes, pedidos y facturas'],
    ['CAJERO', 'Registro y consulta de pagos y saldos'],
    ['SUPERVISOR', 'Consulta de información financiera, historial y reportes'],
  ];
  for (const [nombre, descripcion] of roles) {
    await pool.query(
      `INSERT INTO roles (nombre, descripcion) VALUES ($1, $2)
       ON CONFLICT (nombre) DO NOTHING`,
      [nombre, descripcion]
    );
  }
  console.log('✔ Roles listos');

  const usuarios = [
    { nombre: 'Administrador', correo: 'admin@finanx.test', rol: 'ADMIN', password: 'admin123' },
    { nombre: 'Facturador', correo: 'facturador@finanx.test', rol: 'FACTURADOR', password: 'facturador123' },
    { nombre: 'Cajero', correo: 'cajero@finanx.test', rol: 'CAJERO', password: 'cajero123' },
    { nombre: 'Supervisor', correo: 'supervisor@finanx.test', rol: 'SUPERVISOR', password: 'supervisor123' },
  ];
  for (const u of usuarios) {
    const exists = await pool.query('SELECT 1 FROM usuarios WHERE correo = $1', [u.correo]);
    if (exists.rowCount) continue;
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol_id)
       SELECT $1, $2, $3, rol_id FROM roles WHERE nombre = $4`,
      [u.nombre, u.correo, hash, u.rol]
    );
  }
  console.log('✔ Usuarios internos listos');

  const clientes = [
    {
      tipoCliente: 'PERSONA', tipoIdentificacion: 'CC', numeroIdentificacion: '1002003001',
      nombreRazonSocial: 'María Fernanda López', telefono: '3115550101',
      correo: 'maria.lopez@example.com', direccion: 'Calle 10 # 5-20', ciudad: 'Bogotá',
    },
    {
      tipoCliente: 'EMPRESA', tipoIdentificacion: 'NIT', numeroIdentificacion: '901234567',
      nombreRazonSocial: 'TecnoAndina S.A.S.', telefono: '6015558899',
      correo: 'ventas@tecnoandina.co', direccion: 'Av. 68 # 80-10', ciudad: 'Medellín',
    },
  ];
  for (const c of clientes) {
    const exists = await pool.query(
      'SELECT 1 FROM clientes WHERE tipo_identificacion = $1 AND numero_identificacion = $2',
      [c.tipoIdentificacion, c.numeroIdentificacion]
    );
    if (exists.rowCount) continue;
    await pool.query(
      `INSERT INTO clientes (tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [c.tipoCliente, c.tipoIdentificacion, c.numeroIdentificacion, c.nombreRazonSocial, c.telefono, c.correo, c.direccion, c.ciudad]
    );
  }
  console.log('✔ Clientes listos');

  // Cuenta de acceso del cliente 1 (portal)
  const cli = await pool.query(
    `SELECT cliente_id FROM clientes WHERE numero_identificacion = '1002003001' ORDER BY cliente_id LIMIT 1`
  );
  if (cli.rowCount) {
    const cid = cli.rows[0].cliente_id;
    const exists = await pool.query('SELECT 1 FROM usuario_cliente WHERE cliente_id = $1', [cid]);
    if (!exists.rowCount) {
      const hash = await bcrypt.hash('cliente123', 10);
      await pool.query(
        `INSERT INTO usuario_cliente (cliente_id, username, password_hash) VALUES ($1, $2, $3)`,
        [cid, 'cliente@finanx.test', hash]
      );
      console.log('✔ Cuenta de cliente creada (cliente@finanx.test / cliente123)');
    }
  }

  const productos = [
    { codigo: 'PROD-001', nombre: 'Laptop 15" 16GB', descripcion: 'Portátil con SSD 512GB', categoria: 'Cómputo', precio: 4500000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-002', nombre: 'Mouse inalámbrico', descripcion: 'Mouse óptico 2.4GHz', categoria: 'Accesorios', precio: 120000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-003', nombre: 'Teclado mecánico', descripcion: 'Teclado RGB español', categoria: 'Accesorios', precio: 280000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-004', nombre: 'Monitor 27" 4K', descripcion: 'Monitor IPS 60Hz', categoria: 'Cómputo', precio: 2100000, impuesto: 19, unidadMedida: 'UND' },
    { codigo: 'PROD-005', nombre: 'Servicio de soporte', descripcion: 'Hora técnica especializada', categoria: 'Servicios', precio: 150000, impuesto: 0, unidadMedida: 'HORA' },
  ];
  for (const p of productos) {
    await pool.query(
      `INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, impuesto, unidad_medida)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (codigo) DO NOTHING`,
      [p.codigo, p.nombre, p.descripcion, p.categoria, p.precio, p.impuesto, p.unidadMedida]
    );
  }
  console.log('✔ Productos listos');

  await pool.end();
  console.log('\nSeed completado. Credenciales demo:');
  console.log('  admin@finanx.test / admin123        (Administrador)');
  console.log('  facturador@finanx.test / facturador123');
  console.log('  cajero@finanx.test / cajero123');
  console.log('  supervisor@finanx.test / supervisor123');
  console.log('  cliente@finanx.test / cliente123    (Portal del cliente)');
}

seed().catch((err) => {
  console.error('Error en el seed:', err.message);
  process.exit(1);
});
````

---

# PARTE 3 · El frontend (React)

## 3.1 ¿Qué hace el frontend?

Es la **interfaz** que ves en el navegador. Está construida con **React + Vite** y usa **react-router-dom** para las páginas y **axios** para hablar con la API. Tiene **dos caras** en una misma app:

- **Panel interno** (`/`, `/clientes`, `/pedidos`…) → para el personal con sus roles.
- **Portal del cliente** (`/portal`, `/portal/datos`…) → lo que ve el cliente al iniciar sesión.

El "navegador no sabe nada de la base de datos": todo lo que muestra le llega por `/api/...` (que nginx reenvía al backend).

## 3.2 El archivo de configuración

### Archivo `frontend/package.json`

**Archivo:** `frontend/package.json` · 24 líneas

````json
{
  "name": "finanx-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.2",
    "vite": "^5.4.9"
  },
  "allowScripts": {
    "esbuild@0.21.5": true
  }
}
````

**Léelo así:** `npm run dev` arranca Vite en `http://localhost:5173` (modo desarrollo, con recarga en caliente); `npm run build` genera la versión de producción en `dist/` que sirve nginx en el puerto 8080.

## 3.3 Punto de entrada: `main.jsx`

Carga React, monta la app dentro de `<div id="root">` y la envuelve en tres proveedores:
- `<BrowserRouter>` → rutas navegables por URL.
- `<AuthProvider>` → sabe si hay un usuario con sesión.
- `<React.StrictMode>` → utilidad de desarrollo que detecta problemas.

### Archivo `frontend/src/main.jsx`

**Archivo:** `frontend/src/main.jsx` · 16 líneas

````jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
````

## 3.4 El mapa de rutas: `App.jsx`

**Este archivo define TODAS las pantallas y quién puede entrar a cada una.** Fíjate en los "guardias":

- `RequireAuth` → si no hay usuario, te manda a `/login`.
- `RequireInternal` / `RequireCliente` → separan panel interno de portal; si entras a la zona equivocada te redirigen a tu zona.
- `RequireRol roles={['ADMIN']}` → por ejemplo, `/usuarios` solo para el administrador.
- El componente `ClientPage` envuelve las páginas del portal con un encabezado.

### Archivo `frontend/src/App.jsx`

**Archivo:** `frontend/src/App.jsx` · 102 líneas

````jsx
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Shell } from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import Productos from './pages/Productos.jsx';
import Pedidos from './pages/Pedidos.jsx';
import PedidoForm from './pages/PedidoForm.jsx';
import PedidoDetalle from './pages/PedidoDetalle.jsx';
import Facturas from './pages/Facturas.jsx';
import FacturaDetalle from './pages/FacturaDetalle.jsx';
import Pagos from './pages/Pagos.jsx';
import Reportes from './pages/Reportes.jsx';
import NotasCredito from './pages/NotasCredito.jsx';
import BalanceClientes from './pages/BalanceClientes.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Auditoria from './pages/Auditoria.jsx';

import MisDatos from './pages/portal/MisDatos.jsx';
import MisCompras from './pages/portal/MisCompras.jsx';
import MisFacturas from './pages/portal/MisFacturas.jsx';
import MisPagos from './pages/portal/MisPagos.jsx';
import MiSaldo from './pages/portal/MiSaldo.jsx';
import MiHistorial from './pages/portal/MiHistorial.jsx';
import MisNotasCredito from './pages/portal/MisNotasCredito.jsx';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireInternal() {
  const { user } = useAuth();
  return user?.tipo === 'interno' ? <Outlet /> : <Navigate to="/portal" replace />;
}

function RequireCliente() {
  const { user } = useAuth();
  return user?.tipo === 'cliente' ? <Outlet /> : <Navigate to="/" replace />;
}

function RequireRol({ roles }) {
  const { user } = useAuth();
  const ok = user?.tipo === 'interno' && roles.includes(user.rol);
  return ok ? <Outlet /> : <Navigate to="/" replace />;
}

function ClientPage({ title, children }) {
  return (
    <>
      <div className="topbar"><h2>{title}</h2></div>
      <div className="content">{children}</div>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          {/* Portal del cliente */}
          <Route element={<RequireCliente />}>
            <Route path="/portal" element={<ClientPage title="Mi saldo"><MiSaldo /></ClientPage>} />
            <Route path="/portal/datos" element={<ClientPage title="Mis datos"><MisDatos /></ClientPage>} />
            <Route path="/portal/compras" element={<ClientPage title="Mis compras"><MisCompras /></ClientPage>} />
            <Route path="/portal/facturas" element={<ClientPage title="Mis facturas"><MisFacturas /></ClientPage>} />
            <Route path="/portal/pagos" element={<ClientPage title="Mis pagos"><MisPagos /></ClientPage>} />
            <Route path="/portal/historial" element={<ClientPage title="Mi historial financiero"><MiHistorial /></ClientPage>} />
            <Route path="/portal/notas" element={<ClientPage title="Mis notas de crédito"><MisNotasCredito /></ClientPage>} />
          </Route>

          {/* Usuarios internos */}
          <Route element={<RequireInternal />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/pedidos/nuevo" element={<PedidoForm />} />
            <Route path="/pedidos/:id" element={<PedidoDetalle />} />
            <Route path="/facturas" element={<Facturas />} />
            <Route path="/facturas/:id" element={<FacturaDetalle />} />
            <Route path="/pagos" element={<Pagos />} />
            <Route path="/notas-credito" element={<NotasCredito />} />
            <Route path="/balance-clientes" element={<BalanceClientes />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route element={<RequireRol roles={['ADMIN']} />}>
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
````

## 3.5 La sesión: `auth.jsx`

Un **contexto de React** que guarda el usuario y el token en `localStorage` y expone `{ user, login, logout }`. Todo componente puede llamar a `useAuth()` para saber quién está conectado.

### Archivo `frontend/src/auth.jsx`

**Archivo:** `frontend/src/auth.jsx` · 31 líneas

````jsx
import { createContext, useContext, useState } from 'react';

const AuthCtx = createContext(null);

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('fx_user'));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  const login = (u, token) => {
    localStorage.setItem('fx_user', JSON.stringify(u));
    localStorage.setItem('fx_token', token);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('fx_user');
    localStorage.removeItem('fx_token');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
````

## 3.6 El cliente HTTP: `api.js`

Una instancia de axios configurada una sola vez:
- **Interceptor de petición:** agrega `Authorization: Bearer <token>` a todas las llamadas.
- **Interceptor de respuesta:** si un endpoint responde **401**, limpia la sesión y te lleva al login. Además, hace que `api.get(...)` te devuelva **directamente los datos** (no el sobre completo de axios).
- `errMsg(err)` → convierte cualquier error en un mensaje legible para mostrar en pantalla.

### Archivo `frontend/src/api.js`

**Archivo:** `frontend/src/api.js` · 27 líneas

````js
import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('fx_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fx_token');
      localStorage.removeItem('fx_user');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export function errMsg(err) {
  return err?.response?.data?.error || err?.message || 'Error inesperado';
}

export default api;
````

## 3.7 Componentes de interfaz: `ui.jsx`

**Piezas reutilizables** para que todas las pantallas se vean iguales:
- `<Badge>` y `<Estado>` → "chips" de colores por estado (verde=activo/pagado, rojo=inactivo/anulado, naranja=pago parcial…).
- `<Money>` → formatea en pesos colombianos (COP).
- `<Fecha>` / `<FechaHora>` → fechas legibles en español.
- `<DatosPago>` → muestra el método de pago enmascarado (tarjeta `···1234 · vence 12/30`).
- `<Loading>`, `<ErrorBox>`, `<Empty>`, `<Section>` → estados comunes (cargando, error, vacío, tarjeta con título).

### Archivo `frontend/src/ui.jsx`

**Archivo:** `frontend/src/ui.jsx` · 81 líneas

````jsx
const TONES = {
  ACTIVO: 'green', INACTIVO: 'red',
  BORRADOR: 'gray', CONFIRMADO: 'blue', CANCELADO: 'red', FACTURADO: 'purple',
  ACTIVA: 'blue', ANULADA: 'red',
  PENDIENTE: 'gray', PAGO_PARCIAL: 'orange', PAGADA: 'green',
};

export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Estado({ value }) {
  const label = String(value || '').replaceAll('_', ' ');
  return <Badge tone={TONES[value] || 'gray'}>{label}</Badge>;
}

export function Money({ value, decimals = false }) {
  const fmt = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: decimals ? 2 : 0,
    minimumFractionDigits: 0,
  });
  return <>{fmt.format(Number(value || 0))}</>;
}

export function Fecha({ value }) {
  if (!value) return <span className="empty">—</span>;
  return <>{new Date(value).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}</>;
}

export function FechaHora({ value }) {
  if (!value) return <span className="empty">—</span>;
  return <>{new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</>;
}

/** Detalle legible del medio de pago (tarjeta enmascarada, transferencia, cheque, efectivo). */
export function DatosPago({ p }) {
  if (p?.metodo_pago === 'TARJETA') {
    const tipo = p.tipo_tarjeta ? `${p.tipo_tarjeta} ` : '';
    return (
      <>
        {tipo}···{p.ultimos_digitos_tarjeta || '····'}
        {p.vencimiento_tarjeta ? ` · vence ${p.vencimiento_tarjeta}` : ''}
        {p.banco ? ` · ${p.banco}` : ''}
      </>
    );
  }
  if (p?.metodo_pago === 'TRANSFERENCIA') {
    return <>Banco {p.banco || '—'}{p.numero_cuenta ? ` · cuenta ···${p.numero_cuenta.slice(-4)}` : ''}</>;
  }
  if (p?.metodo_pago === 'CHEQUE') {
    return p.banco ? `Cheque · ${p.banco}` : 'Cheque';
  }
  return null;
}

export function Loading() {
  return <div className="empty">Cargando…</div>;
}

export function ErrorBox({ msg }) {
  if (!msg) return null;
  return <div className="alert alert-error">{msg}</div>;
}

export function Empty({ text = 'Sin registros' }) {
  return <div className="empty">{text}</div>;
}

export function Section({ title, children, actions }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}
````

## 3.8 El diseño completo: `styles.css`

Toda la "pinta" de la app: paleta de colores (variables CSS `--primary`, `--success`…), la barra lateral, las tarjetas, las tablas, los modales (`overlay`/`modal`), los formularios, el hero de saldo y las reglas de **impresión** (`@media print`, para que la factura imprima limpia). Explórala por bloques: cada sección tiene un comentario (`/* ---------- Login ---------- */`, etc.).

### Archivo `frontend/src/styles.css`

**Archivo:** `frontend/src/styles.css` · 300 líneas

````css
:root {
  --primary: #1e3a8a;
  --primary-dark: #172554;
  --accent: #2563eb;
  --accent-light: #dbeafe;
  --success: #15803d;
  --success-light: #dcfce7;
  --warning: #b45309;
  --warning-light: #fef3c7;
  --danger: #b91c1c;
  --danger-light: #fee2e2;
  --purple: #6d28d9;
  --purple-light: #ede9fe;
  --gray: #64748b;
  --gray-light: #e2e8f0;
  --bg: #f1f5f9;
  --card: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --radius: 10px;
  --shadow: 0 1px 3px rgba(15, 23, 42, .08), 0 4px 16px rgba(15, 23, 42, .06);
}

* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}

/* ---------- Login ---------- */
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 55%, var(--accent) 100%);
  padding: 24px;
}
.login-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
  padding: 40px 44px;
  width: 100%;
  max-width: 420px;
}
.login-card h1 { margin: 0 0 4px; font-size: 26px; color: var(--primary-dark); letter-spacing: .5px; }
.login-card .sub { color: var(--muted); margin: 0 0 24px; }
.login-hint {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--accent-light);
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--primary-dark);
  line-height: 1.6;
}
.login-switch {
  margin-top: 18px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}
.link {
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 0;
  text-decoration: underline;
}
.link:hover { color: var(--primary-dark); }
.divider {
  margin: 6px 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: var(--muted);
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* ---------- Layout ---------- */
.layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 248px;
  background: linear-gradient(180deg, var(--primary-dark), var(--primary));
  color: #e0e7ff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
.sidebar .brand {
  padding: 22px 20px;
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, .12);
}
.sidebar .brand small { display: block; font-weight: 400; font-size: 11.5px; color: #94a3b8; letter-spacing: .5px; }
.sidebar nav { padding: 14px 10px; flex: 1; }
.sidebar .nav-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
  color: #94a3b8; padding: 12px 12px 4px;
}
.sidebar a {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; margin: 2px 0;
  border-radius: 8px; color: #cbd5e1; text-decoration: none; font-weight: 500;
  transition: background .15s;
}
.sidebar a:hover { background: rgba(255, 255, 255, .08); color: #fff; }
.sidebar a.active { background: rgba(255, 255, 255, .16); color: #fff; }
.sidebar .icon { width: 18px; text-align: center; }
.sidebar .user-box {
  padding: 16px 20px; border-top: 1px solid rgba(255, 255, 255, .12);
  font-size: 13px;
}
.sidebar .user-box strong { color: #fff; display: block; }
.sidebar .user-box span { color: #a5b4fc; font-size: 12px; }
.sidebar .logout {
  margin-top: 8px; width: 100%; background: rgba(255, 255, 255, .12);
  border: none; color: #fff; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: 600;
}
.sidebar .logout:hover { background: rgba(255, 255, 255, .22); }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 16px 28px;
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 10;
}
.topbar h2 { margin: 0; font-size: 20px; }
.topbar .crumb { color: var(--muted); font-size: 13px; }
.content { padding: 26px 28px; flex: 1; }

/* ---------- Cards ---------- */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px 22px;
  margin-bottom: 18px;
}
.card h3 { margin: 0 0 14px; font-size: 16px; }
.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.stat {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 18px 20px;
}
.stat .label { color: var(--muted); font-size: 12.5px; text-transform: uppercase; letter-spacing: .6px; }
.stat .value { font-size: 26px; font-weight: 800; margin-top: 6px; color: var(--primary-dark); }
.stat .value.green { color: var(--success); }
.stat .value.warn { color: var(--warning); }
.stat .value.red { color: var(--danger); }
.stat .value.purple { color: var(--purple); }

/* ---------- Tables ---------- */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
tr:hover td { background: #f8fafc; }
td.num, th.num { text-align: right; }
.row-actions { display: flex; gap: 6px; }

/* ---------- Badges ---------- */
.badge {
  display: inline-block; padding: 3px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 700; letter-spacing: .3px;
}
.badge-green  { background: var(--success-light); color: var(--success); }
.badge-red    { background: var(--danger-light); color: var(--danger); }
.badge-gray   { background: var(--gray-light); color: var(--gray); }
.badge-blue   { background: var(--accent-light); color: var(--accent); }
.badge-orange { background: var(--warning-light); color: var(--warning); }
.badge-purple { background: var(--purple-light); color: var(--purple); }

/* ---------- Forms ---------- */
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 12.5px; font-weight: 600; color: var(--muted); }
input, select, textarea {
  padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 14px; font-family: inherit; background: #fff; color: var(--text);
  outline: none; transition: border .15s, box-shadow .15s;
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
textarea { resize: vertical; min-height: 64px; }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border: none; border-radius: 8px; cursor: pointer;
  font-size: 14px; font-weight: 600; text-decoration: none; transition: filter .15s;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-success { background: var(--success); color: #fff; }
.btn-danger  { background: var(--danger); color: #fff; }
.btn-ghost   { background: #fff; border: 1px solid var(--border); color: var(--text); }
.btn-warn    { background: var(--warning); color: #fff; }
.btn-sm { padding: 5px 10px; font-size: 12.5px; }
.btn:hover { filter: brightness(1.08); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.toolbar .spacer { flex: 1; }

/* ---------- Messages ---------- */
.alert { padding: 11px 14px; border-radius: 8px; font-weight: 600; margin-bottom: 14px; font-size: 13.5px; }
.alert-error { background: var(--danger-light); color: var(--danger); }
.alert-success { background: var(--success-light); color: var(--success); }
.alert-info { background: var(--brand-light); color: var(--brand); }
.empty { text-align: center; color: var(--muted); padding: 34px 10px; font-style: italic; }

/* ---------- Modal ---------- */
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15, 23, 42, .55);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.modal {
  background: #fff; border-radius: 14px; width: 100%; max-width: 440px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .35);
  max-height: 92vh; overflow-y: auto;
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.modal-head h3 { margin: 0; font-size: 16px; }
.modal-body { padding: 18px 20px 20px; }
.btn-close {
  background: none; border: none; font-size: 22px; line-height: 1;
  cursor: pointer; color: var(--muted); padding: 2px 6px; border-radius: 6px;
}
.btn-close:hover { color: var(--danger); background: var(--danger-light); }
.saldo-hint {
  padding: 10px 12px; background: var(--accent-light); border-radius: 8px;
  font-size: 13px; color: var(--primary-dark); margin-bottom: 14px;
}

/* ---------- Módulo de saldo resumen ---------- */
.balance-hero {
  background: linear-gradient(135deg, var(--primary-dark), var(--accent));
  color: #fff; border-radius: 14px; padding: 26px 30px; margin-bottom: 20px;
}
.balance-hero .big { font-size: 34px; font-weight: 800; margin-top: 6px; }
.balance-hero .lbl { opacity: .85; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
.balance-chips { display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.balance-chips .chip {
  background: rgba(255, 255, 255, .14); border-radius: 10px; padding: 10px 16px;
}
.balance-chips .chip b { display: block; font-size: 18px; }
.balance-chips .chip span { font-size: 12px; opacity: .85; }

@media (max-width: 900px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; height: auto; position: static; }
  .content { padding: 18px; }
}

/* ---------- Impresión (vista previa de factura) ---------- */
@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 14px !important; font-size: 12px; }
  .no-print { display: none !important; }
}
````

## 3.9 El esqueleto de todas las pantallas: `components/Layout.jsx`

El **Shell** que rodea a las páginas una vez dentro de la sesión: barra lateral con la marca FINAN·X, la navegación según quién seas (menú de "Operación" para internos con el ítem extra "Usuarios" si eres ADMIN; menú de "Mi cuenta" para clientes) y la caja del usuario con "Cerrar sesión". El `<Outlet />` dibuja la página activa dentro del área principal.

### Archivo `frontend/src/components/Layout.jsx`

**Archivo:** `frontend/src/components/Layout.jsx` · 101 líneas

````jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const ICONS = {
  inicio: '📊', clientes: '👥', productos: '📦', pedidos: '🧾', facturas: '📄',
  pagos: '💳', notas: '🔖', balance: '⚖️', reportes: '📈', usuarios: '🔐', auditoria: '🛡️',
  saldo: '💰', datos: '👤', compras: '🛒', historial: '🗂️',
};

const NAVS = {
  interno: [
    { label: 'Inicio', icon: 'inicio', to: '/' },
    { label: 'Clientes', icon: 'clientes', to: '/clientes' },
    { label: 'Productos', icon: 'productos', to: '/productos' },
    { label: 'Pedidos', icon: 'pedidos', to: '/pedidos' },
    { label: 'Facturas', icon: 'facturas', to: '/facturas' },
    { label: 'Pagos', icon: 'pagos', to: '/pagos' },
    { label: 'Notas crédito', icon: 'notas', to: '/notas-credito' },
    { label: 'Balances por cliente', icon: 'balance', to: '/balance-clientes' },
    { label: 'Reportes', icon: 'reportes', to: '/reportes' },
    { label: 'Auditoría', icon: 'auditoria', to: '/auditoria' },
  ],
  adminExtra: [{ label: 'Usuarios', icon: 'usuarios', to: '/usuarios' }],
  cliente: [
    { label: 'Mi saldo', icon: 'saldo', to: '/portal' },
    { label: 'Mis datos', icon: 'datos', to: '/portal/datos' },
    { label: 'Mis compras', icon: 'compras', to: '/portal/compras' },
    { label: 'Mis facturas', icon: 'facturas', to: '/portal/facturas' },
    { label: 'Mis pagos', icon: 'pagos', to: '/portal/pagos' },
    { label: 'Mis notas de crédito', icon: 'notas', to: '/portal/notas' },
    { label: 'Mi historial', icon: 'historial', to: '/portal/historial' },
  ],
};

export function Shell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { logout } = useAuth();

  if (!user) return null;

  const isCliente = user.tipo === 'cliente';
  const navs = isCliente
    ? NAVS.cliente
    : [...NAVS.interno, ...(user.rol === 'ADMIN' ? NAVS.adminExtra : [])];

  const exit = () => {
    logout();
    navigate('/login');
  };

  const rolLabel = isCliente ? 'Cliente' : user.rol;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          FINAN·X
          <small>Facturación y pagos</small>
        </div>
        <nav>
          {!isCliente && <div className="nav-label">Operación</div>}
          {isCliente && <div className="nav-label">Mi cuenta</div>}
          {navs.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/' || n.to === '/portal'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon">{ICONS[n.icon]}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <strong>{user.nombre}</strong>
          <span>{rolLabel}{isCliente ? ` · ${user.username}` : ` · ${user.correo}`}</span>
          <button className="logout" onClick={exit}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function Topbar({ title, crumb }) {
  const { user } = useAuth();
  return (
    <div className="topbar">
      <div>
        <h2>{title}</h2>
        {crumb && <div className="crumb">{crumb}</div>}
      </div>
      <div>
        {user?.tipo === 'interno' && <EntityPill />}
      </div>
    </div>
  );
}

function EntityPill() {
  return null;
}
````

## 3.10 La factura imprimible: `components/FacturaPreview.jsx`

Un modal que dibuja la **factura como documento** (encabezado con NIT, datos "FACTURAR A", tabla de líneas, totales, notas de crédito) y botones para **Imprimir** (`window.print()`) y **Enviar por correo** (arma un `mailto:` con el resumen en texto).

### Archivo `frontend/src/components/FacturaPreview.jsx`

**Archivo:** `frontend/src/components/FacturaPreview.jsx` · 198 líneas

````jsx
import { Money, Estado, Fecha } from '../ui.jsx';

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(v || 0));

/**
 * FacturaPreview — previsualización imprimible de una factura (detalle completo).
 * Props: data (objeto de GET /facturas/:id), onCerrar().
 * Incluye: impresión (window.print con CSS @media print) y envío por correo (mailto).
 */
export default function FacturaPreview({ data, onCerrar }) {
  const to = data.correo || '';

  const cuerpoLineas = () => {
    const L = [];
    L.push(`FACTURA ${data.numero_factura} — FINAN-X`);
    L.push(`Pedido: ${data.numero_pedido || '—'}`);
    L.push('');
    L.push('DATOS DEL CLIENTE');
    L.push(`Cliente: ${data.nombre_razon_social}`);
    L.push(`Identificación: ${data.numero_identificacion}`);
    if (data.direccion) L.push(`Dirección: ${data.direccion}`);
    if (data.ciudad) L.push(`Ciudad: ${data.ciudad}`);
    if (data.correo) L.push(`Correo: ${data.correo}`);
    if (data.telefono) L.push(`Teléfono: ${data.telefono}`);
    L.push('');
    L.push('DETALLE');
    for (const l of data.lineas || []) {
      L.push(`  ${l.codigo} · ${l.producto_nombre} · ${l.cantidad} × ${fmt(l.precio_unitario)} = ${fmt(l.subtotal)}`);
    }
    L.push('');
    L.push(`Subtotal: ${fmt(data.subtotal)}`);
    L.push(`Impuestos: ${fmt(data.impuestos)}`);
    L.push(`TOTAL: ${fmt(data.total)}`);
    L.push('');
    L.push(`Pagado: ${fmt(data.valor_pagado)}`);
    L.push(`Saldo pendiente: ${fmt(data.saldo)}`);
    L.push(`Estado: ${data.estado} / ${data.estado_pago}`);
    if (data.notas_credito?.length) {
      L.push('');
      L.push('NOTAS DE CRÉDITO');
      for (const n of data.notas_credito) {
        if (n.estado === 'ACTIVA') L.push(`  ${n.numero_nota} · ${fmt(n.valor)} · ${n.motivo}`);
      }
    }
    L.push('');
    L.push('FINAN-X — Facturación y pagos');
    return L.join('\n');
  };

  const mailto = to
    ? `mailto:${to}?subject=${encodeURIComponent(`Factura ${data.numero_factura} · FINAN-X`)}&body=${encodeURIComponent(cuerpoLineas())}`
    : null;

  return (
    <div className="overlay" style={{ zIndex: 60 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal" style={{ maxWidth: 760, width: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head no-print">
          <h3>Vista previa · {data.numero_factura}</h3>
          <button className="btn-close" onClick={onCerrar}>×</button>
        </div>

        <div className="modal-body" style={{ overflow: 'auto', padding: 0 }}>
          <div className="print-area" style={{ padding: 26, fontSize: 13.5 }}>
            {/* Encabezado */}
            <table style={{ width: '100%', borderBottom: '2px solid #000', marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>FINAN·X</div>
                    <div style={{ opacity: 0.7 }}>Facturación y pagos</div>
                    <div style={{ opacity: 0.7, marginTop: 2 }}>NIT 900.000.000-1 · Bogotá, Colombia</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{data.numero_factura}</div>
                    <div style={{ opacity: 0.7 }}>Emisión: <Fecha value={data.fecha_emision} /></div>
                    <div style={{ opacity: 0.7 }}>Vencimiento: <Fecha value={data.fecha_vencimiento} /></div>
                    <div style={{ marginTop: 4 }}><Estado value={data.estado_pago} /></div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td style={{ width: '55%', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>FACTURAR A</div>
                    <div>{data.nombre_razon_social}</div>
                    <div>{data.numero_identificacion}</div>
                    {data.direccion && <div>{data.direccion}</div>}
                    {data.ciudad && <div>{data.ciudad}</div>}
                    {data.correo && <div>{data.correo}</div>}
                    {data.telefono && <div>{data.telefono}</div>}
                  </td>
                  <td style={{ width: '45%', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>PEDIDO</div>
                    <div>{data.numero_pedido || '—'}</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>CONDICIÓN DE PAGO</div>
                    <div>Contado / Crédito a {fechaVenc(data)}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Líneas */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
              <thead>
                <tr style={{ background: '#f1f3f5' }}>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'left' }}>Código</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'left' }}>Descripción</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>Cant.</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>Precio unitario</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>IVA</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(data.lineas || []).map((l, i) => (
                  <tr key={i}>
                    <td style={td}>{l.codigo}</td>
                    <td style={td}>{l.producto_nombre}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.cantidad}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(l.precio_unitario)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.impuesto}%</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td />
                  <td style={{ width: 230, padding: '3px 6px' }}>Subtotal</td>
                  <td style={{ width: 130, padding: '3px 6px', textAlign: 'right' }}>{fmt(data.subtotal)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px' }}>Impuestos</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(data.impuestos)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px', fontWeight: 800 }}>TOTAL</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800 }}>{fmt(data.total)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px' }}>Pagado</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(data.valor_pagado)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px', fontWeight: 700 }}>Saldo pendiente</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>{fmt(data.saldo)}</td>
                </tr>
              </tbody>
            </table>

            {(data.notas_credito || []).length > 0 && (
              <table style={{ width: '100%', marginTop: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left', background: '#f1f3f5' }} colSpan={4}>Notas de crédito</th></tr>
                </thead>
                <tbody>
                  {(data.notas_credito || []).map((n) => (
                    <tr key={n.nota_credito_id}>
                      <td style={{ ...td, width: 130 }}>{n.numero_nota}</td>
                      <td style={td}>{n.estado}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmt(n.valor)}</td>
                      <td style={td}>{n.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 18, fontSize: 11.5, opacity: 0.65, textAlign: 'center' }}>
              Documento generado por FINAN-X · Pedido {data.numero_pedido || '—'} · {new Date().toLocaleString('es-CO')}
            </div>
          </div>
        </div>

        <div className="modal-foot no-print" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {mailto && (
            <a className="btn btn-primary" href={mailto} style={{ textDecoration: 'none' }}>✉ Enviar por correo</a>
          )}
          <button className="btn btn-success" onClick={() => window.print()}>🖨 Imprimir</button>
          <button className="btn btn-ghost" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function fechaVenc(data) {
  if (!data.fecha_vencimiento) return '—';
  return new Date(data.fecha_vencimiento).toLocaleDateString('es-CO');
}

const td = { border: '1px solid #ccc', padding: '6px 9px', textAlign: 'left' };
````

## 3.11 La pantalla de login/registro/recuperar: `pages/Login.jsx`

Un archivo con **tres modos** en el mismo formulario (`mode === 'login' | 'registro' | 'recuperar'`):
1. **Iniciar sesión** → `POST /auth/login`, y según el `tipo` del usuario navega a `/` (interno) o `/portal` (cliente).
2. **Crear cuenta** → formulario completo de autoregistro → `POST /auth/registro` (el backend crea cliente + cuenta y ya te deja adentro).
3. **Recuperar contraseña** → dos pasos: `recuperar-solicitar` (pide OTP por correo o SMS; en demo te muestra `demo_otp`) y `recuperar-cambiar` (valida el código y cambia la clave).

### Archivo `frontend/src/pages/Login.jsx`

**Archivo:** `frontend/src/pages/Login.jsx` · 301 líneas

````jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';

const ID_TIPOS = ['CC', 'CE', 'NIT', 'PASAPORTE'];

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'registro' | 'recuperar'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reg, setReg] = useState({
    tipoCliente: 'PERSONA',
    tipoIdentificacion: 'CC',
    numeroIdentificacion: '',
    nombreRazonSocial: '',
    telefono: '',
    correo: '',
    direccion: '',
    ciudad: '',
    regUsername: '',
    regPassword: '',
    confirm: '',
  });
  // Recuperación de contraseña (código de un solo uso enviado por SMS o correo)
  const [recov, setRecov] = useState({ username: '', canal: 'EMAIL', codigo: '', nuevaClave: '', confirm: '' });
  const [recovStep, setRecovStep] = useState('solicitar'); // 'solicitar' | 'codigo'
  const [recovInfo, setRecovInfo] = useState(null); // { mensaje, demo_otp?, destino?, canal? }
  const [recovOk, setRecovOk] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setReg((f) => ({ ...f, [k]: e.target.value }));
  const setR = (k) => (e) => setRecov((f) => ({ ...f, [k]: e.target.value }));

  const entrar = (user, token) => {
    login(user, token);
    navigate(user.tipo === 'cliente' ? '/portal' : '/', { replace: true });
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.post('/auth/login', { username, password });
      entrar(user, token);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const submitRegistro = async (e) => {
    e.preventDefault();
    setError('');
    if (reg.regPassword !== reg.confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      const { token, user } = await api.post('/auth/registro', {
        tipoCliente: reg.tipoCliente,
        tipoIdentificacion: reg.tipoIdentificacion,
        numeroIdentificacion: reg.numeroIdentificacion,
        nombreRazonSocial: reg.nombreRazonSocial,
        telefono: reg.telefono || undefined,
        correo: reg.correo || undefined,
        direccion: reg.direccion || undefined,
        ciudad: reg.ciudad || undefined,
        username: reg.regUsername,
        password: reg.regPassword,
      });
      entrar(user, token);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const submitSolicitar = async (e) => {
    e.preventDefault();
    setError('');
    if (!recov.username) { setError('Indique su usuario o correo'); return; }
    setLoading(true);
    try {
      const resp = await api.post('/auth/recuperar-solicitar', { username: recov.username, canal: recov.canal });
      setRecovInfo(resp);
      setRecovStep('codigo');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const submitCambiar = async (e) => {
    e.preventDefault();
    setError('');
    if (recov.nuevaClave !== recov.confirm) { setError('Las contraseñas no coinciden'); return; }
    if (recov.nuevaClave.length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const resp = await api.post('/auth/recuperar-cambiar', {
        username: recov.username,
        codigo: recov.codigo,
        nuevaClave: recov.nuevaClave,
      });
      setRecovOk(resp.mensaje || 'Contraseña actualizada.');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => { setError(''); setMode(m); };
  const abrirRecuperar = () => { setError(''); setRecov({ username, canal: 'EMAIL', codigo: '', nuevaClave: '', confirm: '' }); setRecovInfo(null); setRecovOk(''); setRecovStep('solicitar'); setMode('recuperar'); };

  return (
    <div className="login-wrap">
      {mode === 'login' ? (
        <form className="login-card" onSubmit={submitLogin}>
          <h1>FINAN·X</h1>
          <p className="sub">Ingrese a su cuenta de facturación y pagos</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Usuario o correo</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario@empresa.com" autoComplete="username" required />
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="link" onClick={abrirRecuperar}>¿Olvidaste tu contraseña?</button>
          </div>
          <div className="login-hint">
            <strong>Credenciales demo:</strong><br />
            Interno: <code>admin@finanx.test</code> / <code>admin123</code><br />
            Cliente: <code>cliente@finanx.test</code> / <code>cliente123</code>
          </div>
          <div className="login-switch">
            ¿Eres cliente nuevo?{' '}
            <button type="button" className="link" onClick={() => switchMode('registro')}>Crear cuenta</button>
          </div>
        </form>
      ) : mode === 'registro' ? (
        <form className="login-card" onSubmit={submitRegistro}>
          <h1>FINAN·X</h1>
          <p className="sub">Crea tu cuenta de cliente en minutos</p>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Tipo de cliente</label>
            <select value={reg.tipoCliente} onChange={set('tipoCliente')}>
              <option value="PERSONA">Persona natural</option>
              <option value="EMPRESA">Empresa</option>
            </select>
          </div>
          <div className="row2">
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Tipo de identificación</label>
              <select value={reg.tipoIdentificacion} onChange={set('tipoIdentificacion')}>
                {ID_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Número de identificación</label>
              <input value={reg.numeroIdentificacion} onChange={set('numeroIdentificacion')} placeholder="123456789" required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Nombre / Razón social</label>
            <input value={reg.nombreRazonSocial} onChange={set('nombreRazonSocial')} placeholder="Nombre completo o empresa" required />
          </div>
          <div className="row2">
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Correo (opcional)</label>
              <input type="email" value={reg.correo} onChange={set('correo')} placeholder="correo@ejemplo.com" />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Teléfono (opcional)</label>
              <input value={reg.telefono} onChange={set('telefono')} placeholder="3001234567" />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Ciudad (opcional)</label>
            <input value={reg.ciudad} onChange={set('ciudad')} placeholder="Bogotá" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Dirección (opcional)</label>
            <input value={reg.direccion} onChange={set('direccion')} placeholder="Calle 10 # 5-20" />
          </div>

          <div className="divider">Credenciales de acceso al portal</div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Usuario</label>
            <input value={reg.regUsername} onChange={set('regUsername')} placeholder="mi.usuario" autoComplete="username" required />
          </div>
          <div className="row2">
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Contraseña</label>
              <input type="password" value={reg.regPassword} onChange={set('regPassword')} placeholder="Mínimo 6 caracteres" autoComplete="new-password" required />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Confirmar contraseña</label>
              <input type="password" value={reg.confirm} onChange={set('confirm')} placeholder="Repítela" autoComplete="new-password" required />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta e ingresar'}
          </button>
          <div className="login-switch">
            ¿Ya tienes cuenta?{' '}
            <button type="button" className="link" onClick={() => switchMode('login')}>Iniciar sesión</button>
          </div>
        </form>
      ) : (
        <div className="login-card">
          <h1>FINAN·X</h1>
          <p className="sub">Recupera tu contraseña con un código de seguridad</p>
          {recovOk ? (
            <>
              <div className="alert alert-success">{recovOk}</div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => switchMode('login')}>
                Volver a iniciar sesión
              </button>
            </>
          ) : recovStep === 'solicitar' ? (
            <form onSubmit={submitSolicitar}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Usuario o correo</label>
                <input value={recov.username} onChange={setR('username')} placeholder="mi.usuario o correo registrado" autoComplete="username" required />
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>¿Dónde recibes tu código de seguridad?</label>
                <select value={recov.canal} onChange={setR('canal')}>
                  <option value="EMAIL">Correo electrónico</option>
                  <option value="SMS">SMS (teléfono)</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar código de seguridad'}
              </button>
              {recovInfo && (
                <div className="alert alert-info" style={{ marginTop: 12 }}>
                  {recovInfo.mensaje}
                  {recovInfo.destino ? <> Se envió a <b>{recovInfo.destino}</b></> : null}
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={submitCambiar}>
              {error && <div className="alert alert-error">{error}</div>}
              {recovInfo && (
                <div className="alert alert-info">
                  {recovInfo.mensaje}
                  {recovInfo.destino ? <> Se envió a <b>{recovInfo.destino}</b></> : null}
                </div>
              )}
              {recovInfo?.demo_otp && (
                <div className="alert alert-info">
                  <b>Entorno de demostración:</b> tu código es <b>{recovInfo.demo_otp}</b>. En producción se enviaría por {recovInfo.canal === 'SMS' ? 'SMS' : 'correo electrónico'}.
                </div>
              )}
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Código de seguridad (6 dígitos)</label>
                <input value={recov.codigo} onChange={setR('codigo')} placeholder="123456" inputMode="numeric" maxLength={6} required />
              </div>
              <div className="row2">
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Nueva contraseña</label>
                  <input type="password" value={recov.nuevaClave} onChange={setR('nuevaClave')} placeholder="Mínimo 6 caracteres" autoComplete="new-password" required />
                </div>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Confirmar contraseña</label>
                  <input type="password" value={recov.confirm} onChange={setR('confirm')} placeholder="Repítela" autoComplete="new-password" required />
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </form>
          )}
          <div className="login-switch">
            <button type="button" className="link" onClick={() => switchMode('login')}>← Volver a iniciar sesión</button>
          </div>
        </div>
      )}
    </div>
  );
}
````

## 3.12 Las páginas del panel interno (patrón común)

Las páginas internas siguen un **patrón idéntico** para que sea fácil aprender: estado de datos → `cargar()` con `api.get` en un `useEffect` → tablas/formularios → `ErrorBox`/`Loading` para los estados. Te conviene leer **una con calma** (p. ej. `Clientes.jsx`) y el resto se te harán familiares:

- **`Dashboard.jsx`** — tarjetas de resumen (`/reportes/resumen`) + últimas operaciones (`/auditoria` limit 8).
- **`Clientes.jsx`** — CRUD + activar/inactivar + crear cuenta del portal + "Enviar estado" (usa el resumen de correo del backend).
- **`Productos.jsx`** — CRUD del catálogo con baja lógica.
- **`Pedidos.jsx` / `PedidoForm.jsx` / `PedidoDetalle.jsx`** — listado; formulario con líneas y total en vivo; detalle con acciones (`Confirmar`, `Cancelar`, `Generar factura`).
- **`Facturas.jsx` / `FacturaDetalle.jsx`** — listado con filtros y vista previa; detalle con saldo, **registrar pago** (con datos por método), **notas de crédito** y **anulación** con motivo.
- **`Pagos.jsx`** — consulta de pagos con total de la vista y detalle del método.
- **`NotasCredito.jsx`** — listado, creación (elige factura y el "disponible" se calcula solo) y anulación con motivo.
- **`Reportes.jsx`** — resumen, reporte de facturación por fechas e historial por cliente.
- **`BalanceClientes.jsx`** — dashboard de cuentas por cobrar: saldos por cliente, historial en vivo y envío del estado por correo.
- **`Usuarios.jsx`** — gestión de usuarios internos (solo ADMIN).
- **`Auditoria.jsx`** — bitácora filtrable.

### Archivo `frontend/src/pages/Dashboard.jsx`

**Archivo:** `frontend/src/pages/Dashboard.jsx` · 70 líneas

````jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Section, FechaHora, Estado, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Dashboard() {
  const [resumen, setResumen] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [r, a] = await Promise.all([api.get('/reportes/resumen'), api.get('/auditoria', { params: { limit: 8 } })]);
        setResumen(r);
        setRecientes(a);
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, []);

  if (error) return <div className="content"><ErrorBox msg={error} /></div>;
  if (!resumen) return <div className="content"><Loading /></div>;

  return (
    <>
      <div className="topbar"><h2>Inicio</h2></div>
      <div className="content">
        <div className="grid-cards">
          <div className="stat"><div className="label">Clientes activos</div><div className="value">{resumen.clientes_activos}</div></div>
          <div className="stat"><div className="label">Productos activos</div><div className="value">{resumen.productos_activos}</div></div>
          <div className="stat"><div className="label">Pedidos totales</div><div className="value">{resumen.total_pedidos}</div></div>
          <div className="stat"><div className="label">Por facturar</div><div className="value warn">{resumen.pedidos_por_facturar}</div></div>
          <div className="stat"><div className="label">Facturas activas</div><div className="value">{resumen.facturas_activas}</div></div>
          <div className="stat"><div className="label">Cuentas por cobrar</div><div className="value red"><Money value={resumen.saldo_pendiente_total} /></div></div>
          <div className="stat"><div className="label">Pagos recibidos</div><div className="value green"><Money value={resumen.pagos_recibidos} /></div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Section title="Acciones rápidas">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" to="/pedidos/nuevo">+ Nuevo pedido</Link>
              <Link className="btn btn-ghost" to="/clientes">Clientes</Link>
              <Link className="btn btn-ghost" to="/productos">Productos</Link>
              <Link className="btn btn-ghost" to="/facturas">Facturas</Link>
            </div>
          </Section>
          <Section title="Operaciones recientes (auditoría)">
            {recientes.length === 0 ? <Empty /> : (
              <table>
                <thead><tr><th>Fecha</th><th>Módulo</th><th>Operación</th><th>Descripción</th></tr></thead>
                <tbody>
                  {recientes.map((a) => (
                    <tr key={a.auditoria_id}>
                      <td><FechaHora value={a.fecha_hora} /></td>
                      <td>{a.modulo}</td>
                      <td><Estado value={a.operacion === 'REGISTRAR' ? 'PAGO_PARCIAL' : a.operacion} /></td>
                      <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/Clientes.jsx`

**Archivo:** `frontend/src/pages/Clientes.jsx` · 198 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

const EMPTY = { tipoCliente: 'PERSONA', tipoIdentificacion: 'CC', numeroIdentificacion: '', nombreRazonSocial: '', telefono: '', correo: '', direccion: '', ciudad: '' };

export default function Clientes() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [cuenta, setCuenta] = useState({ username: '', password: '' });
  const [cuentaPara, setCuentaPara] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/clientes', { params: { q, estado } });
      setRows(data);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const search = (e) => { e.preventDefault(); load(); };

  const openNew = () => { setEdit(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (r) => {
    setEdit(r.cliente_id);
    setForm({
      tipoCliente: r.tipo_cliente, tipoIdentificacion: r.tipo_identificacion,
      numeroIdentificacion: r.numero_identificacion, nombreRazonSocial: r.nombre_razon_social,
      telefono: r.telefono || '', correo: r.correo || '', direccion: r.direccion || '', ciudad: r.ciudad || '',
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      if (edit) await api.put(`/clientes/${edit}`, form);
      else await api.post('/clientes', form);
      setShowForm(false);
      setMsg(edit ? 'Cliente actualizado' : 'Cliente registrado');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggleEstado = async (r) => {
    try {
      await api.patch(`/clientes/${r.cliente_id}/estado`, { estado: r.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const crearCuenta = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.post(`/clientes/${cuentaPara}/cuenta`, cuenta);
      setCuentaPara(null); setCuenta({ username: '', password: '' });
      setMsg('Cuenta de acceso creada');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const enviarEstado = async (r) => {
    setError(''); setMsg('');
    try {
      const res = await api.get(`/clientes/${r.cliente_id}/resumen-correo`);
      if (!res.destinatario) { setError(`${r.nombre_razon_social} no tiene correo registrado`); return; }
      window.location.href = `mailto:${res.destinatario}?subject=${encodeURIComponent(res.asunto)}&body=${encodeURIComponent(res.cuerpo)}`;
      setMsg(`Se abrió su programa de correo con el estado financiero de ${r.nombre_razon_social} (${res.destinatario})`);
    } catch (err) { setError(errMsg(err)); }
  };

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="topbar"><h2>Clientes</h2><div className="crumb">Gestión de clientes y cuentas de acceso</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <form onSubmit={search} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o NIT" style={{ width: 300 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo cliente</button>
        </div>

        {showForm && (
          <div className="card">
            <h3>{edit ? 'Editar cliente' : 'Registrar cliente'}</h3>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field"><label>Tipo de cliente</label>
                  <select value={form.tipoCliente} onChange={upd('tipoCliente')}>
                    <option value="PERSONA">Persona</option><option value="EMPRESA">Empresa</option>
                  </select></div>
                <div className="field"><label>Tipo de identificación</label>
                  <select value={form.tipoIdentificacion} onChange={upd('tipoIdentificacion')}>
                    <option value="CC">Cédula</option><option value="NIT">NIT</option>
                    <option value="CE">Cédula extranjería</option><option value="PASAPORTE">Pasaporte</option>
                  </select></div>
                <div className="field"><label>N.º de identificación *</label>
                  <input value={form.numeroIdentificacion} onChange={upd('numeroIdentificacion')} required /></div>
                <div className="field"><label>Nombre o razón social *</label>
                  <input value={form.nombreRazonSocial} onChange={upd('nombreRazonSocial')} required /></div>
                <div className="field"><label>Teléfono</label>
                  <input value={form.telefono} onChange={upd('telefono')} /></div>
                <div className="field"><label>Correo</label>
                  <input type="email" value={form.correo} onChange={upd('correo')} /></div>
                <div className="field"><label>Dirección</label>
                  <input value={form.direccion} onChange={upd('direccion')} /></div>
                <div className="field"><label>Ciudad</label>
                  <input value={form.ciudad} onChange={upd('ciudad')} /></div>
              </div>
              <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay clientes" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Identificación</th><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Ciudad</th><th>Estado</th><th>Cuenta</th><th className="num">Saldo pendiente</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cliente_id}>
                      <td>{r.tipo_identificacion} {r.numero_identificacion}</td>
                      <td><b>{r.nombre_razon_social}</b></td>
                      <td>{r.telefono || '—'}</td>
                      <td>{r.correo || '—'}</td>
                      <td>{r.ciudad || '—'}</td>
                      <td><Estado value={r.estado} /></td>
                      <td>{r.tiene_cuenta ? <Estado value="ACTIVO" tone="green">Cuenta</Estado> : <button className="btn btn-ghost btn-sm" onClick={() => { setCuentaPara(r.cliente_id); setCuenta({ username: '', password: '' }); }}>Crear cuenta</button>}</td>
                      <td className="num"><Money value={r.saldo_pendiente} /></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => enviarEstado(r)} disabled={!r.correo} title={!r.correo ? 'El cliente no tiene correo' : 'Enviar estado financiero por correo'}>
                            ✉ Estado
                          </button>
                          <button className={`btn btn-sm ${r.estado === 'ACTIVO' ? 'btn-warn' : 'btn-success'}`} onClick={() => toggleEstado(r)}>
                            {r.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {cuentaPara != null && (
          <div className="card">
            <h3>Crear cuenta de acceso del cliente</h3>
            <form onSubmit={crearCuenta} className="form-grid">
              <div className="field"><label>Usuario *</label>
                <input value={cuenta.username} onChange={(e) => setCuenta({ ...cuenta, username: e.target.value })} required /></div>
              <div className="field"><label>Contraseña *</label>
                <input value={cuenta.password} onChange={(e) => setCuenta({ ...cuenta, password: e.target.value })} required minLength={6} /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" type="submit">Crear</button>
                <button className="btn btn-ghost" type="button" onClick={() => setCuentaPara(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/Productos.jsx`

**Archivo:** `frontend/src/pages/Productos.jsx` · 142 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, Estado, ErrorBox, Loading, Empty } from '../ui.jsx';

const EMPTY = { codigo: '', nombre: '', descripcion: '', categoria: '', precio: '', impuesto: 0, unidadMedida: 'UND' };

export default function Productos() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/productos', { params: { q, estado } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (r) => {
    setEdit(r.producto_id);
    setForm({
      codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion || '', categoria: r.categoria || '',
      precio: r.precio, impuesto: r.impuesto, unidadMedida: r.unidad_medida,
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      if (edit) await api.put(`/productos/${edit}`, form);
      else await api.post('/productos', form);
      setShowForm(false);
      setMsg(edit ? 'Producto actualizado' : 'Producto registrado');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggleEstado = async (r) => {
    try {
      await api.patch(`/productos/${r.producto_id}/estado`, { estado: r.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="topbar"><h2>Productos</h2><div className="crumb">Catálogo de productos</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nombre o descripción" style={{ width: 300 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo producto</button>
        </div>

        {showForm && (
          <div className="card">
            <h3>{edit ? 'Editar producto' : 'Registrar producto'}</h3>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field"><label>Código *</label>
                  <input value={form.codigo} onChange={upd('codigo')} required disabled={!!edit} /></div>
                <div className="field"><label>Nombre *</label>
                  <input value={form.nombre} onChange={upd('nombre')} required /></div>
                <div className="field"><label>Categoría</label>
                  <input value={form.categoria} onChange={upd('categoria')} /></div>
                <div className="field"><label>Precio *</label>
                  <input type="number" min="0" step="0.01" value={form.precio} onChange={upd('precio')} required /></div>
                <div className="field"><label>Impuesto (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.impuesto} onChange={upd('impuesto')} /></div>
                <div className="field"><label>Unidad de medida</label>
                  <select value={form.unidadMedida} onChange={upd('unidadMedida')}>
                    <option value="UND">Unidad</option><option value="HORA">Hora</option>
                    <option value="KG">Kilogramo</option><option value="M">Metro</option><option value="CAJA">Caja</option>
                  </select></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Descripción</label>
                  <textarea value={form.descripcion} onChange={upd('descripcion')} /></div>
              </div>
              <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay productos" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th className="num">Precio</th><th className="num">Impuesto</th><th>Unidad</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.producto_id}>
                      <td>{r.codigo}</td>
                      <td><b>{r.nombre}</b></td>
                      <td>{r.categoria || '—'}</td>
                      <td className="num"><Money value={r.precio} /></td>
                      <td className="num">{r.impuesto}%</td>
                      <td>{r.unidad_medida}</td>
                      <td><Estado value={r.estado} /></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>
                          <button className={`btn btn-sm ${r.estado === 'ACTIVO' ? 'btn-warn' : 'btn-success'}`} onClick={() => toggleEstado(r)}>
                            {r.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/Pedidos.jsx`

**Archivo:** `frontend/src/pages/Pedidos.jsx` · 72 líneas

````jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Pedidos() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/pedidos', { params: { q, estado } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <div className="topbar"><h2>Pedidos</h2><div className="crumb">Registro de operaciones comerciales</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente o identificación" style={{ width: 320 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="FACTURADO">Facturado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <Link className="btn btn-primary" to="/pedidos/nuevo">+ Nuevo pedido</Link>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay pedidos" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th className="num">Subtotal</th><th className="num">Impuestos</th><th className="num">Total</th><th>Estado</th><th>Factura</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pedido_id}>
                      <td><b>{r.numero_pedido}</b></td>
                      <td><Fecha value={r.fecha} /></td>
                      <td>{r.nombre_razon_social}<br /><small style={{ color: 'var(--muted)' }}>{r.numero_identificacion}</small></td>
                      <td className="num"><Money value={r.subtotal} /></td>
                      <td className="num"><Money value={r.impuestos} /></td>
                      <td className="num"><b><Money value={r.total} /></b></td>
                      <td><Estado value={r.estado} /></td>
                      <td>{r.numero_factura || '—'}</td>
                      <td><Link className="btn btn-ghost btn-sm" to={`/pedidos/${r.pedido_id}`}>Ver</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/PedidoForm.jsx`

**Archivo:** `frontend/src/pages/PedidoForm.jsx` · 125 líneas

````jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, ErrorBox } from '../ui.jsx';

export default function PedidoForm() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lines, setLines] = useState([{ productoId: '', cantidad: 1 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, p] = await Promise.all([
          api.get('/clientes', { params: { estado: 'ACTIVO' } }),
          api.get('/productos', { params: { estado: 'ACTIVO' } }),
        ]);
        setClientes(c);
        setProductos(p);
      } catch (e) { setError(errMsg(e)); }
    })();
  }, []);

  const precioDe = (id) => productos.find((p) => p.producto_id === Number(id));

  const calc = useMemo(() => {
    let subtotal = 0; let imp = 0;
    for (const l of lines) {
      const p = precioDe(l.productoId);
      if (!p) continue;
      const qty = Number(l.cantidad) || 0;
      const st = p.precio * qty;
      subtotal += st;
      imp += st * (Number(p.impuesto) / 100);
    }
    return { subtotal, impuestos: imp, total: subtotal + imp };
  }, [lines, productos]);

  const addLine = () => setLines((ls) => [...ls, { productoId: '', cantidad: 1 }]);
  const rmLine = (i) => setLines((ls) => ls.filter((_, ix) => ix !== i));
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, ix) => (ix === i ? { ...l, [k]: v } : l)));

  const save = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const items = lines.filter((l) => l.productoId && Number(l.cantidad) > 0);
      if (items.length === 0) throw new Error('Debe agregar al menos un producto con cantidad válida');
      const r = await api.post('/pedidos', { clienteId, observaciones, items });
      navigate(`/pedidos/${r.pedido_id}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="topbar"><h2>Nuevo pedido</h2><div className="crumb">Los valores se calculan en el servidor</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        <form onSubmit={save}>
          <div className="card">
            <h3>Datos del pedido</h3>
            <div className="form-grid">
              <div className="field"><label>Cliente *</label>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
                  <option value="">Seleccione un cliente activo…</option>
                  {clientes.map((c) => <option key={c.cliente_id} value={c.cliente_id}>{c.nombre_razon_social} ({c.numero_identificacion})</option>)}
                </select></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Observaciones</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></div>
            </div>
          </div>

          <div className="card">
            <h3>Productos</h3>
            {lines.map((l, i) => (
              <div key={i} className="form-grid" style={{ marginBottom: 12 }}>
                <div className="field"><label>Producto</label>
                  <select value={l.productoId} onChange={(e) => setLine(i, 'productoId', e.target.value)}>
                    <option value="">Seleccione…</option>
                    {productos.map((p) => <option key={p.producto_id} value={p.producto_id}>{p.nombre} — <Money value={p.precio} /></option>)}
                  </select></div>
                <div className="field"><label>Cantidad *</label>
                  <input type="number" min="0.01" step="any" value={l.cantidad} onChange={(e) => setLine(i, 'cantidad', e.target.value)} required /></div>
                <div className="field"><label>Subtotal línea</label>
                  <div style={{ padding: '9px 0', fontWeight: 700 }}>
                    <Money value={precioDe(l.productoId) ? precioDe(l.productoId).precio * (Number(l.cantidad) || 0) : 0} />
                  </div></div>
                {lines.length > 1 && (
                  <div className="field" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => rmLine(i)} style={{ marginTop: 24 }}>Quitar</button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={addLine}>+ Agregar producto</button>
          </div>

          <div className="card">
            <h3>Resumen</h3>
            <table style={{ maxWidth: 420 }}>
              <tbody>
                <tr><td>Subtotal</td><td className="num"><Money value={calc.subtotal} /></td></tr>
                <tr><td>Impuestos</td><td className="num"><Money value={calc.impuestos} /></td></tr>
                <tr><td><b>Total</b></td><td className="num"><b><Money value={calc.total} /></b></td></tr>
              </tbody>
            </table>
            <div className="toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar pedido'}</button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate('/pedidos')}>Cancelar</button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/PedidoDetalle.jsx`

**Archivo:** `frontend/src/pages/PedidoDetalle.jsx` · 100 líneas

````jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading } from '../ui.jsx';

export default function PedidoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      setData(await api.get(`/pedidos/${id}`));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const transition = async (estado) => {
    setError(''); setMsg('');
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado });
      setMsg(`Pedido ${estado}`);
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const facturar = async () => {
    setError(''); setMsg('');
    try {
      const r = await api.post('/facturas', { pedidoId: Number(id) });
      setMsg(`Factura generada: ${r.numero_factura}`);
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  if (error && !data) return <div className="content"><ErrorBox msg={error} /></div>;
  if (!data) return <div className="content"><Loading /></div>;

  const st = data.estado;

  return (
    <>
      <div className="topbar"><h2>{data.numero_pedido}</h2><div className="crumb">Detalle del pedido</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="grid-cards">
          <div className="stat"><div className="label">Estado</div><div className="value" style={{ fontSize: 18 }}><Estado value={st} /></div></div>
          <div className="stat"><div className="label">Cliente</div><div className="value" style={{ fontSize: 18 }}>{data.nombre_razon_social}</div></div>
          <div className="stat"><div className="label">Fecha</div><div className="value" style={{ fontSize: 18 }}><FechaHora value={data.fecha} /></div></div>
          <div className="stat"><div className="label">Total</div><div className="value" style={{ fontSize: 18 }}><Money value={data.total} /></div></div>
        </div>

        <div className="card">
          <h3>Líneas del pedido</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Producto</th><th className="num">Cantidad</th><th className="num">Precio unitario</th><th className="num">Impuesto</th><th className="num">Subtotal</th></tr></thead>
              <tbody>
                {data.lineas.map((l) => (
                  <tr key={l.detalle_id}>
                    <td>{l.codigo}</td>
                    <td>{l.producto_nombre}</td>
                    <td className="num">{l.cantidad}</td>
                    <td className="num"><Money value={l.precio_unitario} decimals /></td>
                    <td className="num">{l.impuesto}%</td>
                    <td className="num"><Money value={l.subtotal} decimals /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <table style={{ maxWidth: 380, marginLeft: 'auto' }}>
            <tbody>
              <tr><td>Subtotal</td><td className="num"><Money value={data.subtotal} /></td></tr>
              <tr><td>Impuestos</td><td className="num"><Money value={data.impuestos} /></td></tr>
              <tr><td><b>Total</b></td><td className="num"><b><Money value={data.total} /></b></td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Acciones</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {st === 'BORRADOR' && <button className="btn btn-success" onClick={() => transition('CONFIRMADO')}>Confirmar pedido</button>}
            {st === 'BORRADOR' && <button className="btn btn-warn" onClick={() => transition('CANCELADO')}>Cancelar pedido</button>}
            {st === 'CONFIRMADO' && <button className="btn btn-primary" onClick={facturar}>Generar factura</button>}
            {st === 'CONFIRMADO' && <button className="btn btn-warn" onClick={() => transition('CANCELADO')}>Cancelar pedido</button>}
            {data.numero_factura && data.factura_id && <Link className="btn btn-ghost" to={`/facturas/${data.factura_id}`}>Ver factura: {data.numero_factura}</Link>}
            <button className="btn btn-ghost" onClick={() => navigate('/pedidos')}>Volver</button>
          </div>
        </div>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/Facturas.jsx`

**Archivo:** `frontend/src/pages/Facturas.jsx` · 91 líneas

````jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../ui.jsx';
import FacturaPreview from '../components/FacturaPreview.jsx';

export default function Facturas() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [estadoPago, setEstadoPago] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [cargandoPrev, setCargandoPrev] = useState(null);

  const load = async () => {
    try {
      const data = await api.get('/facturas', { params: { q, estado, estadoPago } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const abrirPreview = async (f) => {
    setCargandoPrev(f.factura_id);
    try {
      setPreview(await api.get(`/facturas/${f.factura_id}`));
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setCargandoPrev(null); }
  };

  return (
    <>
      <div className="topbar"><h2>Facturas</h2><div className="crumb">Consulta y anulación</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente o identificación" style={{ width: 280 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Estado factura</option>
              <option value="ACTIVA">Activa</option>
              <option value="ANULADA">Anulada</option>
            </select>
            <select value={estadoPago} onChange={(e) => { setEstadoPago(e.target.value); }}>
              <option value="">Estado de pago</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGO_PARCIAL">Pago parcial</option>
              <option value="PAGADA">Pagada</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <Link className="btn btn-primary" to="/pedidos">Facturar pedido</Link>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay facturas" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th><th>Estado</th><th>Pago</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.factura_id}>
                      <td><b>{r.numero_factura}</b></td>
                      <td><Fecha value={r.fecha_emision} /></td>
                      <td>{r.nombre_razon_social}</td>
                      <td className="num"><Money value={r.total} /></td>
                      <td className="num"><Money value={r.valor_pagado} /></td>
                      <td className="num"><b><Money value={r.saldo} /></b></td>
                      <td><Estado value={r.estado} /></td>
                      <td><Estado value={r.estado_pago} /></td>
                      <td><Link className="btn btn-ghost btn-sm" to={`/facturas/${r.factura_id}`}>Ver</Link></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => abrirPreview(r)} disabled={cargandoPrev === r.factura_id}>
                        {cargandoPrev === r.factura_id ? '…' : '👁 Vista previa'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {preview && <FacturaPreview data={preview} onCerrar={() => setPreview(null)} />}
    </>
  );
}
````

### Archivo `frontend/src/pages/FacturaDetalle.jsx`

**Archivo:** `frontend/src/pages/FacturaDetalle.jsx` · 296 líneas

````jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, Fecha, FechaHora, ErrorBox, Loading } from '../ui.jsx';
import FacturaPreview from '../components/FacturaPreview.jsx';

const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE'];

export default function FacturaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  // Pago
  const [pago, setPago] = useState({ valor: '', metodoPago: 'EFECTIVO', referencia: '', observaciones: '' });
  // Datos de pago en línea (tarjeta/transferencia/cheque) — se limpian al cambiar de método
  const EMPTY_CARD = { numeroTarjeta: '', codigoSeguridad: '', vencimientoTarjeta: '', banco: '', titularTarjeta: '' };
  const [card, setCard] = useState(EMPTY_CARD);
  const [transfer, setTransfer] = useState({ numeroCuenta: '' });
  const setCardF = (k) => (e) => setCard((f) => ({ ...f, [k]: e.target.value }));
  const setTransferF = (k) => (e) => setTransfer((f) => ({ ...f, [k]: e.target.value }));
  // Anulación
  const [motivo, setMotivo] = useState('');
  const [confirmAnular, setConfirmAnular] = useState(false);
  // Vista previa
  const [showPreview, setShowPreview] = useState(false);
  // Nota de crédito
  const [showNota, setShowNota] = useState(false);
  const [nota, setNota] = useState({ valor: '', motivo: '' });
  const [notaMsg, setNotaMsg] = useState('');
  const [creandoNota, setCreandoNota] = useState(false);

  const load = async () => {
    try {
      setData(await api.get(`/facturas/${id}`));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const registrarPago = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      const body = { facturaId: Number(id), ...pago, valor: Number(pago.valor) };
      if (pago.metodoPago === 'TARJETA') {
        body.numeroTarjeta = card.numeroTarjeta;
        body.codigoSeguridad = card.codigoSeguridad;
        body.vencimientoTarjeta = card.vencimientoTarjeta;
        body.banco = card.banco;
        body.titularTarjeta = card.titularTarjeta;
      } else if (pago.metodoPago === 'TRANSFERENCIA' || pago.metodoPago === 'CHEQUE') {
        body.banco = card.banco;
      }
      if (pago.metodoPago === 'TRANSFERENCIA') body.numeroCuenta = transfer.numeroCuenta;
      const r = await api.post('/pagos', body);
      setMsg(`Pago ${r.numero_pago} registrado · saldo ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(r.saldo)}`);
      setPago({ valor: '', metodoPago: 'EFECTIVO', referencia: '', observaciones: '' });
      setCard(EMPTY_CARD);
      setTransfer({ numeroCuenta: '' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const anular = async () => {
    setError(''); setMsg('');
    try {
      await api.post(`/facturas/${id}/anular`, { motivo });
      setMsg('Factura anulada (se conserva para historial y auditoría)');
      setConfirmAnular(false); setMotivo('');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const registrarNota = async (e) => {
    e.preventDefault();
    setError(''); setNotaMsg(''); setCreandoNota(true);
    try {
      const r = await api.post('/notas-credito', { facturaId: Number(id), valor: Number(nota.valor), motivo: nota.motivo });
      setNotaMsg(`Nota ${r.numero_nota} creada por ${cpu(r.valor)}`);
      setShowNota(false); setNota({ valor: '', motivo: '' });
      await load();
    } catch (err) { setError(errMsg(err)); } finally { setCreandoNota(false); }
  };

  const cpu = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(v || 0));

  if (error && !data) return <div className="content"><ErrorBox msg={error} /></div>;
  if (!data) return <div className="content"><Loading /></div>;

  const puedePagar = data.estado === 'ACTIVA' && Number(data.saldo) > 0;
  const puedeAnular = data.estado === 'ACTIVA';
  const notasActivas = (data.notas_credito || []).filter((n) => n.estado === 'ACTIVA');
  const devolvible = Math.max(0, Number(data.valor_pagado) - notasActivas.reduce((s, n) => s + Number(n.valor), 0));
  const puedeNota = data.estado === 'ACTIVA' && devolvible > 0;

  return (
    <>
      <div className="topbar"><h2>{data.numero_factura}</h2><div className="crumb">Detalle de factura</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="balance-hero">
          <div className="lbl">Total de la factura</div>
          <div className="big">{cpu(data.total)}</div>
          <div className="balance-chips">
            <div className="chip"><b>{cpu(data.valor_pagado)}</b><span>Pagado</span></div>
            <div className="chip"><b>{cpu(data.saldo)}</b><span>Saldo pendiente</span></div>
            <div className="chip"><b><Estado value={data.estado} /></b><span>Estado factura</span></div>
            <div className="chip"><b><Estado value={data.estado_pago} /></b><span>Estado de pago</span></div>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: -6 }}>
          <button className="btn btn-primary" onClick={() => setShowPreview(true)}>👁 Vista previa · Imprimir</button>
          {data.correo && (
            <a className="btn btn-ghost" style={{ textDecoration: 'none' }}
              href={`mailto:${data.correo}?subject=${encodeURIComponent(`Factura ${data.numero_factura} · FINAN-X`)}&body=${encodeURIComponent(`Estimado(a) ${data.nombre_razon_social}:\n\nAdjuntamos su factura ${data.numero_factura} por ${cpu(data.total)}. Saldo pendiente: ${cpu(data.saldo)}.\n\nDescargue el detalle en el portal FINAN-X.\n\nAtentamente,\nFINAN-X`)}`}>
              ✉ Enviar por correo
            </a>
          )}
          <div className="spacer" />
        </div>

        <div className="card">
          <h3>Información</h3>
          <div className="form-grid">
            <div className="field"><label>Cliente</label><div style={{ padding: '8px 0' }}>{data.nombre_razon_social} · {data.numero_identificacion}</div></div>
            <div className="field"><label>Pedido asociado</label><div style={{ padding: '8px 0' }}>{data.numero_pedido}</div></div>
            <div className="field"><label>Emisión</label><div style={{ padding: '8px 0' }}><FechaHora value={data.fecha_emision} /></div></div>
            <div className="field"><label>Vencimiento</label><div style={{ padding: '8px 0' }}><Fecha value={data.fecha_vencimiento} /></div></div>
          </div>
        </div>

        <div className="card">
          <h3>Líneas</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Producto</th><th className="num">Cantidad</th><th className="num">Precio unitario</th><th className="num">Impuesto</th><th className="num">Subtotal</th></tr></thead>
              <tbody>
                {data.lineas.map((l, i) => (
                  <tr key={i}>
                    <td>{l.codigo}</td><td>{l.producto_nombre}</td>
                    <td className="num">{l.cantidad}</td>
                    <td className="num"><Money value={l.precio_unitario} /></td>
                    <td className="num">{l.impuesto}%</td>
                    <td className="num"><Money value={l.subtotal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <table style={{ maxWidth: 380, marginLeft: 'auto' }}>
            <tbody>
              <tr><td>Subtotal</td><td className="num">{cpu(data.subtotal)}</td></tr>
              <tr><td>Impuestos</td><td className="num">{cpu(data.impuestos)}</td></tr>
              <tr><td><b>Total</b></td><td className="num"><b>{cpu(data.total)}</b></td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Pagos registrados</h3>
          {data.pagos.length === 0 ? <div className="empty">Sin pagos — factura pendiente</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Pago</th><th>Fecha</th><th className="num">Valor</th><th>Método</th><th>Referencia</th><th>Observaciones</th></tr></thead>
                <tbody>
                  {data.pagos.map((p) => (
                    <tr key={p.pago_id}>
                      <td>{p.numero_pago}</td><td><FechaHora value={p.fecha} /></td>
                      <td className="num"><Money value={p.valor} /></td>
                      <td>{p.metodo_pago}</td><td>{p.referencia || '—'}</td><td>{p.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Notas de crédito {notasActivas.length > 0 && <span style={{ opacity: 0.6, fontSize: 13 }}>({notasActivas.length} activas · {cpu(devolvible)} devolvible)</span>}</h3>
          {notaMsg && <div className="alert alert-success">{notaMsg}</div>}
          {(data.notas_credito || []).length === 0 ? <div className="empty">Sin notas de crédito en esta factura</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nota</th><th>Fecha</th><th className="num">Valor</th><th>Motivo</th><th>Estado</th></tr></thead>
                <tbody>
                  {(data.notas_credito || []).map((n) => (
                    <tr key={n.nota_credito_id}>
                      <td><b>{n.numero_nota}</b></td>
                      <td><FechaHora value={n.fecha} /></td>
                      <td className="num"><Money value={n.valor} /></td>
                      <td style={{ maxWidth: 260 }}>{n.motivo}</td>
                      <td><Estado value={n.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {puedeNota && !showNota && (
            <button className="btn btn-warn" style={{ marginTop: 12 }} onClick={() => setShowNota(true)}>↩ Registrar devolución (nota de crédito)</button>
          )}
          {puedeNota && showNota && (
            <form onSubmit={registrarNota} className="form-grid" style={{ marginTop: 12 }}>
              <div className="field"><label>Valor a devolver * (máx. {cpu(devolvible)})</label>
                <input type="number" min="0.01" step="any" max={devolvible} value={nota.valor} onChange={(e) => setNota({ ...nota, valor: e.target.value })} required /></div>
              <div className="field"><label>Motivo de la devolución *</label>
                <input value={nota.motivo} onChange={(e) => setNota({ ...nota, motivo: e.target.value })} placeholder="Ej.: devolución de mercancía" required /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <button className="btn btn-success" type="submit" disabled={creandoNota || !(Number(nota.valor) > 0) || Number(nota.valor) > devolvible}>
                  {creandoNota ? 'Procesando…' : 'Registrar nota'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowNota(false)}>Cancelar</button>
              </div>
            </form>
          )}
        </div>

        {puedePagar && (
          <div className="card">
            <h3>Registrar pago</h3>
            <form onSubmit={registrarPago} className="form-grid">
              <div className="field"><label>Valor *</label>
                <input type="number" min="0.01" step="any" value={pago.valor} onChange={(e) => setPago({ ...pago, valor: e.target.value })} placeholder={String(data.saldo)} required /></div>
              <div className="field"><label>Método de pago</label>
                <select value={pago.metodoPago} onChange={(e) => { setPago({ ...pago, metodoPago: e.target.value }); setCard(EMPTY_CARD); setTransfer({ numeroCuenta: '' }); }}>
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select></div>
              {pago.metodoPago === 'TARJETA' && (
                <>
                  <div className="field"><label>Número de tarjeta *</label>
                    <input inputMode="numeric" maxLength={19} value={card.numeroTarjeta} onChange={setCardF('numeroTarjeta')} placeholder="4111 1111 1111 1111" required /></div>
                  <div className="field"><label>CVV *</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={card.codigoSeguridad} onChange={setCardF('codigoSeguridad')} placeholder="123" required /></div>
                  <div className="field"><label>Vencimiento (MM/AA) *</label>
                    <input inputMode="numeric" maxLength={5} value={card.vencimientoTarjeta} onChange={setCardF('vencimientoTarjeta')} placeholder="12/30" required /></div>
                  <div className="field"><label>Banco emisor *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Bancolombia" required /></div>
                  <div className="field"><label>Titular de la tarjeta *</label>
                    <input value={card.titularTarjeta} onChange={setCardF('titularTarjeta')} placeholder="Nombre en la tarjeta" required /></div>
                </>
              )}
              {pago.metodoPago === 'TRANSFERENCIA' && (
                <>
                  <div className="field"><label>Banco destino *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Davivienda" required /></div>
                  <div className="field"><label>N.º de cuenta *</label>
                    <input inputMode="numeric" value={transfer.numeroCuenta} onChange={setTransferF('numeroCuenta')} placeholder="4 a 20 dígitos" required /></div>
                </>
              )}
              {pago.metodoPago === 'CHEQUE' && (
                <div className="field"><label>Banco del cheque *</label>
                  <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Banco Popular" required /></div>
              )}
              <div className="field"><label>Referencia{pago.metodoPago === 'TRANSFERENCIA' || pago.metodoPago === 'CHEQUE' ? ' *' : ''}</label>
                <input value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} required={pago.metodoPago === 'TRANSFERENCIA' || pago.metodoPago === 'CHEQUE'} placeholder={pago.metodoPago === 'TRANSFERENCIA' ? 'N.º de comprobante' : pago.metodoPago === 'CHEQUE' ? 'N.º de cheque' : ''} /></div>
              <div className="field"><label>Observaciones</label>
                <input value={pago.observaciones} onChange={(e) => setPago({ ...pago, observaciones: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-success" type="submit">Registrar pago</button>
              </div>
              <div className="field"><label>Saldo disponible</label>
                <div style={{ padding: '9px 0', fontWeight: 800, color: Number(data.saldo) > 0 ? 'var(--warning)' : 'var(--success)' }}>{cpu(data.saldo)}</div></div>
            </form>
          </div>
        )}

        {puedeAnular && (
          <div className="card">
            <h3>Anulación</h3>
            {!confirmAnular ? (
              <button className="btn btn-danger" onClick={() => setConfirmAnular(true)}>Anular factura</button>
            ) : (
              <div className="form-grid" style={{ alignItems: 'end' }}>
                <div className="field"><label>Motivo de anulación *</label>
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: error en el pedido" /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-danger" onClick={anular} disabled={!motivo.trim()}>Confirmar anulación</button>
                  <button className="btn btn-ghost" onClick={() => setConfirmAnular(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-ghost" onClick={() => navigate('/facturas')}>Volver</button>
      </div>
      {showPreview && <FacturaPreview data={data} onCerrar={() => setShowPreview(false)} />}
    </>
  );
}
````

### Archivo `frontend/src/pages/Pagos.jsx`

**Archivo:** `frontend/src/pages/Pagos.jsx` · 68 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, FechaHora, DatosPago, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Pagos() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/pagos', { params: { q, desde, hasta } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const total = (rows || []).reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <>
      <div className="topbar"><h2>Pagos</h2><div className="crumb">Consulta de pagos realizados</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por pago, factura o referencia" style={{ width: 260 }} />
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <button className="btn btn-ghost" type="submit">Filtrar</button>
          </form>
          <div className="spacer" />
          <div className="stat" style={{ padding: '8px 16px' }}><span className="label">Total en la vista: </span><b><Money value={total} /></b></div>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay pagos" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Pago</th><th>Fecha</th><th>Factura</th><th>Cliente</th><th className="num">Valor</th><th>Método</th><th>Referencia</th><th>Observaciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pago_id}>
                      <td><b>{r.numero_pago}</b></td>
                      <td><FechaHora value={r.fecha} /></td>
                      <td>{r.numero_factura}</td>
                      <td>{r.nombre_razon_social}</td>
                      <td className="num"><b><Money value={r.valor} /></b></td>
                      <td>{r.metodo_pago}<div style={{ fontSize: 12, color: 'var(--muted)' }}><DatosPago p={r} /></div></td>
                      <td>{r.referencia || '—'}</td>
                      <td>{r.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/NotasCredito.jsx`

**Archivo:** `frontend/src/pages/NotasCredito.jsx` · 201 líneas

````jsx
import { useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

const CPU = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(v || 0));

export default function NotasCredito() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Crear
  const [showCrear, setShowCrear] = useState(false);
  const [facturas, setFacturas] = useState(null);
  const [form, setForm] = useState({ facturaId: '', valor: '', motivo: '' });
  const [creando, setCreando] = useState(false);

  // Anular
  const [anularNota, setAnularNota] = useState(null);
  const [motivoAnul, setMotivoAnul] = useState('');

  const load = async () => {
    try {
      setRows(await api.get('/notas-credito', { params: { q, estado } }));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const abrirCrear = async () => {
    setError(''); setMsg(''); setForm({ facturaId: '', valor: '', motivo: '' });
    try {
      const fs = await api.get('/facturas', { params: { estado: 'ACTIVA' } });
      // Solo facturas con algo pagado disponible para devolver
      setFacturas(fs.filter((f) => Number(f.valor_pagado) - Number(f.notas_credito || 0) > 0));
      setShowCrear(true);
    } catch (e) { setError(errMsg(e)); }
  };

  const facturaSel = useMemo(
    () => facturas?.find((f) => String(f.factura_id) === String(form.facturaId)),
    [facturas, form.facturaId]
  );
  const disponible = facturaSel ? Math.max(0, Number(facturaSel.valor_pagado) - Number(facturaSel.notas_credito || 0)) : 0;

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setCreando(true);
    try {
      const r = await api.post('/notas-credito', { facturaId: Number(form.facturaId), valor: Number(form.valor), motivo: form.motivo });
      setMsg(`Nota ${r.numero_nota} creada por ${CPU(r.valor)} · disponible para devolver ${CPU(r.saldo_restante_devolver)}`);
      setShowCrear(false);
      await load();
    } catch (err) { setError(errMsg(err)); } finally { setCreando(false); }
  };

  const anular = async () => {
    setError(''); setMsg('');
    try {
      await api.post(`/notas-credito/${anularNota.nota_credito_id}/anular`, { motivo: motivoAnul });
      setMsg(`Nota ${anularNota.numero_nota} anulada (queda en historial para auditoría)`);
      setAnularNota(null); setMotivoAnul('');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <div className="topbar"><h2>Notas de crédito</h2><div className="crumb">Devoluciones sobre facturas</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nota, factura o cliente" style={{ width: 260 }} />
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Estado</option>
              <option value="ACTIVA">Activa</option>
              <option value="ANULADA">Anulada</option>
            </select>
            <button className="btn" type="submit">Filtrar</button>
          </form>
          <div className="spacer" />
          <button className="btn btn-success" onClick={abrirCrear}>+ Nueva nota de crédito</button>
        </div>

        <div className="card">
          <h3>Notas de crédito</h3>
          {!rows ? <Loading /> : rows.length === 0 ? <Empty text="Sin notas de crédito" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nota</th><th>Factura</th><th>Cliente</th><th>Fecha</th><th className="num">Valor</th><th>Motivo</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((n) => (
                    <tr key={n.nota_credito_id}>
                      <td><b>{n.numero_nota}</b></td>
                      <td>{n.numero_factura}</td>
                      <td>{n.nombre_razon_social} · {n.numero_identificacion}</td>
                      <td><FechaHora value={n.fecha} /></td>
                      <td className="num"><Money value={n.valor} /></td>
                      <td style={{ maxWidth: 220 }}>{n.motivo}</td>
                      <td><Estado value={n.estado} /></td>
                      <td>
                        {n.estado === 'ACTIVA' && (
                          <button className="btn btn-sm btn-danger" onClick={() => { setAnularNota(n); setMotivoAnul(''); }}>Anular</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCrear && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCrear(false); }}>
          <div className="modal">
            <div className="modal-head">
              <h3>Nueva nota de crédito (devolución)</h3>
              <button className="btn-close" onClick={() => setShowCrear(false)}>×</button>
            </div>
            <div className="modal-body">
              {!facturas ? <Loading /> : facturas.length === 0 ? (
                <div className="empty">No hay facturas activas con pagos que devolver.</div>
              ) : (
                <form onSubmit={crear}>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="field">
                      <label>Factura a devolver *</label>
                      <select value={form.facturaId} onChange={(e) => setForm({ ...form, facturaId: e.target.value })} required>
                        <option value="">Seleccione…</option>
                        {facturas.map((f) => (
                          <option key={f.factura_id} value={f.factura_id}>
                            {f.numero_factura} · {f.nombre_razon_social} · total {CPU(f.total)} · pagado {CPU(f.valor_pagado)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {facturaSel && (
                      <div className="field">
                        <label>Disponible para devolver</label>
                        <div style={{ padding: '9px 0', fontWeight: 800, color: disponible > 0 ? 'var(--success)' : 'var(--danger)' }}>{CPU(disponible)}</div>
                      </div>
                    )}
                    <div className="field">
                      <label>Valor a devolver *</label>
                      <input type="number" min="0.01" step="any" max={disponible || undefined}
                        value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label>Motivo de la devolución *</label>
                      <textarea rows={3} value={form.motivo}
                        onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                        placeholder="Ej.: mercancía devuelta en mal estado, cambio de producto…" required />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button className="btn btn-ghost" type="button" onClick={() => setShowCrear(false)}>Cancelar</button>
                    <button className="btn btn-success" type="submit" disabled={creando || Number(form.valor) > disponible || !(Number(form.valor) > 0)}>
                      {creando ? 'Creando…' : 'Registrar nota de crédito'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {anularNota && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setAnularNota(null); }}>
          <div className="modal">
            <div className="modal-head">
              <h3>Anular {anularNota.numero_nota}</h3>
              <button className="btn-close" onClick={() => setAnularNota(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ opacity: 0.8, marginBottom: 12 }}>
                Se anulará la nota de crédito de <b>{CPU(anularNota.valor)}</b> ({anularNota.numero_factura}).
                Quedará conservada en el historial y la auditoría; el valor vuelve a quedar disponible en la factura.
              </p>
              <div className="field"><label>Motivo de anulación *</label>
                <input value={motivoAnul} onChange={(e) => setMotivoAnul(e.target.value)} placeholder="Ej.: error en el registro de la devolución" /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setAnularNota(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={anular} disabled={!motivoAnul.trim()}>Confirmar anulación</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
````

### Archivo `frontend/src/pages/Reportes.jsx`

**Archivo:** `frontend/src/pages/Reportes.jsx` · 123 líneas

````jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, FechaHora, Estado, ErrorBox, Section, Loading } from '../ui.jsx';

export default function Reportes() {
  const nav = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [range, setRange] = useState({ desde: '', hasta: '' });
  const [reporte, setReporte] = useState(null);
  const [clienteId, setClienteId] = useState('');
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reportes/resumen').then(setResumen).catch((e) => setError(errMsg(e)));
  }, []);

  const genReporte = async (e) => {
    e.preventDefault();
    try {
      setReporte(await api.get('/reportes/facturacion', { params: range }));
      setError('');
    } catch (err) { setError(errMsg(err)); }
  };

  const generarHistorial = async (e) => {
    e.preventDefault();
    try {
      setHistorial(await api.get(`/reportes/historial/${clienteId}`));
      setError('');
    } catch (err) { setError(errMsg(err)); }
  };

  if (!resumen) return <div className="content"><Loading /></div>;

  return (
    <>
      <div className="topbar"><h2>Reportes</h2><div className="crumb">Facturación e historial financiero</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="grid-cards">
          <div className="stat"><div className="label">Pagos recibidos (general)</div><div className="value green"><Money value={resumen.pagos_recibidos} /></div></div>
          <div className="stat"><div className="label">Cuentas por cobrar</div><div className="value red"><Money value={resumen.saldo_pendiente_total} /></div></div>
          <div className="stat"><div className="label">Facturas activas</div><div className="value">{resumen.facturas_activas}</div></div>
          <div className="stat"><div className="label">Pedidos por facturar</div><div className="value warn">{resumen.pedidos_por_facturar}</div></div>
        </div>

        <Section title="Reporte de facturación por rango de fechas">
          <form onSubmit={genReporte} className="form-grid" style={{ maxWidth: 560 }}>
            <div className="field"><label>Desde</label>
              <input type="date" value={range.desde} onChange={(e) => setRange({ ...range, desde: e.target.value })} /></div>
            <div className="field"><label>Hasta</label>
              <input type="date" value={range.hasta} onChange={(e) => setRange({ ...range, hasta: e.target.value })} /></div>
            <div style={{ display: 'flex', alignItems: 'end' }}><button className="btn btn-primary" type="submit">Generar</button></div>
          </form>
          {reporte && (
            <div className="grid-cards" style={{ marginTop: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))' }}>
              <div className="stat"><div className="label">Facturas</div><div className="value">{reporte.total_facturas}</div></div>
              <div className="stat"><div className="label">Activas</div><div className="value">{reporte.activas}</div></div>
              <div className="stat"><div className="label">Total facturado</div><div className="value"><Money value={reporte.total_facturado} /></div></div>
              <div className="stat"><div className="label">Pagos recibidos</div><div className="value green"><Money value={reporte.total_pagado} /></div></div>
              <div className="stat"><div className="label">Saldo pendiente</div><div className="value red"><Money value={reporte.saldo_pendiente} /></div></div>
              <div className="stat"><div className="label">Por método</div>
                <div className="value" style={{ fontSize: 13 }}>EFE {reporte.efectivo} · TRA {reporte.transferencia} · TAR {reporte.tarjeta}</div></div>
            </div>
          )}
        </Section>

        <Section title="Historial financiero de un cliente">
          <form onSubmit={generarHistorial} className="form-grid" style={{ maxWidth: 560 }}>
            <div className="field"><label>ID de cliente</label>
              <input type="number" min="1" value={clienteId} onChange={(e) => setClienteId(e.target.value)} placeholder="Ej.: 1" /></div>
            <div style={{ display: 'flex', alignItems: 'end' }}><button className="btn btn-primary" type="submit">Consultar</button></div>
          </form>
          {historial && (
            <>
              <p><b>{historial.cliente.nombre_razon_social}</b> · {historial.cliente.numero_identificacion} · {historial.cliente.ciudad} · <Estado value={historial.cliente.estado} /></p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <h4 style={{ margin: '8px 0' }}>Facturas ({historial.facturas.length})</h4>
                  <table>
                    <thead><tr><th>Número</th><th>Fecha</th><th className="num">Total</th><th>Estado</th><th>Pago</th></tr></thead>
                    <tbody>
                      {historial.facturas.map((f) => (
                        <tr key={f.factura_id}>
                          <td><b>{f.numero_factura}</b></td>
                          <td><FechaHora value={f.fecha_emision} /></td>
                          <td className="num"><Money value={f.total} /></td>
                          <td><Estado value={f.estado} /></td>
                          <td><Estado value={f.estado_pago} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 style={{ margin: '8px 0' }}>Pagos ({historial.pagos.length})</h4>
                  <table>
                    <thead><tr><th>Pago</th><th>Fecha</th><th>Factura</th><th className="num">Valor</th><th>Método</th></tr></thead>
                    <tbody>
                      {historial.pagos.map((p) => (
                        <tr key={p.pago_id}>
                          <td>{p.numero_pago}</td>
                          <td><FechaHora value={p.fecha} /></td>
                          <td>{p.numero_factura}</td>
                          <td className="num"><Money value={p.valor} /></td>
                          <td>{p.metodo_pago}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => nav(`/clientes`)}>Ir a clientes</button>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/BalanceClientes.jsx`

**Archivo:** `frontend/src/pages/BalanceClientes.jsx` · 157 líneas

````jsx
import { useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function BalanceClientes() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [historial, setHistorial] = useState(null);
  const [histCliente, setHistCliente] = useState(null);
  const [enviando, setEnviando] = useState(null);

  const load = async () => {
    try {
      setData(await api.get('/reportes/balance-clientes'));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const rows = useMemo(() => {
    if (!data?.clientes) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data.clientes;
    return data.clientes.filter((c) =>
      `${c.nombre_razon_social} ${c.numero_identificacion} ${c.correo || ''} ${c.ciudad || ''}`.toLowerCase().includes(t)
    );
  }, [data, q]);

  const verHistorial = async (c) => {
    setError('');
    try {
      setHistCliente(c);
      setHistorial(await api.get(`/reportes/historial/${c.cliente_id}`));
    } catch (e) { setError(errMsg(e)); }
  };

  const enviarEstado = async (c) => {
    setError(''); setMsg(''); setEnviando(c.cliente_id);
    try {
      const r = await api.get(`/clientes/${c.cliente_id}/resumen-correo`);
      if (!r.destinatario) { setError('El cliente no tiene correo registrado'); return; }
      const url = `mailto:${r.destinatario}?subject=${encodeURIComponent(r.asunto)}&body=${encodeURIComponent(r.cuerpo)}`;
      window.location.href = url;
      setMsg(`Se abrió su programa de correo para enviar el estado financiero de ${c.nombre_razon_social} a ${r.destinatario}`);
    } catch (e) { setError(errMsg(e)); } finally { setEnviando(null); }
  };

  if (!data) return <div className="content"><Loading /></div>;
  const R = data.resumen || {};

  return (
    <>
      <div className="topbar"><h2>Balance por cliente</h2><div className="crumb">Dashboard de saldos y cuentas por cobrar</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="grid-cards">
          <div className="stat"><div className="label">Clientes con saldo pendiente</div><div className="value warn">{R.clientes_con_saldo}</div></div>
          <div className="stat"><div className="label">Cuentas por cobrar totales</div><div className="value red"><Money value={R.saldo_total} /></div></div>
          <div className="stat"><div className="label">Total facturado</div><div className="value"><Money value={R.facturado_total} /></div></div>
          <div className="stat"><div className="label">Total pagado</div><div className="value green"><Money value={R.pagado_total} /></div></div>
        </div>

        <div className="toolbar">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nombre, documento, correo o ciudad" style={{ width: 320 }} />
          <div className="spacer" />
          <button className="btn btn-ghost" onClick={load}>⟳ Actualizar</button>
        </div>

        <div className="card">
          <h3>Clientes · balances ({rows.length})</h3>
          {rows.length === 0 ? <Empty text="Sin clientes" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Cliente</th><th>Identificación</th><th>Ciudad</th><th className="num">Facturas activas</th><th className="num">Facturado</th><th className="num">Pagado</th><th className="num">Saldo pendiente</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.cliente_id}>
                      <td><b>{c.nombre_razon_social}</b><div style={{ fontSize: 12, opacity: 0.7 }}>{c.correo || 'sin correo'}</div></td>
                      <td>{c.numero_identificacion}</td>
                      <td>{c.ciudad || '—'}</td>
                      <td className="num">{c.facturas_activas}</td>
                      <td className="num"><Money value={c.total_facturado} /></td>
                      <td className="num"><Money value={c.total_pagado} /></td>
                      <td className="num" style={{ fontWeight: 800, color: Number(c.saldo_pendiente) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                        <Money value={c.saldo_pendiente} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => verHistorial(c)}>Historial</button>
                          <button className="btn btn-sm btn-primary" onClick={() => enviarEstado(c)} disabled={enviando === c.cliente_id}>
                            {enviando === c.cliente_id ? '…' : '✉ Enviar estado'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {historial && histCliente && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Historial · {histCliente.nombre_razon_social}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setHistorial(null); setHistCliente(null); }}>Cerrar historial</button>
            </div>
            <p style={{ opacity: 0.8 }}>{histCliente.numero_identificacion} · {histCliente.ciudad || '—'} · <Estado value={histCliente.estado} /></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <h4 style={{ margin: '8px 0' }}>Facturas ({historial.facturas.length})</h4>
                <table>
                  <thead><tr><th>Número</th><th>Fecha</th><th className="num">Total</th><th>Estado</th><th>Pago</th></tr></thead>
                  <tbody>
                    {historial.facturas.map((f) => (
                      <tr key={f.factura_id}>
                        <td><b>{f.numero_factura}</b></td>
                        <td><FechaHora value={f.fecha_emision} /></td>
                        <td className="num"><Money value={f.total} /></td>
                        <td><Estado value={f.estado} /></td>
                        <td><Estado value={f.estado_pago} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ margin: '8px 0' }}>Pagos ({historial.pagos.length})</h4>
                <table>
                  <thead><tr><th>Pago</th><th>Fecha</th><th>Factura</th><th className="num">Valor</th><th>Método</th></tr></thead>
                  <tbody>
                    {historial.pagos.map((p) => (
                      <tr key={p.pago_id}>
                        <td>{p.numero_pago}</td>
                        <td><FechaHora value={p.fecha} /></td>
                        <td>{p.numero_factura}</td>
                        <td className="num"><Money value={p.valor} /></td>
                        <td>{p.metodo_pago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/Usuarios.jsx`

**Archivo:** `frontend/src/pages/Usuarios.jsx` · 100 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Estado, ErrorBox, Loading, FechaHora, Empty } from '../ui.jsx';

const EMPTY = { nombre: '', correo: '', rol: 'FACTURADOR', password: '' };

export default function Usuarios() {
  const [roles, setRoles] = useState([]);
  const [rows, setRows] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const [u, r] = await Promise.all([api.get('/usuarios'), api.get('/usuarios/roles')]);
      setRows(u); setRoles(r);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.post('/usuarios', form);
      setShowForm(false); setForm(EMPTY);
      setMsg('Usuario creado');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggle = async (u) => {
    try {
      await api.patch(`/usuarios/${u.usuario_id}`, { estado: u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <div className="topbar"><h2>Usuarios internos</h2><div className="crumb">Solo administrador</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <div className="spacer" />
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Nuevo usuario</button>
        </div>

        {showForm && (
          <div className="card">
            <h3>Crear usuario interno</h3>
            <form onSubmit={crear} className="form-grid">
              <div className="field"><label>Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
              <div className="field"><label>Correo *</label>
                <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} required /></div>
              <div className="field"><label>Rol *</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {roles.map((r) => <option key={r.rol_id} value={r.nombre}>{r.nombre}</option>)}
                </select></div>
              <div className="field"><label>Contraseña *</label>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.usuario_id}>
                      <td><b>{u.nombre}</b></td>
                      <td>{u.correo}</td>
                      <td><Estado value={u.rol === 'ADMIN' ? 'CONFIRMADO' : u.rol === 'SUPERVISOR' ? 'FACTURADO' : u.rol === 'CAJERO' ? 'PAGO_PARCIAL' : 'ACTIVO'} /> {u.rol}</td>
                      <td><Estado value={u.estado} /></td>
                      <td><FechaHora value={u.fecha_creacion} /></td>
                      <td><button className={`btn btn-sm ${u.estado === 'ACTIVO' ? 'btn-warn' : 'btn-success'}`} onClick={() => toggle(u)}>{u.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/Auditoria.jsx`

**Archivo:** `frontend/src/pages/Auditoria.jsx` · 60 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Auditoria() {
  const [rows, setRows] = useState(null);
  const [filtros, setFiltros] = useState({ modulo: '', usuario: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/auditoria', { params: { ...filtros, limit: 200 } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <div className="topbar"><h2>Auditoría</h2><div className="crumb">Trazabilidad de operaciones</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={filtros.modulo} onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value })} placeholder="Módulo (Clientes, Pagos…)" />
            <input value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} placeholder="Usuario" />
            <button className="btn btn-ghost" type="submit">Filtrar</button>
          </form>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Fecha/hora</th><th>Usuario</th><th>Tipo</th><th>Módulo</th><th>Operación</th><th>Registro</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.auditoria_id}>
                      <td><FechaHora value={a.fecha_hora} /></td>
                      <td>{a.usuario || '—'}</td>
                      <td>{a.usuario_tipo}</td>
                      <td>{a.modulo}</td>
                      <td><b>{a.operacion}</b></td>
                      <td>{a.registro_afectado || '—'}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 260 }}>{a.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
````

## 3.13 Las páginas del portal del cliente

El portal vive en `pages/portal/`. Todas llaman a los endpoints **`/mis-*`** (por eso el backend los agrupa en `routes/mis.js`), que garantizan que solo veas **tus** datos:

- **`MiSaldo.jsx`** — la pantalla de entrada (`/portal`): hero con "Mi saldo pendiente", chips (total activo, pagado, pendientes, pagadas) y la tabla de facturas pendientes con el botón **"Pagar / Abonar"** que abre el `PagarModal`.
- **`MisDatos.jsx`** — tu información de cliente (solo lectura, sale de tu sesión).
- **`MisCompras.jsx`** — tus pedidos y su estado (y si ya tienen factura).
- **`MisFacturas.jsx`** — tus facturas con saldos y el mismo botón de pago.
- **`MisPagos.jsx`** — tus pagos con el detalle del método (tarjeta enmascarada, etc.).
- **`MisNotasCredito.jsx`** — las devoluciones hechas a tu favor.
- **`MiHistorial.jsx`** — todo junto: facturas + pagos.

### Archivo `frontend/src/pages/portal/MiSaldo.jsx`

**Archivo:** `frontend/src/pages/portal/MiSaldo.jsx` · 69 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../../ui.jsx';
import PagarModal from './PagarModal.jsx';

export default function MiSaldo() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pagar, setPagar] = useState(null); // { facturaId, numero, saldo }

  const cargar = () => api.get('/mi-saldo').then(setData).catch((e) => setError(errMsg(e)));
  useEffect(() => { cargar(); }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="balance-hero">
        <div className="lbl">Mi saldo pendiente</div>
        <div className="big"><Money value={data.saldo_pendiente} /></div>
        <div className="balance-chips">
          <div className="chip"><b><Money value={data.total_activo} /></b><span>Total en facturas activas</span></div>
          <div className="chip"><b><Money value={data.total_pagado} /></b><span>Total pagado</span></div>
          <div className="chip"><b>{data.facturas_pendientes}</b><span>Facturas con saldo</span></div>
          <div className="chip"><b>{data.facturas_pagadas}</b><span>Facturas pagadas</span></div>
        </div>
      </div>

      <div className="card">
        <h3>Facturas pendientes</h3>
        {data.facturas.length === 0 ? <Empty text="¡No tiene saldos pendientes!" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Factura</th><th>Fecha</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {data.facturas.map((f) => (
                  <tr key={f.factura_id}>
                    <td><b>{f.numero_factura}</b></td>
                    <td><Fecha value={f.fecha_emision} /></td>
                    <td className="num"><Money value={f.total} /></td>
                    <td className="num"><Money value={f.valor_pagado} /></td>
                    <td className="num"><b><Money value={f.saldo} /></b></td>
                    <td><Estado value={f.estado_pago} /></td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => setPagar({ facturaId: f.factura_id, numero: f.numero_factura, saldo: f.saldo })}>
                        Pagar / Abonar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagar && (
        <PagarModal
          facturaId={pagar.facturaId}
          numeroFactura={pagar.numero}
          saldoMax={pagar.saldo}
          onCerrar={() => setPagar(null)}
          onPagado={cargar}
        />
      )}
    </>
  );
}
````

### Archivo `frontend/src/pages/portal/MisDatos.jsx`

**Archivo:** `frontend/src/pages/portal/MisDatos.jsx` · 45 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { ErrorBox, Loading } from '../../ui.jsx';

export default function MisDatos() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-datos').then(setData).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;

  const filas = [
    ['Tipo de cliente', data.tipo_cliente],
    ['Identificación', `${data.tipo_identificacion} ${data.numero_identificacion}`],
    ['Nombre o razón social', data.nombre_razon_social],
    ['Teléfono', data.telefono || '—'],
    ['Correo', data.correo || '—'],
    ['Dirección', data.direccion || '—'],
    ['Ciudad', data.ciudad || '—'],
  ];

  return (
    <>
      <div className="card">
        <h3>Mis datos</h3>
        <table style={{ maxWidth: 560 }}>
          <tbody>
            {filas.map(([k, v]) => (
              <tr key={k}><td style={{ width: 210, color: 'var(--muted)', fontWeight: 600 }}>{k}</td><td><b>{v}</b></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>
          🔒 Solo puede consultar la información asociada a su cuenta. Los datos se cargan automáticamente desde su sesión autenticada.
        </p>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/portal/MisCompras.jsx`

**Archivo:** `frontend/src/pages/portal/MisCompras.jsx` · 41 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MisCompras() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-pedidos').then(setRows).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <div className="card">
      <h3>Mis compras</h3>
      {rows.length === 0 ? <Empty text="No tiene compras registradas" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pedido</th><th>Fecha</th><th className="num">Subtotal</th><th className="num">Impuestos</th><th className="num">Total</th><th>Estado</th><th>Factura</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pedido_id}>
                  <td><b>{p.numero_pedido}</b></td>
                  <td><Fecha value={p.fecha} /></td>
                  <td className="num"><Money value={p.subtotal} /></td>
                  <td className="num"><Money value={p.impuestos} /></td>
                  <td className="num"><b><Money value={p.total} /></b></td>
                  <td><Estado value={p.estado} /></td>
                  <td>{p.numero_factura || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
````

### Archivo `frontend/src/pages/portal/MisFacturas.jsx`

**Archivo:** `frontend/src/pages/portal/MisFacturas.jsx` · 61 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../../ui.jsx';
import PagarModal from './PagarModal.jsx';

export default function MisFacturas() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [pagar, setPagar] = useState(null); // { facturaId, numero, saldo }

  const cargar = () => api.get('/mis-facturas').then(setRows).catch((e) => setError(errMsg(e)));
  useEffect(() => { cargar(); }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <div className="card">
      <h3>Mis facturas</h3>
      {rows.length === 0 ? <Empty text="No tiene facturas" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Factura</th><th>Emisión</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th><th>Estado</th><th>Pago</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.factura_id}>
                  <td><b>{f.numero_factura}</b></td>
                  <td><Fecha value={f.fecha_emision} /></td>
                  <td className="num"><Money value={f.total} /></td>
                  <td className="num"><Money value={f.valor_pagado} /></td>
                  <td className="num"><b><Money value={f.saldo} /></b></td>
                  <td><Estado value={f.estado} /></td>
                  <td><Estado value={f.estado_pago} /></td>
                  <td>
                    {f.estado === 'ACTIVA' && f.saldo > 0 && (
                      <button className="btn btn-primary btn-sm" onClick={() => setPagar({ facturaId: f.factura_id, numero: f.numero_factura, saldo: f.saldo })}>
                        Pagar / Abonar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagar && (
        <PagarModal
          facturaId={pagar.facturaId}
          numeroFactura={pagar.numero}
          saldoMax={pagar.saldo}
          onCerrar={() => setPagar(null)}
          onPagado={cargar}
        />
      )}
    </div>
  );
}
````

### Archivo `frontend/src/pages/portal/MisPagos.jsx`

**Archivo:** `frontend/src/pages/portal/MisPagos.jsx` · 40 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, FechaHora, DatosPago, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MisPagos() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-pagos').then(setRows).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <div className="card">
      <h3>Mis pagos</h3>
      {rows.length === 0 ? <Empty text="No tiene pagos registrados" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pago</th><th>Fecha</th><th>Factura</th><th className="num">Valor</th><th>Método</th><th>Referencia</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pago_id}>
                  <td><b>{p.numero_pago}</b></td>
                  <td><FechaHora value={p.fecha} /></td>
                  <td>{p.numero_factura}</td>
                  <td className="num"><b><Money value={p.valor} /></b></td>
                  <td>{p.metodo_pago}<div style={{ fontSize: 12, color: 'var(--muted)' }}><DatosPago p={p} /></div></td>
                  <td>{p.referencia || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
````

### Archivo `frontend/src/pages/portal/MisNotasCredito.jsx`

**Archivo:** `frontend/src/pages/portal/MisNotasCredito.jsx` · 45 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MisNotasCredito() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-notas-credito').then(setRows).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <>
      <div className="card">
        <h3>Mis notas de crédito</h3>
        {rows.length === 0 ? <Empty text="No tiene notas de crédito registradas" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nota</th><th>Factura</th><th>Fecha</th><th className="num">Valor</th><th>Motivo</th><th>Estado</th></tr></thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.nota_credito_id}>
                    <td><b>{n.numero_nota}</b></td>
                    <td>{n.numero_factura}</td>
                    <td><FechaHora value={n.fecha} /></td>
                    <td className="num"><Money value={n.valor} /></td>
                    <td>{n.motivo}</td>
                    <td><Estado value={n.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ opacity: 0.7, fontSize: 12.5, marginTop: 12 }}>
          Las notas de crédito corresponden a devoluciones registradas por FINAN-X sobre sus facturas pagadas.
        </p>
      </div>
    </>
  );
}
````

### Archivo `frontend/src/pages/portal/MiHistorial.jsx`

**Archivo:** `frontend/src/pages/portal/MiHistorial.jsx` · 64 líneas

````jsx
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MiHistorial() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mi-historial').then(setData).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="card">
        <h3>Mi historial financiero</h3>
        {data.facturas.length === 0 && data.pagos.length === 0 ? <Empty text="Sin movimientos financieros" /> : null}

        {data.facturas.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 18 }}>
            <h4 style={{ margin: '6px 0' }}>Facturas emitidas ({data.facturas.length})</h4>
            <table>
              <thead><tr><th>Factura</th><th>Fecha</th><th className="num">Total</th><th>Estado</th><th>Pago</th></tr></thead>
              <tbody>
                {data.facturas.map((f, i) => (
                  <tr key={i}>
                    <td><b>{f.numero_factura}</b></td>
                    <td><FechaHora value={f.fecha_emision} /></td>
                    <td className="num"><Money value={f.total} /></td>
                    <td><Estado value={f.estado} /></td>
                    <td><Estado value={f.estado_pago} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.pagos.length > 0 && (
          <div className="table-wrap">
            <h4 style={{ margin: '6px 0' }}>Pagos realizados ({data.pagos.length})</h4>
            <table>
              <thead><tr><th>Pago</th><th>Fecha</th><th>Factura</th><th className="num">Valor</th><th>Método</th></tr></thead>
              <tbody>
                {data.pagos.map((p, i) => (
                  <tr key={i}>
                    <td>{p.numero_pago}</td>
                    <td><FechaHora value={p.fecha} /></td>
                    <td>{p.numero_factura}</td>
                    <td className="num"><b><Money value={p.valor} /></b></td>
                    <td>{p.metodo_pago}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
````

## 3.14 ⭐ El modal de pago del portal: `pages/portal/PagarModal.jsx`

Es el corazón del pago en línea del cliente. **Este es el archivo del flujo Efecty.** Resumen de su lógica:

1. El cliente elige **valor** y **método** (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `CHEQUE`).
2. Según el método, muestra los campos adecuados (tarjeta con CVV/vencimiento/banco/titular; transferencia con banco y cuenta; cheque con banco).
3. **Si el método es `EFECTIVO`**:
   - **No existe el botón "Registrar pago"** (el formulario solo muestra el panel Pago en punto Efecty).
   - El botón disponible es **"Generar código de pago Efecty"**, que llama a `GET /mis-pagos/efecty-codigo` con la factura y el valor.
   - Cuando llega el código se muestra **en grande** con "Copiar código" y "Generar otro código", factura, valor y vigencia (24 h).
4. **Cualquier otro método** muestra "Registrar pago", que hace `POST /mis-pagos` (tarjeta/transferencia/cheque). El backend jamás acepta `EFECTIVO` por esa vía (respuesta 400), así que hay **doble protección**: interfaz + servidor.
5. Al pagar con éxito muestra el número de pago y el nuevo saldo, y avisa a la página para recargar (`onPagado`).

### Archivo `frontend/src/pages/portal/PagarModal.jsx`

**Archivo:** `frontend/src/pages/portal/PagarModal.jsx` · 239 líneas

````jsx
import { useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money } from '../../ui.jsx';

const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE'];

/** Modal de abono/pago desde el portal del cliente (con datos según método: tarjeta/transferencia/cheque). */
export default function PagarModal({ facturaId, numeroFactura, saldoMax, onCerrar, onPagado }) {
  const [valor, setValor] = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  // Datos de pago en línea (se limpian al cambiar de método)
  const [card, setCard] = useState({ numeroTarjeta: '', codigoSeguridad: '', vencimientoTarjeta: '', banco: '', titularTarjeta: '' });
  const [transfer, setTransfer] = useState({ numeroCuenta: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);
  const [loading, setLoading] = useState(false);
  // Código de pago Efecty (efectivo): se genera para pagar en un punto Efecty, no se registra aquí
  const [codigoEfecty, setCodigoEfecty] = useState(null);
  const [genLoading, setGenLoading] = useState(false);

  const setCardF = (k) => (e) => setCard((f) => ({ ...f, [k]: e.target.value }));
  const setTransferF = (k) => (e) => setTransfer((f) => ({ ...f, [k]: e.target.value }));

  const cambiarMetodo = (m) => {
    setMetodoPago(m);
    setCard({ numeroTarjeta: '', codigoSeguridad: '', vencimientoTarjeta: '', banco: '', titularTarjeta: '' });
    setTransfer({ numeroCuenta: '' });
    setReferencia('');
    setCodigoEfecty(null);
  };

  const generarCodigoEfecty = async () => {
    setError('');
    const v = Number(valor);
    if (!(v > 0)) { setError('Indica el valor a pagar para generar el código Efecty'); return; }
    setGenLoading(true);
    try {
      const resp = await api.get('/mis-pagos/efecty-codigo', { params: { facturaId, valor: v } });
      setCodigoEfecty(resp);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setGenLoading(false);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    // Efectivo: no se registra el pago aquí; se genera el código de pago Efecty
    if (metodoPago === 'EFECTIVO') { generarCodigoEfecty(); return; }
    setError('');
    setLoading(true);
    try {
      const body = {
        facturaId,
        valor: Number(valor),
        metodoPago,
        referencia: referencia || undefined,
        observaciones: observaciones || undefined,
      };
      if (metodoPago === 'TARJETA') {
        body.numeroTarjeta = card.numeroTarjeta;
        body.codigoSeguridad = card.codigoSeguridad;
        body.vencimientoTarjeta = card.vencimientoTarjeta;
        body.banco = card.banco;
        body.titularTarjeta = card.titularTarjeta;
      } else if (metodoPago === 'TRANSFERENCIA' || metodoPago === 'CHEQUE') {
        body.banco = card.banco;
      }
      if (metodoPago === 'TRANSFERENCIA') body.numeroCuenta = transfer.numeroCuenta;
      const resp = await api.post('/mis-pagos', body);
      setOk(resp);
      onPagado && onPagado(resp);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const tarjeta = metodoPago === 'TARJETA';
  const transferencia = metodoPago === 'TRANSFERENCIA';
  const cheque = metodoPago === 'CHEQUE';
  const efectivo = metodoPago === 'EFECTIVO';
  const refObligatoria = transferencia || cheque;

  return (
    <div className="overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Pagar factura {numeroFactura || ''}</h3>
          <button type="button" className="btn-close" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>

        {ok ? (
          <div className="modal-body">
            <div className="alert alert-success">
              Pago <b>{ok.numero_pago}</b> registrado por <b><Money value={ok.valor} /></b>.
              <br />Saldo pendiente: <b><Money value={ok.saldo} /></b> ({ok.estado_pago}).
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        ) : (
          <form className="modal-body" onSubmit={enviar}>
            <div className="saldo-hint">
              Saldo pendiente de esta factura: <b><Money value={saldoMax} /></b>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Valor a abonar (COP)</label>
              <input
                type="number" min="1" step="0.01" value={valor} required
                onChange={(e) => setValor(e.target.value)} placeholder="0"
              />
              <button type="button" className="link" onClick={() => setValor(Number(saldoMax || 0))}>
                Pagar saldo completo (${Number(saldoMax || 0).toLocaleString('en-US')})
              </button>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Método de pago</label>
              <select value={metodoPago} onChange={(e) => cambiarMetodo(e.target.value)}>
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {tarjeta && (
              <>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Número de tarjeta *</label>
                  <input inputMode="numeric" autoComplete="cc-number" value={card.numeroTarjeta} onChange={setCardF('numeroTarjeta')} placeholder="4111 1111 1111 1111" required />
                </div>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Código de seguridad (CVV) *</label>
                    <input type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.codigoSeguridad} onChange={setCardF('codigoSeguridad')} placeholder="123" required />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Vencimiento (MM/AA) *</label>
                    <input inputMode="numeric" autoComplete="cc-exp" maxLength={5} value={card.vencimientoTarjeta} onChange={setCardF('vencimientoTarjeta')} placeholder="12/30" required />
                  </div>
                </div>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Banco emisor *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Bancolombia" required />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Titular de la tarjeta *</label>
                    <input autoComplete="cc-name" value={card.titularTarjeta} onChange={setCardF('titularTarjeta')} placeholder="Nombre como sale en la tarjeta" required />
                  </div>
                </div>
                <div className="alert alert-info" style={{ marginBottom: 12, fontSize: 13 }}>
                  🔒 El CVV y el número completo nunca se almacenan: solo se guardan los últimos 4 dígitos para identificar el pago.
                </div>
              </>
            )}

            {transferencia && (
              <>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Banco destino *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Davivienda" required />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>N.º de cuenta *</label>
                    <input inputMode="numeric" value={transfer.numeroCuenta} onChange={setTransferF('numeroCuenta')} placeholder="4 a 20 dígitos" required />
                  </div>
                </div>
              </>
            )}

            {cheque && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Banco del cheque *</label>
                <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Banco Popular" required />
              </div>
            )}

            {efectivo ? (
              <div className="panel-inline" style={{ border: '1.5px dashed #d97706', background: '#fffbeb', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#92400e' }}>💵 Efectivo · Pago en punto Efecty</div>
                <p style={{ fontSize: 12.5, margin: '0 0 10px', color: '#44403c' }}>
                  El efectivo no se registra aquí. Genera tu <b>código de pago Efecty</b> y cancela en
                  cualquier punto Efecty del país (vigencia <b>24 horas</b>). Al confirmarse, el pago
                  se aplica automáticamente a tu factura.
                </p>
                {codigoEfecty ? (
                  <div style={{ background: '#fff', border: '1.5px dashed #d97706', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#92400e', marginBottom: 6 }}>Tu código de pago Efecty</div>
                    <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 21, fontWeight: 800, color: '#b45309', letterSpacing: '.04em', wordBreak: 'break-all' }}>
                      {codigoEfecty.codigo}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#78716c', marginTop: 6 }}>
                      Factura {codigoEfecty.numero_factura} · <Money value={codigoEfecty.valor} /> ·
                      válido hasta {new Date(Date.now() + 24 * 3600e3).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
                      <button type="button" className="btn" onClick={() => { try { navigator.clipboard?.writeText(codigoEfecty.codigo); } catch { /* sin portapapeles */ } }}>
                        📋 Copiar código
                      </button>
                      <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={() => setCodigoEfecty(null)}>
                        Generar otro código
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={genLoading} onClick={generarCodigoEfecty}>
                    {genLoading ? 'Generando código…' : 'Generar código de pago Efecty'}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>
                    Referencia{refObligatoria ? ' (n.º de comprobante / cheque) *' : ' (opcional)'}
                  </label>
                  <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={refObligatoria ? 'N.º de comprobante o cheque' : 'N.º de recibo, comprobante o giro'} required={refObligatoria} />
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Observaciones (opcional)</label>
                  <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del cliente" />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Procesando pago…' : 'Registrar pago'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
````

---

# PARTE 4 · Cómo abrir la base de datos directamente en PostgreSQL

Ya aprendiste qué guarda cada tabla. Ahora vas a **verlo con tus propios ojos**. La base de datos de FINAN-X es un PostgreSQL que corre en el contenedor `finanx-db`.

## 4.1 Datos de conexión

| Dato | Valor |
|---|---|
| Servidor (host) | `localhost` |
| Puerto | **5432** |
| Base de datos | `finanx` |
| Usuario | `finanx` |
| Contraseña | `finanx` |

> El contenedor "publica" el puerto 5432 de tu Mac, así que cualquier cliente de PostgreSQL puede conectarse a `localhost:5432` como si la base fuera local.

## 4.2 Opción A — Entrar con `psql` dentro del contenedor (lo más rápido)

`psql` es la consola oficial de PostgreSQL. El contenedor ya la trae instalada. Desde la terminal escribe:

```bash
docker exec -it finanx-db psql -U finanx -d finanx
```

Verás el prompt de PostgreSQL:

```
finanx=#
```

Comandos útiles para empezar:

```sql
\l                     -- lista todas las bases de datos
\dt                    -- muestra las TABLAS de la base finanx
\dv                    -- muestra las VISTAS (ahí está factura_saldo)
\d facturas            -- describe la estructura de la tabla facturas
\d factura_saldo       -- describe la vista de saldos
\x on                  -- modo "expandido": cada fila en varias líneas (más fácil de leer)
\q                     -- salir
```

**Prueba inmediata** (copia y pega, termina cada línea con `;`):

```sql
SELECT * FROM roles;

SELECT u.nombre, u.correo, r.nombre AS rol, u.estado
FROM usuarios u JOIN roles r ON r.rol_id = u.rol_id;

SELECT cliente_id, nombre_razon_social, ciudad, estado FROM clientes;
```

Para salir: `\q` (o Ctrl+D).

## 4.3 Opción B — Con un programa gráfico (DBeaver, TablePlus, pgAdmin, VS Code)

Si prefieres ventanas y clics, cualquier cliente de PostgreSQL sirve con estos datos:

1. Abre **DBeaver** o **TablePlus** (o la extensión "PostgreSQL" de VS Code).
2. **Nueva conexión** → tipo **PostgreSQL**.
3. Rellena exactamente como la tabla de 4.1:

```
Host:     localhost
Port:     5432
Database: finanx
User:     finanx
Password: finanx
```

4. **Test Connection** y a explorar: verás el árbol con `public → Tables`, la vista `factura_saldo`, y podrás hacer doble clic en cualquier tabla para ver sus filas.

## 4.4 Opción B2 — Con `psql` instalado en tu Mac (si ya lo tienes)

```bash
PGPASSWORD=finanx psql -h localhost -p 5432 -U finanx -d finanx
```

## 4.5 Aplicar una migración desde la terminal

```bash
cd "/Users/luis/Documents/Project Facturacion Finan-x"
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_recuperacion_contrasena.sql
```

## 4.6 Consultas útiles para "mirar" como un analista

```sql
-- 1) Cuánto debe cada cliente (saldos reales desde la vista)
SELECT c.nombre_razon_social, round(v.saldo::numeric, 2) AS saldo
FROM factura_saldo v JOIN clientes c ON c.cliente_id = v.cliente_id
WHERE v.estado = 'ACTIVA' AND v.saldo > 0
ORDER BY v.saldo DESC;

-- 2) Facturas pendientes del cliente demo
SELECT numero_factura, total, valor_pagado, saldo, estado_pago
FROM factura_saldo
WHERE cliente_id = 1 AND estado = 'ACTIVA';

-- 3) Pagos registrados (con su método)
SELECT p.numero_pago, f.numero_factura, p.valor, p.metodo_pago, p.referencia, p.fecha
FROM pagos p JOIN facturas f ON f.factura_id = p.factura_id
ORDER BY p.fecha DESC;

-- 4) Últimas 10 operaciones de la bitácora
SELECT fecha_hora, usuario, usuario_tipo, modulo, operacion, descripcion
FROM auditoria ORDER BY auditoria_id DESC LIMIT 10;

-- 5) Solicitudes de recuperación de contraseña pendientes
SELECT * FROM recuperaciones_clave WHERE usado = FALSE;

-- 6) Pagos con tarjeta (solo se guardan los últimos 4 dígitos, ¡nunca el número completo!)
SELECT numero_pago, tipo_tarjeta, ultimos_digitos_tarjeta, ven_cimiento_tarjeta, banco, titular
FROM pagos WHERE metodo_pago = 'TARJETA';
```

> Ajusta la consulta 6: la columna correcta se llama `vencimiento_tarjeta` (no `ven_cimiento_tarjeta`); ese renglón está escrito mal a propósito para que **veas el error típico** cuando una columna no existe: PostgreSQL te dirá `column "ven_cimiento_tarjeta" does not exist`. Cámbialo por `vencimiento_tarjeta`.

## 4.7 La contraseña de la base (útil para conexiones externas)

La **clave de PostgreSQL** es `finanx` (igual al usuario). Si algún día conectas FINAN-X a un PostgreSQL externo (no Docker), esa llamada se configura en `docker-compose.yml` (sección `db`) y en `backend/src/config.js` mediante variables `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`.

## 4.8 Los datos persisten (importante)

Los datos **no se pierden** al apagar los contenedores: viven en el volumen `finanx_pgdata` de Docker. Si algún día quieres **empezar de cero**, sí debes borrar el volumen (¡cuidado, es destructivo!):

```bash
./levantar.sh --purge
# (equivale a: docker compose down -v, que borra contenedores Y datos)
```

---

# Anexo A · Archivos de despliegue (Docker)

Estos cuatro archivos explican **cómo se levanta** la aplicación completa. Son cortos y muy ilustrativos.

### `docker-compose.yml`

**Archivo:** `docker-compose.yml` · 64 líneas

````yaml
services:
  db:
    image: postgres:16-alpine
    container_name: finanx-db
    environment:
      POSTGRES_USER: finanx
      POSTGRES_PASSWORD: finanx
      POSTGRES_DB: finanx
    ports:
      - "5432:5432"
    volumes:
      - finanx_pgdata:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U finanx -d finanx"]
      interval: 5s
      timeout: 5s
      retries: 12

  backend:
    build: ./backend
    container_name: finanx-backend
    environment:
      PORT: 4000
      PGHOST: db
      PGPORT: 5432
      PGUSER: finanx
      PGPASSWORD: finanx
      PGDATABASE: finanx
      # En producción defina un JWT_SECRET propio (≥32 caracteres) — ver documentacion/B_Guia_Tecnica_Desarrolladores
      JWT_SECRET: ${JWT_SECRET:-finanx-prod-secret-cambiar-por-una-clave-segura-de-32-caracteres}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080}
      LOGIN_MAX_FAILURES: ${LOGIN_MAX_FAILURES:-5}
      REGISTRO_RATE_LIMIT: ${REGISTRO_RATE_LIMIT:-20}
      # Recuperación de contraseña (OTP). En producción ponga OTP_RETORNO_DEMO=off: el código
      # solo se enviaría por SMS/correo real (conectar proveedor en src/middleware/notificar.js).
      OTP_RETORNO_DEMO: ${OTP_RETORNO_DEMO:-on}
      OTP_VALIDEZ_MINUTOS: ${OTP_VALIDEZ_MINUTOS:-10}
      OTP_MAX_INTENTOS: ${OTP_MAX_INTENTOS:-5}
      RECUPERAR_RATE_LIMIT: ${RECUPERAR_RATE_LIMIT:-40}
      NODE_ENV: ${NODE_ENV:-production}
    ports:
      - "4000:4000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:4000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 12
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: finanx-frontend
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  finanx_pgdata:
````

### `backend/Dockerfile`

**Archivo:** `backend/Dockerfile` · 14 líneas

````text
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

# El seed es idempotente: crea roles/usuarios demo la primera vez y luego no hace nada.
CMD ["sh", "-c", "node src/seed.js && node src/index.js"]
````

### `frontend/Dockerfile`

**Archivo:** `frontend/Dockerfile` · 14 líneas

````text
# ---------- Etapa 1: build de la SPA ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Etapa 2: servidor estático + proxy /api ----------
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
````

### `frontend/nginx.conf`

**Archivo:** `frontend/nginx.conf` · 23 líneas

````conf
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  # Proxy de la API hacia el contenedor del backend
  location /api/ {
    proxy_pass http://backend:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # SPA: cualquier ruta que no sea un archivo real sirve index.html
  location / {
    try_files $uri $uri/ /index.html;
  }

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
}
````

---

# Anexo B · Pruebas automáticas (e2e)

El proyecto incluye una suite de **99 pruebas automáticas** (`backend/scripts/e2e.mjs`) que prueban la aplicación completa por su API: registro, login, CRUD de clientes/productos, pedidos, facturación, pagos, notas de crédito, recuperación de contraseña, aislamiento del portal y muchos casos borde (pagos sobre saldo, anulaciones, etc.). Se ejecutan con:

```bash
cd backend
npm test
```

Sin este anexo el documento estaría incompleto, porque estas pruebas *son* también "código que genera la aplicación" (el apéndice de verificación). Está incluido íntegro a continuación.

### `backend/scripts/e2e.mjs`

**Archivo:** `backend/scripts/e2e.mjs` · 396 líneas

````js
/**
 * FINAN-X · Pruebas end-to-end de la API
 * Requiere: backend corriendo en http://localhost:4000 y base con seed.
 *
 * Ejecutar:  node scripts/e2e.mjs   (o  npm test)
 * Salida:    0 = OK, 1 = falló alguna prueba
 */
import 'dotenv/config';

const BASE = process.env.API_BASE || 'http://localhost:4000/api';
let passed = 0;
let failed = 0;
const errors = [];

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    errors.push(`${name} ${extra}`);
    console.error(`  ✘ ${name} ${extra}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* vacío */ }
  return { status: res.status, data };
}

const suffix = Date.now().toString().slice(-6);

async function main() {
  console.log('\n=== FINAN-X · Pruebas end-to-end ===\n');

  // ---------- Autenticación ----------
  console.log('1) Autenticación');
  const bad = await call('POST', '/auth/login', { body: { username: 'x@x.com', password: 'mala' } });
  check('Login inválido → 401', bad.status === 401);
  const sinToken = await call('GET', '/clientes');
  check('Sin token → 401', sinToken.status === 401);

  const admin = await call('POST', '/auth/login', { body: { username: 'admin@finanx.test', password: 'admin123' } });
  check('Login admin → 200', admin.status === 200 && admin.data?.user?.rol === 'ADMIN');
  const clienteLogin = await call('POST', '/auth/login', { body: { username: 'cliente@finanx.test', password: 'cliente123' } });
  check('Login cliente → 200', clienteLogin.status === 200 && clienteLogin.data?.user?.tipo === 'cliente');
  const AT = admin.data?.token;
  const CT = clienteLogin.data?.token;

  // ---------- Autoregistro de clientes ----------
  console.log('1b) Autoregistro de clientes');
  const regSuf = `R${suffix}`;
  const reg = await call('POST', '/auth/registro', {
    body: {
      nombreRazonSocial: `Cliente Nuevo ${suffix}`,
      numeroIdentificacion: `1122${regSuf}`,
      correo: `nuevo${regSuf}@mail.co`,
      ciudad: 'Pereira',
      username: `nuevo${regSuf}`,
      password: 'secreto1',
    },
  });
  check('Registrar cliente → 201 con token', reg.status === 201 && !!reg.data?.token && reg.data?.user?.tipo === 'cliente', JSON.stringify(reg.data));
  const REGT = reg.data?.token;
  const dupIdent = await call('POST', '/auth/registro', {
    body: { nombreRazonSocial: 'Duplicado', numeroIdentificacion: `1122${regSuf}`, username: `otro${regSuf}`, password: 'secreto1' },
  });
  check('Identificación duplicada → 409', dupIdent.status === 409, JSON.stringify(dupIdent.data));
  const dupUser = await call('POST', '/auth/registro', {
    body: { nombreRazonSocial: 'Otro', numeroIdentificacion: `2211${regSuf}`, username: `nuevo${regSuf}`, password: 'secreto1' },
  });
  check('Usuario duplicado → 409', dupUser.status === 409, JSON.stringify(dupUser.data));
  const corta = await call('POST', '/auth/registro', {
    body: { nombreRazonSocial: 'Corta', numeroIdentificacion: `3311${regSuf}`, username: `ab${regSuf}`, password: '123' },
  });
  check('Contraseña corta → 400', corta.status === 400);
  const sinNombre = await call('POST', '/auth/registro', { body: { numeroIdentificacion: `4411${regSuf}`, username: `sn${regSuf}`, password: 'secreto1' } });
  check('Faltan datos obligatorios → 400', sinNombre.status === 400);
  const misNuevo = await call('GET', '/mis-facturas', { token: REGT });
  check('Cliente registrado entra al portal aislado', misNuevo.status === 200 && Array.isArray(misNuevo.data));

  // ---------- Autorización por rol ----------
  console.log('2) Autorización por rol');
  const facturador = await call('POST', '/auth/login', { body: { username: 'facturador@finanx.test', password: 'facturador123' } });
  const FT = facturador.data?.token;
  const adminOnly = await call('GET', '/usuarios', { token: FT });
  check('Facturador en /usuarios → 403', adminOnly.status === 403);
  const clienteEnInternas = await call('GET', '/clientes', { token: CT });
  check('Cliente en /clientes → 403', clienteEnInternas.status === 403);

  // ---------- Clientes ----------
  console.log('3) Gestión de clientes (RF-C01..C06)');
  const nc = await call('POST', '/clientes', {
    token: AT,
    body: { tipoCliente: 'EMPRESA', tipoIdentificacion: 'NIT', numeroIdentificacion: `900${suffix}`, nombreRazonSocial: `Empresa Prueba ${suffix}`, correo: `prueba${suffix}@corp.co`, ciudad: 'Cali' },
  });
  check('Crear cliente → 201', nc.status === 201, JSON.stringify(nc.data));
  const cid = nc.data?.cliente_id;
  const dup = await call('POST', '/clientes', {
    token: AT,
    body: { tipoIdentificacion: 'NIT', numeroIdentificacion: `900${suffix}`, nombreRazonSocial: 'Duplicado' },
  });
  check('Cliente duplicado → 409', dup.status === 409, JSON.stringify(dup.data));
  const lista = await call('GET', `/clientes?q=${suffix}`, { token: AT });
  check('Búsqueda de cliente', lista.status === 200 && lista.data.some((c) => c.cliente_id === cid));
  const activo = await call('PATCH', `/clientes/${cid}/estado`, { token: AT, body: { estado: 'INACTIVO' } });
  check('Inactivar cliente', activo.status === 200);

  // ---------- Productos ----------
  console.log('4) Gestión de productos (CU-15..CU-19)');
  const np = await call('POST', '/productos', {
    token: AT,
    body: { codigo: `PROD-T${suffix}`, nombre: 'Producto de prueba', precio: 250000, impuesto: 19, categoria: 'Prueba' },
  });
  check('Crear producto → 201', np.status === 201, JSON.stringify(np.data));
  const pid = np.data?.producto_id;
  const pdup = await call('POST', '/productos', { token: AT, body: { codigo: `PROD-T${suffix}`, nombre: 'X', precio: 10 } });
  check('Código duplicado → 409', pdup.status === 409);
  const pneg = await call('POST', '/productos', { token: AT, body: { codigo: `PROD-N${suffix}`, nombre: 'Y', precio: -5 } });
  check('Precio negativo → 400', pneg.status === 400);

  // ---------- Pedido (cálculos en servidor) ----------
  console.log('5) Pedidos (CU-20..CU-24) — cálculo en servidor');
  const oped = await call('POST', '/pedidos', {
    token: AT,
    body: {
      clienteId: 1,
      observaciones: 'Pedido e2e',
      items: [
        { productoId: pid, cantidad: 3 },
        { productoId: 2, cantidad: 2 },
      ],
    },
  });
  check('Crear pedido → 201 con total calculado', oped.status === 201 && Number(oped.data?.total) > 0, JSON.stringify(oped.data));
  const pedidoId = oped.data?.pedido_id;
  const t2 = await call('GET', `/pedidos/${pedidoId}`, { token: AT });
  const expectLinea1 = 250000 * 3;           // producto e2e 19% → 750000, imp 142500
  const expectLinea2 = 120000 * 2;           // mouse 19%   → 240000, imp 45600
  const subtotalEsp = expectLinea1 + expectLinea2;
  const impEsp = expectLinea1 * 0.19 + expectLinea2 * 0.19;
  const totEsp = Math.round((subtotalEsp + impEsp) * 100) / 100;
  check(
    'Totales calculados por el servidor',
    Math.abs(t2.data?.subtotal - subtotalEsp) < 0.01 && Math.abs(t2.data?.impuestos - impEsp) < 0.01 && Math.abs(t2.data?.total - totEsp) < 0.01,
    `subtotal=${t2.data?.subtotal} esp=${subtotalEsp} imp=${t2.data?.impuestos} esp=${impEsp}`
  );
  const conf = await call('PATCH', `/pedidos/${pedidoId}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  check('Confirmar pedido', conf.status === 200);
  // Modificar un pedido confirmado debe fallar
  const mod = await call('PUT', `/pedidos/${pedidoId}`, { token: AT, body: { items: [{ productoId: pid, cantidad: 1 }] } });
  check('Modificar pedido CONFIRMADO → 409', mod.status === 409);

  // ---------- Facturación ----------
  console.log('6) Facturación (CU-25..CU-30)');
  const factCompleta = await call('POST', '/facturas', { token: AT, body: { pedidoId } });
  check('Generar factura → 201', factCompleta.status === 201, JSON.stringify(factCompleta.data));
  const fid = factCompleta.data?.factura_id;
  const refac = await call('POST', '/facturas', { token: AT, body: { pedidoId } });
  check('Refacturar mismo pedido → 409', refac.status === 409);
  const saldo = await call('GET', `/facturas/${fid}/saldo`, { token: AT });
  check('Saldo inicial = total (PENDIENTE)', saldo.data?.estado_pago === 'PENDIENTE' && Number(saldo.data?.saldo) === Number(saldo.data?.total));

  // ---------- Pagos ----------
  console.log('7) Pagos (RF-04..RF-06)');
  const medio = await call('POST', '/pagos', { token: AT, body: { facturaId: fid, valor: 100000, metodoPago: 'EFECTIVO' } });
  check('Pago parcial → PAGO_PARCIAL', medio.status === 201 && medio.data?.estado_pago === 'PAGO_PARCIAL', JSON.stringify(medio.data));
  const over = await call('POST', '/pagos', { token: AT, body: { facturaId: fid, valor: Number(saldo.data?.total) * 2 } });
  check('Sobrepago → 400', over.status === 400, JSON.stringify(over.data));
  const completo = await call('POST', '/pagos', { token: AT, body: { facturaId: fid, valor: Number(saldo.data?.total) - 100000, metodoPago: 'TRANSFERENCIA', referencia: 'E2E-GIRO', banco: 'BancoDemo', numeroCuenta: '9876543210' } });
  check('Pago completo → PAGADA', completo.status === 201 && completo.data?.estado_pago === 'PAGADA', JSON.stringify(completo.data));
  const saldo2 = await call('GET', `/facturas/${fid}/saldo`, { token: AT });
  check('Saldo final = 0', Number(saldo2.data?.saldo) === 0);

  // ---------- Anulación ----------
  console.log('8) Anulación (RF-03)');
  // Pedido nuevo → factura sin pagos → anular
  const ped2 = await call('POST', '/pedidos', { token: AT, body: { clienteId: 1, items: [{ productoId: pid, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${ped2.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const fac2 = await call('POST', '/facturas', { token: AT, body: { pedidoId: ped2.data?.pedido_id } });
  const anu = await call('POST', `/facturas/${fac2.data?.factura_id}/anular`, { token: AT, body: { motivo: 'Prueba e2e' } });
  check('Anular factura sin pagos → OK', anu.status === 200, JSON.stringify(anu.data));
  const anuPagos = await call('POST', `/facturas/${fid}/anular`, { token: AT, body: { motivo: 'x' } });
  check('Anular factura con pagos → 409', anuPagos.status === 409, JSON.stringify(anuPagos.data));
  const anuSinMotivo = await call('POST', `/facturas/${fac2.data?.factura_id}/anular`, { token: AT, body: {} });
  check('Anular sin motivo → 400', anuSinMotivo.status === 400);

  // ---------- Portal del cliente / aislamiento ----------
  console.log('9) Portal del cliente (CU-09..CU-14) — aislamiento');
  const mis = await call('GET', '/mis-facturas', { token: CT });
  check('Mis facturas (solo las propias)', mis.status === 200, JSON.stringify(mis.data));
  const ajenas = mis.data.filter((f) => f.cliente_id !== clienteLogin.data?.user?.clienteId);
  check('Ninguna factura de otro cliente', ajenas.length === 0);
  const saldoCli = await call('GET', '/mi-saldo', { token: CT });
  check('Mi saldo disponible', saldoCli.status === 200 && typeof saldoCli.data?.saldo_pendiente === 'number');
  const datos = await call('GET', '/mis-datos', { token: CT });
  check('Mis datos = cliente autenticado', datos.data?.cliente_id === clienteLogin.data?.user?.clienteId);

  // ---------- Pago desde el portal del cliente ----------
  console.log('9b) Pago desde el portal del cliente');
  const cliNuevoId = reg.data?.user?.clienteId;
  // Área admin: pedido + factura para el cliente recién registrado
  const pedCli = await call('POST', '/pedidos', { token: AT, body: { clienteId: cliNuevoId, items: [{ productoId: 2, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${pedCli.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const facCli = await call('POST', '/facturas', { token: AT, body: { pedidoId: pedCli.data?.pedido_id } });
  const facIdCli = facCli.data?.factura_id;
  check('Factura creada para cliente nuevo', facCli.status === 201, JSON.stringify(facCli.data));
  const ajeno = await call('POST', '/mis-pagos', { token: CT, body: { facturaId: facIdCli, valor: 10000 } });
  check('No paga factura ajena → 404 (aislamiento)', ajeno.status === 404, JSON.stringify(ajeno.data));
  const malFac = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: 999999, valor: 10000 } });
  check('Factura inexistente → 404', malFac.status === 404);
  const pagoCli = await call('POST', '/mis-pagos', { token: REGT, body: {
    facturaId: facIdCli, valor: 50000, metodoPago: 'TARJETA', referencia: 'PORTAL-E2E',
    numeroTarjeta: '4111111111111111', codigoSeguridad: '123', vencimientoTarjeta: '12/30',
    banco: 'BancoDemo', titularTarjeta: 'Cliente E2E',
  } });
  check('Abono desde portal → 201 PAGO_PARCIAL', pagoCli.status === 201 && pagoCli.data?.estado_pago === 'PAGO_PARCIAL', JSON.stringify(pagoCli.data));
  const sobreCli = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facIdCli, valor: 5000000 } });
  check('Sobrepago desde portal → 400', sobreCli.status === 400, JSON.stringify(sobreCli.data));
  const misP = await call('GET', '/mis-pagos', { token: REGT });
  check('Pago visible en «mis pagos»', misP.status === 200 && misP.data.some((p) => p.numero_factura === facCli.data?.numero_factura && Number(p.valor) === 50000));
  const saldoNuevo = await call('GET', '/mi-saldo', { token: REGT });
  check('Saldo del cliente refleja el abono', saldoNuevo.status === 200 && Number(saldoNuevo.data?.saldo_pendiente) > 0);
  const portalSinToken = await call('POST', '/mis-pagos', { body: { facturaId: facIdCli, valor: 100 } });
  check('Pago desde portal sin token → 401', portalSinToken.status === 401);

  // ---------- Notas de crédito (devoluciones) ----------
  console.log('9c) Notas de crédito');
  const cnAnulada = await call('POST', '/notas-credito', { token: AT, body: { facturaId: fac2.data?.factura_id, valor: 100, motivo: 'x' } });
  check('CN sobre factura anulada → 409', cnAnulada.status === 409, JSON.stringify(cnAnulada.data));
  const ped3 = await call('POST', '/pedidos', { token: AT, body: { clienteId: 1, items: [{ productoId: 2, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${ped3.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const fac3 = await call('POST', '/facturas', { token: AT, body: { pedidoId: ped3.data?.pedido_id } });
  const cnSinPagos = await call('POST', '/notas-credito', { token: AT, body: { facturaId: fac3.data?.factura_id, valor: 1000, motivo: 'test' } });
  check('CN sin pagos disponibles → 409', cnSinPagos.status === 409, JSON.stringify(cnSinPagos.data));
  const cnSinMotivo = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 1000 } });
  check('CN sin motivo → 400', cnSinMotivo.status === 400);
  const cnValor0 = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 0, motivo: 'x' } });
  check('CN valor 0 → 400', cnValor0.status === 400);
  const cnOver = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 999999999, motivo: 'x' } });
  check('CN supera lo pagado → 400', cnOver.status === 400, JSON.stringify(cnOver.data));
  const cn = await call('POST', '/notas-credito', { token: AT, body: { facturaId: facIdCli, valor: 10000, motivo: 'Devolución e2e' } });
  check('Crear CN → 201 con número NC-', cn.status === 201 && String(cn.data?.numero_nota || '').startsWith('NC-'), JSON.stringify(cn.data));
  const cnId = cn.data?.nota_credito_id;
  const cnDetalle = await call('GET', `/notas-credito/${cnId}`, { token: AT });
  check('Detalle de CN', cnDetalle.status === 200 && cnDetalle.data?.numero_nota === cn.data?.numero_nota);
  const saldoTrasCN = await call('GET', `/facturas/${facIdCli}/saldo`, { token: AT });
  check('Saldo sube tras la CN (reversa el pago devuelto)', Number(saldoTrasCN.data?.saldo) === Number(saldoTrasCN.data?.total) - 50000 + 10000, JSON.stringify(saldoTrasCN.data));
  const listaCN = await call('GET', '/notas-credito?estado=ACTIVA', { token: AT });
  check('Lista de CN activas incluye la creada', listaCN.status === 200 && listaCN.data.some((x) => x.nota_credito_id === cnId));
  const misNCLogin = await call('GET', '/mis-notas-credito', { token: REGT });
  check('Portal: mis notas crédito (aislado al cliente)', misNCLogin.status === 200 && misNCLogin.data.some((x) => x.nota_credito_id === cnId));
  const anuCN = await call('POST', `/notas-credito/${cnId}/anular`, { token: AT, body: { motivo: 'Error de registro e2e' } });
  check('Anular CN → OK', anuCN.status === 200 && anuCN.data?.estado === 'ANULADA');
  const anuCN2 = await call('POST', `/notas-credito/${cnId}/anular`, { token: AT, body: { motivo: 'x' } });
  check('Reanular CN → 409', anuCN2.status === 409);
  const anuCNsin = await call('POST', `/notas-credito/${cnId}/anular`, { token: AT, body: {} });
  check('Anular CN sin motivo → 400', anuCNsin.status === 400);

  // ---------- Balance por cliente y envío por correo ----------
  console.log('9d) Balance por cliente y envío del estado financiero');
  const balance = await call('GET', '/reportes/balance-clientes', { token: AT });
  check('Balance por cliente → 200 con resumen y lista', balance.status === 200 && Array.isArray(balance.data?.clientes) && balance.data?.clientes.length > 0, JSON.stringify(balance.data).slice(0, 200));
  check('Resumen del balance coherente', Number(balance.data?.resumen?.saldo_total) >= 0 && Number(balance.data?.resumen?.clientes_con_saldo) >= 0);
  const balCli = balance.data?.clientes.find((c) => c.cliente_id === cliNuevoId);
  check('El cliente nuevo aparece en el balance', !!balCli && Number(balCli?.saldo_pendiente) > 0);
  const correoResumen = await call('GET', `/clientes/${cliNuevoId}/resumen-correo`, { token: AT });
  check('Resumen financiero para correo → asunto + cuerpo + destinatario',
    correoResumen.status === 200 && correoResumen.data?.asunto && !!correoResumen.data?.destinatario && correoResumen.data?.cuerpo.includes('FINAN-X'), JSON.stringify(correoResumen.data));
  check('Cuerpo incluye facturas y saldos', /FACTURAS|Saldo|saldo/i.test(correoResumen.data?.cuerpo || ''));
  const correoSinCliente = await call('GET', '/clientes/999999/resumen-correo', { token: AT });
  check('Resumen de cliente inexistente → 404', correoSinCliente.status === 404);

  // ---------- Reportes y auditoría ----------
  console.log('10) Reportes y auditoría');
  const resumen = await call('GET', '/reportes/resumen', { token: AT });
  check('Resumen de reportes', resumen.status === 200 && typeof resumen.data?.facturas_activas === 'number');
  const auditoria = await call('GET', '/auditoria?modulo=Pagos', { token: AT });
  check('Auditoría registra pagos', auditoria.status === 200 && auditoria.data.length >= 2);

  // ---------- Seguridad (cabeceras HTTP, CORS y límite de intentos) ----------
  console.log('11) Seguridad (cabeceras HTTP, CORS y rate limit)');
  const h = await fetch(`${BASE}/health`);
  check('Cabecera de seguridad X-Content-Type-Options: nosniff', h.headers.get('x-content-type-options') === 'nosniff');
  check('Cabecera de seguridad X-Frame-Options presente', !!h.headers.get('x-frame-options'));
  check('No se revela el motor web (sin X-Powered-By)', !h.headers.get('x-powered-by'));

  const corsOk = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:8080' } });
  check('CORS: origen permitido recibe la cabecera', corsOk.headers.get('access-control-allow-origin') === 'http://localhost:8080');
  const corsEvil = await fetch(`${BASE}/health`, { headers: { Origin: 'http://malicioso.example' } });
  check('CORS: origen no permitido es bloqueado', corsEvil.headers.get('access-control-allow-origin') === null);

  let ultimoIntento = null;
  for (let i = 0; i < 30; i++) {
    ultimoIntento = await call('POST', '/auth/login', { body: { username: `e2e-${Date.now()}-${i}@x.test`, password: 'mala' } });
    if (ultimoIntento.status === 429) break;
  }
  check('Fuerza bruta: intentos fallidos consecutivos → 429', ultimoIntento.status === 429, JSON.stringify(ultimoIntento.data));
  const okTrasBloqueo = await call('POST', '/auth/login', { body: { username: 'cliente@finanx.test', password: 'cliente123' } });
  check('Login correcto tras bloqueo → 200 (el acierto resetea el contador)', okTrasBloqueo.status === 200, JSON.stringify(okTrasBloqueo.data));
  const datosTrasTodo = await call('GET', '/mis-datos', { token: okTrasBloqueo.data?.token });
  check('Token renovado sigue aislado en el portal', datosTrasTodo.status === 200 && datosTrasTodo.data?.cliente_id === clienteLogin.data?.user?.clienteId);

  // ---------- Recuperación de contraseña (OTP) y datos de pago en línea ----------
  console.log('12) Recuperación de contraseña (OTP) y datos de pago en línea');
  const reqUsr = `nuevo${regSuf}`; // cliente autoregistrado en 1b (contraseña original 'secreto1')

  // --- Flujo de recuperación con código de un solo uso ---
  const sol = await call('POST', '/auth/recuperar-solicitar', { body: { username: reqUsr, canal: 'EMAIL' } });
  check('Solicitar código → 200 y en demo llega el OTP', sol.status === 200 && /^\d{6}$/.test(String(sol.data?.demo_otp || '')), JSON.stringify(sol.data));
  const solSinUsr = await call('POST', '/auth/recuperar-solicitar', { body: {} });
  check('Solicitud sin usuario → 400', solSinUsr.status === 400);
  const solInex = await call('POST', '/auth/recuperar-solicitar', { body: { username: 'noexiste-xyz-999' } });
  check('Cuenta inexistente no se revela (200 genérica sin OTP)', solInex.status === 200 && !solInex.data?.demo_otp, JSON.stringify(solInex.data));

  let ultimoWrong = null;
  for (let i = 0; i < 5; i++) {
    ultimoWrong = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: '000000', nuevaClave: 'claveNueva1' } });
  }
  check('Código incorrecto → 401 en cada intento y se bloquea a los 5', ultimoWrong.status === 401, JSON.stringify(ultimoWrong.data));
  const trasBloqueo = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: sol.data?.demo_otp, nuevaClave: 'claveNueva1' } });
  check('Con intentos agotados el código correcto ya no vale', trasBloqueo.status === 400 || trasBloqueo.status === 429, JSON.stringify(trasBloqueo.data));

  const sol2 = await call('POST', '/auth/recuperar-solicitar', { body: { username: reqUsr, canal: 'SMS' } });
  check('Nuevo código tras agotar el anterior', sol2.status === 200 && /^\d{6}$/.test(String(sol2.data?.demo_otp || '')), JSON.stringify(sol2.data));
  const codMal = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: '111111', nuevaClave: 'claveNueva1' } });
  check('Código incorrecto rechazado → 401', codMal.status === 401);
  const cambio = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: sol2.data?.demo_otp, nuevaClave: 'claveNueva1' } });
  check('Cambiar contraseña con código válido → 200', cambio.status === 200, JSON.stringify(cambio.data));
  const loginNueva = await call('POST', '/auth/login', { body: { username: reqUsr, password: 'claveNueva1' } });
  check('Login con la nueva contraseña → 200', loginNueva.status === 200 && loginNueva.data?.user?.tipo === 'cliente', JSON.stringify(loginNueva.data));
  const loginVieja = await call('POST', '/auth/login', { body: { username: reqUsr, password: 'secreto1' } });
  check('La contraseña anterior ya no sirve → 401', loginVieja.status === 401);
  const reuso = await call('POST', '/auth/recuperar-cambiar', { body: { username: reqUsr, codigo: sol2.data?.demo_otp, nuevaClave: 'otraClave123' } });
  check('El código usado no se puede reutilizar', reuso.status === 400, JSON.stringify(reuso.data));

  // --- Datos de pago en línea (tarjeta / transferencia / cheque) ---
  const pedP = await call('POST', '/pedidos', { token: AT, body: { clienteId: cliNuevoId, items: [{ productoId: 2, cantidad: 1 }] } });
  await call('PATCH', `/pedidos/${pedP.data?.pedido_id}/estado`, { token: AT, body: { estado: 'CONFIRMADO' } });
  const facP = await call('POST', '/facturas', { token: AT, body: { pedidoId: pedP.data?.pedido_id } });
  const facPId = facP.data?.factura_id;
  check('Factura nueva para pruebas de pago en línea', facP.status === 201 && !!facPId, JSON.stringify(facP.data));

  const tjFaltan = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA' } });
  check('Tarjeta sin datos → 400 (campos obligatorios)', tjFaltan.status === 400, JSON.stringify(tjFaltan.data));
  const tjCv = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '12', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cliente E2E' } });
  check('Tarjeta con CVV inválido → 400', tjCv.status === 400, JSON.stringify(tjCv.data));
  const tjLuhn = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111112', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cliente E2E' } });
  check('Tarjeta que no pasa Luhn → 400', tjLuhn.status === 400, JSON.stringify(tjLuhn.data));
  const tjVencida = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '01/20', titularTarjeta: 'Cliente E2E' } });
  check('Tarjeta vencida → 400', tjVencida.status === 400, JSON.stringify(tjVencida.data));
  const tjOK = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cliente E2E' } });
  check('Pago con tarjeta válida → 201', tjOK.status === 201, JSON.stringify(tjOK.data));
  const trFaltan = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TRANSFERENCIA' } });
  check('Transferencia sin datos → 400', trFaltan.status === 400, JSON.stringify(trFaltan.data));
  const trOK = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TRANSFERENCIA', banco: 'BancoDemo', numeroCuenta: '1234567890', referencia: 'COMP-E2E-1' } });
  check('Pago por transferencia válido → 201', trOK.status === 201, JSON.stringify(trOK.data));
  const chFaltan = await call('POST', '/mis-pagos', { token: REGT, body: { facturaId: facPId, valor: 1000, metodoPago: 'CHEQUE' } });
  check('Cheque sin banco → 400', chFaltan.status === 400, JSON.stringify(chFaltan.data));

  const tjIntFaltan = await call('POST', '/pagos', { token: AT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA' } });
  check('Interno: tarjeta sin datos → 400 (validación compartida)', tjIntFaltan.status === 400, JSON.stringify(tjIntFaltan.data));
  const tjIntOK = await call('POST', '/pagos', { token: AT, body: { facturaId: facPId, valor: 1000, metodoPago: 'TARJETA', numeroTarjeta: '4111111111111111', codigoSeguridad: '123', banco: 'BancoDemo', vencimientoTarjeta: '12/30', titularTarjeta: 'Cajero' } });
  check('Interno: pago con tarjeta válida → 201', tjIntOK.status === 201, JSON.stringify(tjIntOK.data));
  const chequeInterno = await call('POST', '/pagos', { token: AT, body: { facturaId: facPId, valor: 1000, metodoPago: 'CHEQUE', banco: 'BancoDemo', referencia: 'CHQ-1001' } });
  check('Interno: cheque con banco y número → 201', chequeInterno.status === 201, JSON.stringify(chequeInterno.data));

  const listaP = await call('GET', '/mis-pagos', { token: REGT });
  const tjReg = listaP.data?.find((p) => p.pago_id === tjOK.data?.pago_id);
  check('Se guardan solo los últimos 4 dígitos y la marca de la tarjeta', !!tjReg && tjReg?.ultimos_digitos_tarjeta === '1111' && tjReg?.tipo_tarjeta === 'VISA', JSON.stringify(tjReg));
  const crudo = JSON.stringify(listaP.data);
  check('Nunca se exponen CVV ni número completo de tarjeta', !crudo.includes('codigoSeguridad') && !crudo.includes('4111111111111111'));

  // ---------- Resumen ----------
  console.log(`\n=== Resultado: ${passed} aprobadas, ${failed} fallidas ===\n`);
  if (failed > 0) {
    console.error('Pruebas fallidas:');
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Error ejecutando las pruebas:', err);
  process.exit(1);
});
````

---

## Para terminar

Ya tienes el mapa completo: **qué guarda la base**, **qué reglas aplica el servidor** y **qué dibuja el navegador**, con el código real de cada archivo y ejemplos para entrar a PostgreSQL directamente.

**Resumen mental en una frase:** *el cliente (frontend) pide por HTTP → el servidor (backend) valida con JWT y middlewares, aplica las reglas de negocio sobre los datos que le da PostgreSQL (vista `factura_saldo` incluida) y responde JSON → el navegador dibuja.* Y si quieres "ver el motor", conectas con `docker exec -it finanx-db psql -U finanx -d finanx` y consultas tus tablas.