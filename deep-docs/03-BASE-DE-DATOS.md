# 3 · Base de datos

PostgreSQL **16** (imagen `postgres:16-alpine`). Esquema en `database/init.sql` (251 líneas).
Credenciales: usuario `finanx`, password `finanx`, BD `finanx`.

> 💡 **Fuente única de verdad del modelo:** `database/init.sql`. Todo lo demás (rutas, frontend)
> se adapta a él.

> ✅ **Actualización importante sobre la vista `factura_saldo`.** El `SELECT` que se muestra más abajo
> es la versión **original**, que tenía un **producto cartesiano** (dos `LEFT JOIN` a tablas hijas en la
> misma consulta) y **ya está corregido** en el commit `5877ef8`: ahora `pagos` y `notas_credito` se
> agregan en **subconsultas independientes**. El texto se conserva porque explica la semántica del
> saldo (que no cambia). Ver [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md) →
> *Estado de la corrección*.

## Las 11 tablas

### 1. `roles`
Catálogo de roles internos.

| Columna | Tipo | Restricciones |
|---|---|---|
| `rol_id` | SERIAL | PK |
| `nombre` | VARCHAR(50) | **UNIQUE** NOT NULL |
| `descripcion` | TEXT | |

### 2. `usuarios`
Usuarios **internos** (Administrador, Facturador, Cajero, Supervisor).

| Columna | Tipo | Restricciones |
|---|---|---|
| `usuario_id` | SERIAL | PK |
| `nombre` | VARCHAR(120) | NOT NULL |
| `correo` | VARCHAR(150) | **UNIQUE** NOT NULL |
| `password_hash` | TEXT | NOT NULL (bcrypt) |
| `rol_id` | INT | **FK → `roles`** NOT NULL |
| `estado` | VARCHAR(20) | DEFAULT `'ACTIVO'` |
| `fecha_creacion` | TIMESTAMPTZ | DEFAULT NOW() |

### 3. `clientes`

| Columna | Tipo | Restricciones |
|---|---|---|
| `cliente_id` | SERIAL | PK |
| `tipo_cliente` | VARCHAR(20) | DEFAULT `'PERSONA'` — PERSONA / EMPRESA |
| `tipo_identificacion` | VARCHAR(20) | DEFAULT `'CC'` — CC / NIT / CE / PASAPORTE |
| `numero_identificacion` | VARCHAR(30) | NOT NULL |
| `nombre_razon_social` | VARCHAR(200) | NOT NULL |
| `telefono`, `correo`, `direccion`, `ciudad` | VARCHAR | |
| `estado` | VARCHAR(20) | DEFAULT `'ACTIVO'` — ACTIVO / INACTIVO |
| `fecha_creacion` | TIMESTAMPTZ | DEFAULT NOW() |
| — | — | **CONSTRAINT `uq_cliente_identificacion` UNIQUE (`tipo_identificacion`, `numero_identificacion`)** |

> 🔑 Esta restricción **compuesta** es la que implementa la regla de "cliente duplicado → 409".
> Se valida dos veces: consulta previa en `clientes.js` + el UNIQUE en la BD (defensa en profundidad).

### 4. `usuario_cliente`
Cuentas de acceso del cliente al portal. Relación **CLIENTE 1 ──── 0..1 USUARIO_CLIENTE**.

| Columna | Tipo | Restricciones |
|---|---|---|
| `usuario_cliente_id` | SERIAL | PK |
| `cliente_id` | INT | **UNIQUE** (¡esto es lo que fuerza el 0..1!) → FK `clientes` NOT NULL |
| `username` | VARCHAR(150) | **UNIQUE** NOT NULL |
| `password_hash` | TEXT | NOT NULL |
| `estado` | VARCHAR(20) | DEFAULT `'ACTIVO'` |
| `fecha_creacion` | TIMESTAMPTZ | DEFAULT NOW() |
| `ultimo_acceso` | TIMESTAMPTZ | nullable |

> ⚠️ Fíjate en el detalle: `username` es **UNIQUE pero no se compara con `usuarios.correo`**. Es una
> tabla separada de `usuarios`, así que técnicamente un mismo correo podría existir como usuario
> interno y como cuenta de cliente. No es un bug, pero conviene saberlo.

### 5. `productos`

