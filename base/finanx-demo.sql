--
-- PostgreSQL database dump
--

\restrict n67H0SIf4fj0YgUHDHatH8DvTVJVHkpdgljKhsztAx8tpeeO2SUQBs3uOSf4mC7

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_id_fkey;
ALTER TABLE IF EXISTS ONLY public.usuario_cliente DROP CONSTRAINT IF EXISTS usuario_cliente_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recuperaciones_clave DROP CONSTRAINT IF EXISTS recuperaciones_clave_usuario_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pedidos DROP CONSTRAINT IF EXISTS pedidos_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pagos DROP CONSTRAINT IF EXISTS pagos_usuario_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pagos DROP CONSTRAINT IF EXISTS pagos_usuario_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pagos DROP CONSTRAINT IF EXISTS pagos_factura_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notas_credito DROP CONSTRAINT IF EXISTS notas_credito_usuario_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notas_credito DROP CONSTRAINT IF EXISTS notas_credito_usuario_anulacion_fkey;
ALTER TABLE IF EXISTS ONLY public.notas_credito DROP CONSTRAINT IF EXISTS notas_credito_factura_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notas_credito DROP CONSTRAINT IF EXISTS notas_credito_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_usuario_anulacion_fkey;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_pedido_id_fkey;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.detalle_pedido DROP CONSTRAINT IF EXISTS detalle_pedido_producto_id_fkey;
ALTER TABLE IF EXISTS ONLY public.detalle_pedido DROP CONSTRAINT IF EXISTS detalle_pedido_pedido_id_fkey;
DROP INDEX IF EXISTS public.uq_usuarios_username;
DROP INDEX IF EXISTS public.uq_factura_activa_por_pedido;
DROP INDEX IF EXISTS public.idx_recuperaciones_cliente;
DROP INDEX IF EXISTS public.idx_productos_estado;
DROP INDEX IF EXISTS public.idx_pedidos_estado;
DROP INDEX IF EXISTS public.idx_pedidos_cliente;
DROP INDEX IF EXISTS public.idx_pagos_usuario_cliente;
DROP INDEX IF EXISTS public.idx_pagos_fecha;
DROP INDEX IF EXISTS public.idx_pagos_factura;
DROP INDEX IF EXISTS public.idx_notas_credito_factura;
DROP INDEX IF EXISTS public.idx_notas_credito_cliente;
DROP INDEX IF EXISTS public.idx_facturas_pedido;
DROP INDEX IF EXISTS public.idx_facturas_fecha_emision;
DROP INDEX IF EXISTS public.idx_facturas_estado;
DROP INDEX IF EXISTS public.idx_facturas_cliente;
DROP INDEX IF EXISTS public.idx_detalle_pedido_pedido;
DROP INDEX IF EXISTS public.idx_clientes_estado;
DROP INDEX IF EXISTS public.idx_auditoria_fecha;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_pkey;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_correo_key;
ALTER TABLE IF EXISTS ONLY public.usuario_cliente DROP CONSTRAINT IF EXISTS usuario_cliente_username_key;
ALTER TABLE IF EXISTS ONLY public.usuario_cliente DROP CONSTRAINT IF EXISTS usuario_cliente_pkey;
ALTER TABLE IF EXISTS ONLY public.usuario_cliente DROP CONSTRAINT IF EXISTS usuario_cliente_cliente_id_key;
ALTER TABLE IF EXISTS ONLY public.clientes DROP CONSTRAINT IF EXISTS uq_cliente_identificacion;
ALTER TABLE IF EXISTS ONLY public.roles DROP CONSTRAINT IF EXISTS roles_pkey;
ALTER TABLE IF EXISTS ONLY public.roles DROP CONSTRAINT IF EXISTS roles_nombre_key;
ALTER TABLE IF EXISTS ONLY public.recuperaciones_clave DROP CONSTRAINT IF EXISTS recuperaciones_clave_pkey;
ALTER TABLE IF EXISTS ONLY public.productos DROP CONSTRAINT IF EXISTS productos_pkey;
ALTER TABLE IF EXISTS ONLY public.productos DROP CONSTRAINT IF EXISTS productos_codigo_key;
ALTER TABLE IF EXISTS ONLY public.pedidos DROP CONSTRAINT IF EXISTS pedidos_pkey;
ALTER TABLE IF EXISTS ONLY public.pedidos DROP CONSTRAINT IF EXISTS pedidos_numero_pedido_key;
ALTER TABLE IF EXISTS ONLY public.pagos DROP CONSTRAINT IF EXISTS pagos_pkey;
ALTER TABLE IF EXISTS ONLY public.pagos DROP CONSTRAINT IF EXISTS pagos_numero_pago_key;
ALTER TABLE IF EXISTS ONLY public.notas_credito DROP CONSTRAINT IF EXISTS notas_credito_pkey;
ALTER TABLE IF EXISTS ONLY public.notas_credito DROP CONSTRAINT IF EXISTS notas_credito_numero_nota_key;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_pkey;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_numero_factura_key;
ALTER TABLE IF EXISTS ONLY public.detalle_pedido DROP CONSTRAINT IF EXISTS detalle_pedido_pkey;
ALTER TABLE IF EXISTS ONLY public.clientes DROP CONSTRAINT IF EXISTS clientes_pkey;
ALTER TABLE IF EXISTS ONLY public.auditoria DROP CONSTRAINT IF EXISTS auditoria_pkey;
ALTER TABLE IF EXISTS public.usuarios ALTER COLUMN usuario_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.usuario_cliente ALTER COLUMN usuario_cliente_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.roles ALTER COLUMN rol_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.recuperaciones_clave ALTER COLUMN recuperacion_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.productos ALTER COLUMN producto_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pedidos ALTER COLUMN pedido_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pagos ALTER COLUMN pago_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notas_credito ALTER COLUMN nota_credito_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.facturas ALTER COLUMN factura_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.detalle_pedido ALTER COLUMN detalle_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.clientes ALTER COLUMN cliente_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.auditoria ALTER COLUMN auditoria_id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.usuarios_usuario_id_seq;
DROP TABLE IF EXISTS public.usuarios;
DROP SEQUENCE IF EXISTS public.usuario_cliente_usuario_cliente_id_seq;
DROP TABLE IF EXISTS public.usuario_cliente;
DROP SEQUENCE IF EXISTS public.roles_rol_id_seq;
DROP TABLE IF EXISTS public.roles;
DROP SEQUENCE IF EXISTS public.recuperaciones_clave_recuperacion_id_seq;
DROP TABLE IF EXISTS public.recuperaciones_clave;
DROP SEQUENCE IF EXISTS public.productos_producto_id_seq;
DROP TABLE IF EXISTS public.productos;
DROP SEQUENCE IF EXISTS public.pedidos_pedido_id_seq;
DROP TABLE IF EXISTS public.pedidos;
DROP SEQUENCE IF EXISTS public.pagos_pago_id_seq;
DROP SEQUENCE IF EXISTS public.notas_credito_nota_credito_id_seq;
DROP SEQUENCE IF EXISTS public.facturas_factura_id_seq;
DROP VIEW IF EXISTS public.factura_saldo;
DROP TABLE IF EXISTS public.pagos;
DROP TABLE IF EXISTS public.notas_credito;
DROP TABLE IF EXISTS public.facturas;
DROP SEQUENCE IF EXISTS public.detalle_pedido_detalle_id_seq;
DROP TABLE IF EXISTS public.detalle_pedido;
DROP SEQUENCE IF EXISTS public.clientes_cliente_id_seq;
DROP TABLE IF EXISTS public.clientes;
DROP SEQUENCE IF EXISTS public.auditoria_auditoria_id_seq;
DROP TABLE IF EXISTS public.auditoria;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    auditoria_id integer NOT NULL,
    usuario character varying(200),
    usuario_tipo character varying(20) DEFAULT 'INTERNO'::character varying NOT NULL,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    modulo character varying(50),
    operacion character varying(30),
    registro_afectado character varying(50),
    descripcion text,
    ip inet,
    user_agent text,
    CONSTRAINT ck_auditoria_usuario_tipo CHECK (((usuario_tipo)::text = ANY ((ARRAY['INTERNO'::character varying, 'CLIENTE'::character varying])::text[])))
);


