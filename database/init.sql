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