| Columna | Tipo | Restricciones |
|---|---|---|
| `producto_id` | SERIAL | PK |
| `codigo` | VARCHAR(30) | **UNIQUE** NOT NULL |
| `nombre` | VARCHAR(150) | NOT NULL |
| `descripcion` | TEXT | |
| `categoria` | VARCHAR(60) | |
| `precio` | NUMERIC(14,2) | NOT NULL **CHECK (precio >= 0)** |
| `impuesto` | NUMERIC(5,2) | DEFAULT 0 **CHECK (impuesto >= 0 AND impuesto <= 100)** — es un **porcentaje** |
| `unidad_medida` | VARCHAR(20) | DEFAULT `'UND'` |
| `estado` | VARCHAR(20) | DEFAULT `'ACTIVO'` |
| `fecha_creacion` / `fecha_actualizacion` | TIMESTAMPTZ | DEFAULT NOW() |

### 6. `pedidos`

| Columna | Tipo | Restricciones |
|---|---|---|
| `pedido_id` | SERIAL | PK |
| `numero_pedido` | VARCHAR(20) | UNIQUE |
| `cliente_id` | INT | **FK → `clientes`** NOT NULL |
| `fecha` | TIMESTAMPTZ | DEFAULT NOW() |
| `subtotal`, `impuestos`, `total` | NUMERIC(14,2) | NOT NULL DEFAULT 0 |
| `estado` | VARCHAR(20) | DEFAULT `'BORRADOR'` — BORRADOR / CONFIRMADO / CANCELADO / FACTURADO |
| `observaciones` | TEXT | |
| `fecha_creacion` | TIMESTAMPTZ | DEFAULT NOW() |

### 7. `detalle_pedido` (líneas del pedido)

| Columna | Tipo | Restricciones |
|---|---|---|
| `detalle_id` | SERIAL | PK |
| `pedido_id` | INT | **FK → `pedidos` ON DELETE CASCADE** NOT NULL |
| `producto_id` | INT | **FK → `productos`** NOT NULL |
| `cantidad` | NUMERIC(12,2) | NOT NULL **CHECK (cantidad > 0)** |
| `precio_unitario` | NUMERIC(14,2) | NOT NULL (copia del precio al momento de la venta) |
| `subtotal` | NUMERIC(14,2) | NOT NULL |

### 8. `facturas`
Relación **PEDIDO 1 ─── 0..1 FACTURA**.

| Columna | Tipo | Restricciones |
|---|---|---|
| `factura_id` | SERIAL | PK |
| `numero_factura` | VARCHAR(20) | UNIQUE |
| `pedido_id` | INT | **UNIQUE** + **FK → `pedidos`** NOT NULL |
| `cliente_id` | INT | **FK → `clientes`** NOT NULL |
| `fecha_emision` | TIMESTAMPTZ | DEFAULT NOW() |
| `fecha_vencimiento` | DATE | |
| `subtotal`, `impuestos`, `total` | NUMERIC(14,2) | NOT NULL |
| `estado` | VARCHAR(20) | DEFAULT `'ACTIVA'` — ACTIVA / ANULADA |
| `motivo_anulacion` | TEXT | |
| `fecha_anulacion` | TIMESTAMPTZ | |
| `usuario_anulacion` | INT | FK → `usuarios` |
| `fecha_creacion` | TIMESTAMPTZ | DEFAULT NOW() |

> 🔑 **`pedido_id UNIQUE` es la regla "1 pedido → 0..1 factura"** aplicada **en la base de datos**,
> no solo en el código. Es la forma correcta: aunque el código fallara, la BD lo impide.

### 9. `pagos` (FACTURA 1 ─── N PAGO)

| Columna | Tipo | Restricciones |
|---|---|---|
| `pago_id` | SERIAL | PK |
| `numero_pago` | VARCHAR(20) | UNIQUE |
| `factura_id` | INT | **FK → `facturas`** NOT NULL |
| `fecha` | TIMESTAMPTZ | DEFAULT NOW() |
| `valor` | NUMERIC(14,2) | NOT NULL **CHECK (valor > 0)** |
| `metodo_pago` | VARCHAR(30) | NOT NULL — EFECTIVO / TARJETA / TRANSFERENCIA / CHEQUE |
| `referencia` | VARCHAR(60) | |
| `observaciones` | TEXT | |
| `usuario_id` | INT | FK → `usuarios` (quién lo registró) |
| `fecha_registro` | TIMESTAMPTZ | DEFAULT NOW() |