--
-- Name: auditoria_auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_auditoria_id_seq OWNED BY public.auditoria.auditoria_id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    cliente_id integer NOT NULL,
    tipo_cliente character varying(20) DEFAULT 'PERSONA'::character varying NOT NULL,
    tipo_identificacion character varying(20) DEFAULT 'CC'::character varying NOT NULL,
    numero_identificacion character varying(30) NOT NULL,
    nombre_razon_social character varying(200) NOT NULL,
    telefono character varying(30),
    correo character varying(150),
    direccion character varying(200),
    ciudad character varying(100),
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_clientes_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[])))
);


--
-- Name: clientes_cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clientes_cliente_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientes_cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clientes_cliente_id_seq OWNED BY public.clientes.cliente_id;


--
-- Name: detalle_pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_pedido (
    detalle_id integer NOT NULL,
    pedido_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad numeric(12,2) NOT NULL,
    precio_unitario numeric(14,2) NOT NULL,
    subtotal numeric(14,2) NOT NULL,
    CONSTRAINT detalle_pedido_cantidad_check CHECK ((cantidad > (0)::numeric))
);


--
-- Name: detalle_pedido_detalle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_pedido_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_pedido_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_pedido_detalle_id_seq OWNED BY public.detalle_pedido.detalle_id;


--
-- Name: facturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facturas (
    factura_id integer NOT NULL,
    numero_factura character varying(20),
    pedido_id integer NOT NULL,
    cliente_id integer NOT NULL,
    fecha_emision timestamp with time zone DEFAULT now() NOT NULL,
    fecha_vencimiento date,
    subtotal numeric(14,2) NOT NULL,
    impuestos numeric(14,2) NOT NULL,
    total numeric(14,2) NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVA'::character varying NOT NULL,
    motivo_anulacion text,
    fecha_anulacion timestamp with time zone,
    usuario_anulacion integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_facturas_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVA'::character varying, 'ANULADA'::character varying])::text[])))
);


--
-- Name: notas_credito; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notas_credito (
    nota_credito_id integer NOT NULL,
    numero_nota character varying(20),
    factura_id integer NOT NULL,
    cliente_id integer NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    valor numeric(14,2) NOT NULL,
    motivo text NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVA'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id integer,
    fecha_anulacion timestamp with time zone,
    usuario_anulacion integer,
    motivo_anulacion text,
    CONSTRAINT ck_notas_credito_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVA'::character varying, 'ANULADA'::character varying])::text[]))),
    CONSTRAINT notas_credito_valor_check CHECK ((valor > (0)::numeric))
);


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    pago_id integer NOT NULL,
    numero_pago character varying(20),
    factura_id integer NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    valor numeric(14,2) NOT NULL,
    metodo_pago character varying(30) NOT NULL,
    referencia character varying(60),
    observaciones text,
    usuario_id integer,
    usuario_cliente_id integer,
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    banco text,
    titular text,
    tipo_tarjeta text,
    ultimos_digitos_tarjeta text,
    vencimiento_tarjeta text,
    numero_cuenta text,
    CONSTRAINT ck_pagos_metodo CHECK (((metodo_pago)::text = ANY ((ARRAY['EFECTIVO'::character varying, 'TARJETA'::character varying, 'TRANSFERENCIA'::character varying, 'CHEQUE'::character varying])::text[]))),
    CONSTRAINT pagos_valor_check CHECK ((valor > (0)::numeric))
);


--
-- Name: factura_saldo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.factura_saldo AS
 SELECT f.factura_id,
    f.numero_factura,
    f.pedido_id,
    f.cliente_id,
    f.fecha_emision,
    f.fecha_vencimiento,
    (f.subtotal)::double precision AS subtotal,
    (f.impuestos)::double precision AS impuestos,
    (f.total)::double precision AS total,
    (COALESCE(pg.valor_pagado, (0)::numeric))::double precision AS valor_pagado,
    (((f.total - COALESCE(pg.valor_pagado, (0)::numeric)) + COALESCE(nc.notas_credito, (0)::numeric)))::double precision AS saldo,
    f.estado,
        CASE
            WHEN ((f.estado)::text = 'ANULADA'::text) THEN 'ANULADA'::text
            WHEN ((COALESCE(pg.valor_pagado, (0)::numeric) - COALESCE(nc.notas_credito, (0)::numeric)) <= (0)::numeric) THEN 'PENDIENTE'::text
            WHEN (((f.total - COALESCE(pg.valor_pagado, (0)::numeric)) + COALESCE(nc.notas_credito, (0)::numeric)) <= (0)::numeric) THEN 'PAGADA'::text
            ELSE 'PAGO_PARCIAL'::text
        END AS estado_pago,
    f.motivo_anulacion,
    f.fecha_anulacion,
    (COALESCE(nc.notas_credito, (0)::numeric))::double precision AS notas_credito
   FROM ((public.facturas f
     LEFT JOIN ( SELECT pagos.factura_id,
            sum(pagos.valor) AS valor_pagado
           FROM public.pagos
          GROUP BY pagos.factura_id) pg ON ((pg.factura_id = f.factura_id)))
     LEFT JOIN ( SELECT notas_credito.factura_id,
            sum(notas_credito.valor) AS notas_credito
           FROM public.notas_credito
          WHERE ((notas_credito.estado)::text = 'ACTIVA'::text)
          GROUP BY notas_credito.factura_id) nc ON ((nc.factura_id = f.factura_id)));


--
-- Name: facturas_factura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facturas_factura_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facturas_factura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facturas_factura_id_seq OWNED BY public.facturas.factura_id;


--
-- Name: notas_credito_nota_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notas_credito_nota_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notas_credito_nota_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notas_credito_nota_credito_id_seq OWNED BY public.notas_credito.nota_credito_id;


--
-- Name: pagos_pago_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_pago_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_pago_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_pago_id_seq OWNED BY public.pagos.pago_id;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    pedido_id integer NOT NULL,
    numero_pedido character varying(20),
    cliente_id integer NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    impuestos numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'BORRADOR'::character varying NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_pedidos_estado CHECK (((estado)::text = ANY ((ARRAY['BORRADOR'::character varying, 'CONFIRMADO'::character varying, 'CANCELADO'::character varying, 'FACTURADO'::character varying])::text[])))
);