**Columnas añadidas al final de `init.sql` con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`** (datos de
pago en línea):

| Columna | Para qué |
|---|---|
| `banco` | TEXT |
| `titular` | TEXT |
| `tipo_tarjeta` | TEXT — VISA / MASTERCARD / AMEX / OTRA |
| `ultimos_digitos_tarjeta` | TEXT — **solo 4 dígitos** |
| `vencimiento_tarjeta` | TEXT — MM/AA |
| `numero_cuenta` | TEXT — transferencia |

> 🔒 **Decisión de seguridad correcta y bien documentada:** por PCI-DSS **nunca** se guardan el
> número completo de la tarjeta ni el CVV, **solo los últimos 4 dígitos**. El comentario en el SQL lo
> dice explícitamente. Bien hecho.

### 10. `notas_credito` (FACTURA 1 ─── N NOTA_CREDITO)

| Columna | Tipo | Restricciones |
|---|---|---|
| `nota_credito_id` | SERIAL | PK |
| `numero_nota` | VARCHAR(20) | UNIQUE |
| `factura_id` | INT | **FK → `facturas`** NOT NULL |
| `cliente_id` | INT | **FK → `clientes`** NOT NULL |
| `fecha` | TIMESTAMPTZ | DEFAULT NOW() |
| `valor` | NUMERIC(14,2) | NOT NULL **CHECK (valor > 0)** |
| `motivo` | TEXT | **NOT NULL** (el motivo es obligatorio) |
| `estado` | VARCHAR(20) | DEFAULT `'ACTIVA'` — ACTIVA / ANULADA |
| `fecha_creacion` | TIMESTAMPTZ | DEFAULT NOW() |
| `usuario_id` | INT | FK → `usuarios` |
| `fecha_anulacion` | TIMESTAMPTZ | |
| `usuario_anulacion` | INT | FK → `usuarios` |
| `motivo_anulacion` | TEXT | |

### 11. `auditoria`

| Columna | Tipo | Restricciones |
|---|---|---|
| `auditoria_id` | SERIAL | PK |
| `usuario` | VARCHAR(200) | (se guarda el **identificador como texto**, no FK — a propósito: sobrevive si se borra el usuario) |
| `usuario_tipo` | VARCHAR(20) | NOT NULL DEFAULT `'INTERNO'` — INTERNO / CLIENTE |
| `fecha_hora` | TIMESTAMPTZ | DEFAULT NOW() |
| `modulo` | VARCHAR(50) | |
| `operacion` | VARCHAR(30) | |
| `registro_afectado` | VARCHAR(50) | |
| `descripcion` | TEXT | |

### Tabla auxiliar: `recuperaciones_clave`
Para el flujo de OTP.

| Columna | Tipo | Restricciones |
|---|---|---|
| `recuperacion_id` | SERIAL | PK |
| `usuario_cliente_id` | INT | **FK → `usuario_cliente` ON DELETE CASCADE** NOT NULL |
| `canal` | VARCHAR(10) | NOT NULL **CHECK (canal IN ('EMAIL','SMS'))** |
| `codigo_hash` | TEXT | NOT NULL — **el OTP se guarda cifrado con bcrypt** |
| `intentos` | INT | NOT NULL DEFAULT 0 |
| `usado` | BOOLEAN | NOT NULL DEFAULT FALSE (un solo uso) |
| `expira_en` | TIMESTAMPTZ | NOT NULL |
| `creado_en` | TIMESTAMPTZ | DEFAULT NOW() |

> 🔒 El código OTP **nunca se guarda en texto plano** — se guarda su hash bcrypt. El comentario del
> SQL lo dice: *"El código se guarda CIFRADO (bcrypt) y caduca; nunca en texto plano."* Buen detalle.

## La vista `factura_saldo` — el corazón del modelo

Es el objeto más importante del esquema. **El saldo de una factura nunca se almacena: se calcula.**

```sql
CREATE OR REPLACE VIEW factura_saldo AS
SELECT
  f.factura_id, f.numero_factura, f.pedido_id, f.cliente_id,
  f.fecha_emision, f.fecha_vencimiento,
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
  f.motivo_anulacion, f.fecha_anulacion,
  COALESCE(SUM(nc.valor), 0)::float8 AS notas_credito