--
-- Name: pedidos_pedido_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedidos_pedido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedidos_pedido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedidos_pedido_id_seq OWNED BY public.pedidos.pedido_id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    producto_id integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    categoria character varying(60),
    precio numeric(14,2) NOT NULL,
    impuesto numeric(5,2) DEFAULT 0 NOT NULL,
    unidad_medida character varying(20) DEFAULT 'UND'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_productos_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[]))),
    CONSTRAINT productos_impuesto_check CHECK (((impuesto >= (0)::numeric) AND (impuesto <= (100)::numeric))),
    CONSTRAINT productos_precio_check CHECK ((precio >= (0)::numeric))
);


--
-- Name: productos_producto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_producto_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_producto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_producto_id_seq OWNED BY public.productos.producto_id;


--
-- Name: recuperaciones_clave; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recuperaciones_clave (
    recuperacion_id integer NOT NULL,
    usuario_cliente_id integer NOT NULL,
    canal character varying(10) NOT NULL,
    codigo_hash text NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    usado boolean DEFAULT false NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recuperaciones_clave_canal_check CHECK (((canal)::text = ANY ((ARRAY['EMAIL'::character varying, 'SMS'::character varying])::text[])))
);


--
-- Name: recuperaciones_clave_recuperacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recuperaciones_clave_recuperacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recuperaciones_clave_recuperacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recuperaciones_clave_recuperacion_id_seq OWNED BY public.recuperaciones_clave.recuperacion_id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    rol_id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion text
);


--
-- Name: roles_rol_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_rol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_rol_id_seq OWNED BY public.roles.rol_id;


--
-- Name: usuario_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_cliente (
    usuario_cliente_id integer NOT NULL,
    cliente_id integer NOT NULL,
    username character varying(150) NOT NULL,
    password_hash text NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_acceso timestamp with time zone,
    token_version integer DEFAULT 1 NOT NULL,
    debe_cambiar_clave boolean DEFAULT false NOT NULL,
    clave_actualizada_en timestamp with time zone,
    fallos_login integer DEFAULT 0 NOT NULL,
    bloqueado_hasta timestamp with time zone,
    CONSTRAINT ck_usuario_cliente_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[])))
);


--
-- Name: usuario_cliente_usuario_cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_cliente_usuario_cliente_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_cliente_usuario_cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_cliente_usuario_cliente_id_seq OWNED BY public.usuario_cliente.usuario_cliente_id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    usuario_id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    correo character varying(150) NOT NULL,
    password_hash text NOT NULL,
    rol_id integer NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    token_version integer DEFAULT 1 NOT NULL,
    username character varying(60),
    debe_cambiar_clave boolean DEFAULT false NOT NULL,
    clave_actualizada_en timestamp with time zone,
    fallos_login integer DEFAULT 0 NOT NULL,
    bloqueado_hasta timestamp with time zone,
    CONSTRAINT ck_usuarios_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[]))),
    CONSTRAINT ck_usuarios_username CHECK (((username IS NULL) OR ((username)::text ~ '^[a-z0-9._-]{3,32}$'::text)))
);


--
-- Name: usuarios_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_usuario_id_seq OWNED BY public.usuarios.usuario_id;


--
-- Name: auditoria auditoria_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN auditoria_id SET DEFAULT nextval('public.auditoria_auditoria_id_seq'::regclass);


--
-- Name: clientes cliente_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes ALTER COLUMN cliente_id SET DEFAULT nextval('public.clientes_cliente_id_seq'::regclass);


--
-- Name: detalle_pedido detalle_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido ALTER COLUMN detalle_id SET DEFAULT nextval('public.detalle_pedido_detalle_id_seq'::regclass);


--
-- Name: facturas factura_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas ALTER COLUMN factura_id SET DEFAULT nextval('public.facturas_factura_id_seq'::regclass);


--
-- Name: notas_credito nota_credito_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_credito ALTER COLUMN nota_credito_id SET DEFAULT nextval('public.notas_credito_nota_credito_id_seq'::regclass);


--
-- Name: pagos pago_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos ALTER COLUMN pago_id SET DEFAULT nextval('public.pagos_pago_id_seq'::regclass);


--
-- Name: pedidos pedido_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN pedido_id SET DEFAULT nextval('public.pedidos_pedido_id_seq'::regclass);


--
-- Name: productos producto_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN producto_id SET DEFAULT nextval('public.productos_producto_id_seq'::regclass);


--
-- Name: recuperaciones_clave recuperacion_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recuperaciones_clave ALTER COLUMN recuperacion_id SET DEFAULT nextval('public.recuperaciones_clave_recuperacion_id_seq'::regclass);


--
-- Name: roles rol_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN rol_id SET DEFAULT nextval('public.roles_rol_id_seq'::regclass);


--
-- Name: usuario_cliente usuario_cliente_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_cliente ALTER COLUMN usuario_cliente_id SET DEFAULT nextval('public.usuario_cliente_usuario_cliente_id_seq'::regclass);


--
-- Name: usuarios usuario_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN usuario_id SET DEFAULT nextval('public.usuarios_usuario_id_seq'::regclass);


--
-- Data for Name: auditoria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auditoria (auditoria_id, usuario, usuario_tipo, fecha_hora, modulo, operacion, registro_afectado, descripcion, ip, user_agent) FROM stdin;
\.


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clientes (cliente_id, tipo_cliente, tipo_identificacion, numero_identificacion, nombre_razon_social, telefono, correo, direccion, ciudad, estado, fecha_creacion) FROM stdin;
1	EMPRESA	NIT	900000000-0	Cliente General	\N	cliente@finanx.local	\N	\N	ACTIVO	2026-11-02 21:33:18.041286+00
2	PERSONA	CC	1002003001	María Fernanda López	3115550101	maria.lopez@example.com	Calle 10 # 5-20	Bogotá	ACTIVO	2026-11-02 21:33:19.483547+00
3	EMPRESA	NIT	901234567	TecnoAndina S.A.S.	6015558899	ventas@tecnoandina.co	Av. 68 # 80-10	Medellín	ACTIVO	2026-11-02 21:33:19.484878+00
\.


--
-- Data for Name: detalle_pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.detalle_pedido (detalle_id, pedido_id, producto_id, cantidad, precio_unitario, subtotal) FROM stdin;
1	1	1	1.00	500000.00	500000.00
2	2	1	1.00	850000.00	850000.00
3	3	1	1.00	1200000.00	1200000.00
4	4	1	1.00	1550000.00	1550000.00
5	5	1	1.00	1900000.00	1900000.00
6	6	1	1.00	2250000.00	2250000.00
\.


--
-- Data for Name: facturas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.facturas (factura_id, numero_factura, pedido_id, cliente_id, fecha_emision, fecha_vencimiento, subtotal, impuestos, total, estado, motivo_anulacion, fecha_anulacion, usuario_anulacion, fecha_creacion) FROM stdin;
1	FAC-DEMO-001	1	1	2026-06-02 21:34:12.684835+00	2026-07-02	500000.00	95000.00	595000.00	ACTIVA	\N	\N	\N	2026-11-02 21:34:12.684835+00
2	FAC-DEMO-002	2	2	2026-07-02 21:34:12.684835+00	2026-08-01	850000.00	161500.00	1011500.00	ACTIVA	\N	\N	\N	2026-11-02 21:34:12.684835+00
3	FAC-DEMO-003	3	1	2026-08-02 21:34:12.684835+00	2026-09-01	1200000.00	228000.00	1428000.00	ACTIVA	\N	\N	\N	2026-11-02 21:34:12.684835+00
4	FAC-DEMO-004	4	2	2026-09-02 21:34:12.684835+00	2026-10-02	1550000.00	294500.00	1844500.00	ACTIVA	\N	\N	\N	2026-11-02 21:34:12.684835+00
5	FAC-DEMO-005	5	1	2026-10-02 21:34:12.684835+00	2026-11-01	1900000.00	361000.00	2261000.00	ACTIVA	\N	\N	\N	2026-11-02 21:34:12.684835+00
6	FAC-DEMO-006	6	2	2026-11-02 21:34:12.684835+00	2026-12-02	2250000.00	427500.00	2677500.00	ACTIVA	\N	\N	\N	2026-11-02 21:34:12.684835+00
\.


--
-- Data for Name: notas_credito; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notas_credito (nota_credito_id, numero_nota, factura_id, cliente_id, fecha, valor, motivo, estado, fecha_creacion, usuario_id, fecha_anulacion, usuario_anulacion, motivo_anulacion) FROM stdin;
\.