FROM facturas f
LEFT JOIN pagos p          ON p.factura_id = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA'
GROUP BY f.factura_id;
```

Cómo hay que leerla:

| Concepto | Fórmula |
|---|---|
| `valor_pagado` | `SUM(pagos.valor)` |
| `notas_credito` | `SUM(notas_credito.valor)` **solo las `ACTIVA`** |
| **`saldo`** | **`total − pagado + notas_credito`** |
| `estado_pago` | `ANULADA` si la factura está anulada; `PENDIENTE` si pagado − NC ≤ 0; `PAGADA` si saldo ≤ 0; si no `PAGO_PARCIAL` |

**Detalle conceptual clave:** una nota de crédito **AUMENTA el saldo** de la factura (revierte el
pago). Es decir, si un cliente pagó 100 y se le devuelven 30 con una nota de crédito, el saldo vuelve
a subir en 30. Esto está documentado en el propio SQL (*"Las notas de crédito activas aumentan el
saldo (reversan pagos)"*) y es coherente con la regla "no devuelve más de lo pagado".

**Otros detalles finos:**
- Los montos se convierten a **`float8`** en la vista. Motivo: `pg` devuelve `NUMERIC` como **string**
  en JavaScript, y el frontend necesita números para operar. Es una solución pragmática que funciona
  (aunque pierde la exactitud decimal de NUMERIC — a tener en cuenta si algún día se factura con
  muchos decimales; para 2 decimales de moneda es aceptable).
- La columna `notas_credito` va **al final** a propósito: el comentario explica que es para conservar
  la compatibilidad con `CREATE OR REPLACE VIEW` (Postgres no permite reordenar/eliminar columnas de
  una vista existente, solo **añadirlas al final**). Es un detalle de mantenimiento bien pensado.
- `GROUP BY f.factura_id` funciona porque `factura_id` es la PK de `facturas` (Postgres permite
  agrupar por la PK y seleccionar el resto de columnas de esa tabla por dependencia funcional).

## Índices

```sql
idx_clientes_estado        ON clientes(estado)
idx_productos_estado       ON productos(estado)
idx_pedidos_cliente        ON pedidos(cliente_id)
idx_pedidos_estado         ON pedidos(estado)
idx_detalle_pedido_pedido  ON detalle_pedido(pedido_id)
idx_facturas_cliente       ON facturas(cliente_id)
idx_facturas_estado        ON facturas(estado)
idx_pagos_factura          ON pagos(factura_id)
idx_notas_credito_factura  ON notas_credito(factura_id)
idx_notas_credito_cliente  ON notas_credito(cliente_id)
idx_auditoria_fecha        ON auditoria(fecha_hora DESC)
idx_recuperaciones_cliente ON recuperaciones_clave(usuario_cliente_id, usado)
```

Están alineados con las consultas reales (filtros por estado, joins por FK, auditoría ordenada por
fecha descendente).

## Migraciones

El `init.sql` montado en `docker-entrypoint-initdb.d` **solo corre la primera vez** que se crea el
volumen. Para bases de datos ya existentes hay migraciones manuales:

| Archivo | Qué añade |
|---|---|
| `database/migracion_notas_credito.sql` | La tabla `notas_credito` y su integración con el saldo (el módulo de devoluciones) |
| `database/migracion_recuperacion_contrasena.sql` | La tabla `recuperaciones_clave` (flujo OTP) |

Aplicación manual (según `SPEC_Tecnico.md`):

```bash
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_notas_credito.sql
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_recuperacion_contrasena.sql
```

> 📌 **Observación:** el proyecto usa `CREATE TABLE IF NOT EXISTS` y `ADD COLUMN IF NOT EXISTS` en
> todas partes, lo que hace el esquema bastante **idempotente**. Pero al no haber herramienta de
> migraciones versionadas (tipo Flyway, Knex, Prisma migrate), el orden de aplicación es
> responsabilidad manual. Ver [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md).

---

*Siguiente: [`04-API-REST.md`](04-API-REST.md) para el contrato de la API.*