--
-- Data for Name: pagos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pagos (pago_id, numero_pago, factura_id, fecha, valor, metodo_pago, referencia, observaciones, usuario_id, usuario_cliente_id, fecha_registro, banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta, numero_cuenta) FROM stdin;
1	PAG-DEMO-001	1	2026-06-06 21:34:12.684835+00	595000.00	EFECTIVO	DEMO-001	Pago de demostración	\N	\N	2026-11-02 21:34:12.684835+00	\N	\N	\N	\N	\N	\N
2	PAG-DEMO-003	3	2026-08-06 21:34:12.684835+00	1428000.00	TARJETA	DEMO-003	Pago de demostración	\N	\N	2026-11-02 21:34:12.684835+00	\N	\N	\N	\N	\N	\N
3	PAG-DEMO-004	4	2026-09-06 21:34:12.684835+00	1844500.00	EFECTIVO	DEMO-004	Pago de demostración	\N	\N	2026-11-02 21:34:12.684835+00	\N	\N	\N	\N	\N	\N
4	PAG-DEMO-006	6	2026-11-06 21:34:12.684835+00	2677500.00	TARJETA	DEMO-006	Pago de demostración	\N	\N	2026-11-02 21:34:12.684835+00	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pedidos (pedido_id, numero_pedido, cliente_id, fecha, subtotal, impuestos, total, estado, observaciones, fecha_creacion) FROM stdin;
1	PED-DEMO-001	1	2026-06-02 21:34:12.684835+00	500000.00	95000.00	595000.00	FACTURADO	\N	2026-11-02 21:34:12.684835+00
2	PED-DEMO-002	2	2026-07-02 21:34:12.684835+00	850000.00	161500.00	1011500.00	FACTURADO	\N	2026-11-02 21:34:12.684835+00
3	PED-DEMO-003	1	2026-08-02 21:34:12.684835+00	1200000.00	228000.00	1428000.00	FACTURADO	\N	2026-11-02 21:34:12.684835+00
4	PED-DEMO-004	2	2026-09-02 21:34:12.684835+00	1550000.00	294500.00	1844500.00	FACTURADO	\N	2026-11-02 21:34:12.684835+00
5	PED-DEMO-005	1	2026-10-02 21:34:12.684835+00	1900000.00	361000.00	2261000.00	FACTURADO	\N	2026-11-02 21:34:12.684835+00
6	PED-DEMO-006	2	2026-11-02 21:34:12.684835+00	2250000.00	427500.00	2677500.00	FACTURADO	\N	2026-11-02 21:34:12.684835+00
\.


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.productos (producto_id, codigo, nombre, descripcion, categoria, precio, impuesto, unidad_medida, estado, fecha_creacion, fecha_actualizacion) FROM stdin;
1	PROD-001	Laptop 15" 16GB	Portátil con SSD 512GB	Cómputo	4500000.00	19.00	UND	ACTIVO	2026-11-02 21:33:19.708997+00	2026-11-02 21:33:19.708997+00
2	PROD-002	Mouse inalámbrico	Mouse óptico 2.4GHz	Accesorios	120000.00	19.00	UND	ACTIVO	2026-11-02 21:33:19.712059+00	2026-11-02 21:33:19.712059+00
3	PROD-003	Teclado mecánico	Teclado RGB español	Accesorios	280000.00	19.00	UND	ACTIVO	2026-11-02 21:33:19.713128+00	2026-11-02 21:33:19.713128+00
4	PROD-004	Monitor 27" 4K	Monitor IPS 60Hz	Cómputo	2100000.00	19.00	UND	ACTIVO	2026-11-02 21:33:19.714085+00	2026-11-02 21:33:19.714085+00
5	PROD-005	Servicio de soporte	Hora técnica especializada	Servicios	150000.00	0.00	HORA	ACTIVO	2026-11-02 21:33:19.715039+00	2026-11-02 21:33:19.715039+00
\.


--
-- Data for Name: recuperaciones_clave; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recuperaciones_clave (recuperacion_id, usuario_cliente_id, canal, codigo_hash, intentos, usado, expira_en, creado_en) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (rol_id, nombre, descripcion) FROM stdin;
1	ADMIN	Administración del sistema y gestión de usuarios
2	FACTURADOR	Gestión de clientes, pedidos y facturas
3	CAJERO	Registro y consulta de pagos y saldos
4	SUPERVISOR	Consulta de información financiera, historial y reportes
\.


--
-- Data for Name: usuario_cliente; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuario_cliente (usuario_cliente_id, cliente_id, username, password_hash, estado, fecha_creacion, ultimo_acceso, token_version, debe_cambiar_clave, clave_actualizada_en, fallos_login, bloqueado_hasta) FROM stdin;
1	1	cliente	$2a$12$BGNM0uuw31g6TKfKqXktdOLSOc/wFc4N.d1qAnTivHQUWP.ktKt4m	ACTIVO	2026-11-02 21:33:18.283855+00	\N	1	t	\N	0	\N
2	2	cliente@finanx.test	$2a$12$RZI/pwVPOD9yYpXOkJ1zteCR0/zhpPXA.JCm/4B58elbnNPqGMl1.	ACTIVO	2026-11-02 21:33:19.707257+00	\N	1	f	\N	0	\N
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (usuario_id, nombre, correo, password_hash, rol_id, estado, fecha_creacion, token_version, username, debe_cambiar_clave, clave_actualizada_en, fallos_login, bloqueado_hasta) FROM stdin;
1	Administrador del sistema	admin@finanx.local	$2a$12$i3PpEikuoIJ4/IcoMq2Y1e46i0Qz1/ADzVHwiqhmwUVcx.82s.cV.	1	ACTIVO	2026-11-02 21:33:17.368135+00	1	admin	t	\N	0	\N
2	Facturación	facturacion@finanx.local	$2a$12$jjk2ImqJH21UT4quWgJTWuYkk/St9ln0nNp4VlfhStUZHKWkwpIRW	2	ACTIVO	2026-11-02 21:33:17.591153+00	1	facturacion	t	\N	0	\N
3	Caja	caja@finanx.local	$2a$12$tgE9zlr3vO6ezMQ7GeFiU.cl2vit2yL9mX0CVbnzt/t3o9NA92e8q	3	ACTIVO	2026-11-02 21:33:17.815925+00	1	caja	t	\N	0	\N
4	Supervisión	supervision@finanx.local	$2a$12$Md2a.mI56WMFheUpFwhhZeEJaviQ4c8rFJmYk1hOrkAA8j0hR.H6q	4	ACTIVO	2026-11-02 21:33:18.038169+00	1	supervision	t	\N	0	\N
5	Administrador	admin@finanx.test	$2a$12$f8qoL3r.2AsNtZ740BKF.u.tsClqe8CmzCB4w9J1Hxq1xouRun7ly	1	ACTIVO	2026-11-02 21:33:18.805753+00	1	demo.admin	f	\N	0	\N
6	Facturador	facturador@finanx.test	$2a$12$Sac4Ab5ANpXiVTKQs.LVBOSERu1r66IO1DLzbI1JeU96upqE.j456	2	ACTIVO	2026-11-02 21:33:19.032214+00	1	demo.facturador	f	\N	0	\N
7	Cajero	cajero@finanx.test	$2a$12$2xALvy/VtmKmxGo54PnAU.QpULDOfKRLbBp7Vk68VY/HfoSoYdnmC	3	ACTIVO	2026-11-02 21:33:19.256229+00	1	demo.cajero	f	\N	0	\N
8	Supervisor	supervisor@finanx.test	$2a$12$fk3zPdEXTqDGNqnW1JmMF.xTavI.tujnWnwPLWyEUG79pI6ZmnECK	4	ACTIVO	2026-11-02 21:33:19.479671+00	1	demo.supervisor	f	\N	0	\N
\.


--
-- Name: auditoria_auditoria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auditoria_auditoria_id_seq', 1, false);


--
-- Name: clientes_cliente_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clientes_cliente_id_seq', 3, true);


--
-- Name: detalle_pedido_detalle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.detalle_pedido_detalle_id_seq', 6, true);


--
-- Name: facturas_factura_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.facturas_factura_id_seq', 6, true);


--
-- Name: notas_credito_nota_credito_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notas_credito_nota_credito_id_seq', 1, false);


--
-- Name: pagos_pago_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pagos_pago_id_seq', 4, true);


--
-- Name: pedidos_pedido_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pedidos_pedido_id_seq', 6, true);


--
-- Name: productos_producto_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.productos_producto_id_seq', 5, true);


--
-- Name: recuperaciones_clave_recuperacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recuperaciones_clave_recuperacion_id_seq', 1, false);


--
-- Name: roles_rol_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_rol_id_seq', 8, true);


--
-- Name: usuario_cliente_usuario_cliente_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuario_cliente_usuario_cliente_id_seq', 2, true);


--
-- Name: usuarios_usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuarios_usuario_id_seq', 8, true);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (auditoria_id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (cliente_id);


--
-- Name: detalle_pedido detalle_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_pkey PRIMARY KEY (detalle_id);


--
-- Name: facturas facturas_numero_factura_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_numero_factura_key UNIQUE (numero_factura);


--
-- Name: facturas facturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_pkey PRIMARY KEY (factura_id);


--
-- Name: notas_credito notas_credito_numero_nota_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_credito
    ADD CONSTRAINT notas_credito_numero_nota_key UNIQUE (numero_nota);


--
-- Name: notas_credito notas_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_credito
    ADD CONSTRAINT notas_credito_pkey PRIMARY KEY (nota_credito_id);


--
-- Name: pagos pagos_numero_pago_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_numero_pago_key UNIQUE (numero_pago);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (pago_id);


--
-- Name: pedidos pedidos_numero_pedido_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_numero_pedido_key UNIQUE (numero_pedido);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (pedido_id);


--
-- Name: productos productos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (producto_id);


--
-- Name: recuperaciones_clave recuperaciones_clave_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recuperaciones_clave
    ADD CONSTRAINT recuperaciones_clave_pkey PRIMARY KEY (recuperacion_id);


--
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (rol_id);


--
-- Name: clientes uq_cliente_identificacion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT uq_cliente_identificacion UNIQUE (tipo_identificacion, numero_identificacion);


--
-- Name: usuario_cliente usuario_cliente_cliente_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_cliente
    ADD CONSTRAINT usuario_cliente_cliente_id_key UNIQUE (cliente_id);


--
-- Name: usuario_cliente usuario_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_cliente
    ADD CONSTRAINT usuario_cliente_pkey PRIMARY KEY (usuario_cliente_id);


--
-- Name: usuario_cliente usuario_cliente_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_cliente
    ADD CONSTRAINT usuario_cliente_username_key UNIQUE (username);


--
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (usuario_id);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_fecha ON public.auditoria USING btree (fecha_hora DESC);


--
-- Name: idx_clientes_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_estado ON public.clientes USING btree (estado);


--
-- Name: idx_detalle_pedido_pedido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_detalle_pedido_pedido ON public.detalle_pedido USING btree (pedido_id);


--
-- Name: idx_facturas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facturas_cliente ON public.facturas USING btree (cliente_id);


--
-- Name: idx_facturas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facturas_estado ON public.facturas USING btree (estado);


--
-- Name: idx_facturas_fecha_emision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facturas_fecha_emision ON public.facturas USING btree (fecha_emision);


--
-- Name: idx_facturas_pedido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facturas_pedido ON public.facturas USING btree (pedido_id);


--
-- Name: idx_notas_credito_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_credito_cliente ON public.notas_credito USING btree (cliente_id);


--
-- Name: idx_notas_credito_factura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notas_credito_factura ON public.notas_credito USING btree (factura_id);


--
-- Name: idx_pagos_factura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_factura ON public.pagos USING btree (factura_id);


--
-- Name: idx_pagos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_fecha ON public.pagos USING btree (fecha);


--
-- Name: idx_pagos_usuario_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagos_usuario_cliente ON public.pagos USING btree (usuario_cliente_id);


--
-- Name: idx_pedidos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_cliente ON public.pedidos USING btree (cliente_id);


--
-- Name: idx_pedidos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_estado ON public.pedidos USING btree (estado);


--
-- Name: idx_productos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_estado ON public.productos USING btree (estado);


--
-- Name: idx_recuperaciones_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recuperaciones_cliente ON public.recuperaciones_clave USING btree (usuario_cliente_id, usado);


--
-- Name: uq_factura_activa_por_pedido; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_factura_activa_por_pedido ON public.facturas USING btree (pedido_id) WHERE ((estado)::text = 'ACTIVA'::text);


--
-- Name: uq_usuarios_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_usuarios_username ON public.usuarios USING btree (lower((username)::text)) WHERE (username IS NOT NULL);


--
-- Name: detalle_pedido detalle_pedido_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(pedido_id) ON DELETE CASCADE;


--
-- Name: detalle_pedido detalle_pedido_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(producto_id);


--
-- Name: facturas facturas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(cliente_id);


--
-- Name: facturas facturas_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(pedido_id);


--
-- Name: facturas facturas_usuario_anulacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_usuario_anulacion_fkey FOREIGN KEY (usuario_anulacion) REFERENCES public.usuarios(usuario_id);


--
-- Name: notas_credito notas_credito_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_credito
    ADD CONSTRAINT notas_credito_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(cliente_id);


--
-- Name: notas_credito notas_credito_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_credito
    ADD CONSTRAINT notas_credito_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas(factura_id);


--
-- Name: notas_credito notas_credito_usuario_anulacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_credito
    ADD CONSTRAINT notas_credito_usuario_anulacion_fkey FOREIGN KEY (usuario_anulacion) REFERENCES public.usuarios(usuario_id);


--
-- Name: notas_credito notas_credito_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_credito
    ADD CONSTRAINT notas_credito_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: pagos pagos_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas(factura_id);


--
-- Name: pagos pagos_usuario_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_usuario_cliente_id_fkey FOREIGN KEY (usuario_cliente_id) REFERENCES public.usuario_cliente(usuario_cliente_id);


--
-- Name: pagos pagos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(usuario_id);


--
-- Name: pedidos pedidos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(cliente_id);


--
-- Name: recuperaciones_clave recuperaciones_clave_usuario_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recuperaciones_clave
    ADD CONSTRAINT recuperaciones_clave_usuario_cliente_id_fkey FOREIGN KEY (usuario_cliente_id) REFERENCES public.usuario_cliente(usuario_cliente_id) ON DELETE CASCADE;


--
-- Name: usuario_cliente usuario_cliente_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_cliente
    ADD CONSTRAINT usuario_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(cliente_id);


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(rol_id);


--
-- PostgreSQL database dump complete
--

\unrestrict n67H0SIf4fj0YgUHDHatH8DvTVJVHkpdgljKhsztAx8tpeeO2SUQBs3uOSf4mC7

