# 9 · Observaciones y riesgos

> **Cómo leer este documento.** Clasifico cada hallazgo por severidad e indico **cómo lo verifiqué**.
> Distingo entre lo que **leí en el código**, lo que **comprobé ejecutando algo** y lo que **no se pudo
> comprobar** en ese momento (la base de datos no estaba disponible en el entorno).
>
> Todo esto viene de leer el proyecto, **no** de haberlo visto funcionar con datos reales. En esa
> primera pasada no se modificó ningún archivo del proyecto.

## Resumen ejecutivo

> ✅ **ACTUALIZACIÓN (segunda revisión).** Además de C1, C2 y C3, se corrigieron **todos los
> hallazgos de severidad Alta y Media** de este documento (A1–A7, M1–M11) y la limpieza de la
> sección Baja. La suite pasó de **99 a 139 comprobaciones**, todas en verde contra PostgreSQL 16
> real. El registro completo —qué, por qué y cómo se verificó— está en
> [`10-MEJORAS-APLICADAS.md`](10-MEJORAS-APLICADAS.md).
>
> También se corrigieron **C4** (refacturación tras anular), **M12** (pagador del portal) y **B12**
> (dominios en la base de datos), además de las salvaguardas de administrador. La suite quedó en
> **154 comprobaciones en verde**. Lo único que queda es **M13**, que es una observación de
> expectativas sobre la documentación, no un defecto del código.

> ✅ **ACTUALIZACIÓN (primera corrección): C1, C2 y C3 ya están CORREGIDOS y verificados**
> (commit `5877ef8`). Los hallazgos se conservan abajo como registro de lo que estaba mal y de cómo
> se comprobó. Ver la sección *Estado de la corrección*, al final.

El proyecto está **bien pensado y bien documentado**. Las reglas de negocio están correctamente
identificadas, la separación de roles es coherente, el aislamiento del portal por token es sólido y hay
detalles de calidad poco habituales en un proyecto de semestre: `round2()` en cada acumulación
monetaria, validación de Luhn, no persistir nunca el CVV, hash bcrypt del OTP, `IF NOT EXISTS` en todo
el esquema, seed idempotente, y **154 comprobaciones e2e que cubren las reglas críticas**.

Dicho eso, encontré **un bug de datos serio** que afecta a todos los saldos del sistema, y varios
problemas menores reales. Los ordeno por gravedad.

---

## 🔴 Crítico (C1, C2 y C3: corregidos)

### C1. Producto cartesiano en la vista `factura_saldo` — infla saldos y pagos — ✅ CORREGIDO

**Dónde:** `database/init.sql` líneas 181–207 (y su copia en `database/migracion_notas_credito.sql`).

**Qué pasa:** la vista hace **dos `LEFT JOIN` a tablas hijas** de `facturas` en la misma consulta:

```sql
FROM facturas f
LEFT JOIN pagos p          ON p.factura_id  = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA'
GROUP BY f.factura_id
```

Con **P** pagos y **N** notas activas el join genera **P×N filas**. Por tanto:
- `SUM(p.valor)` queda multiplicado por **N**
- `SUM(nc.valor)` queda multiplicado por **P**

**Cómo lo verifiqué:** preparé [`_verificacion-fanout.mjs`](_verificacion-fanout.mjs), que replica la
semántica del join en JavaScript y lo ejecuté con Node. Resultados reales:

| Escenario (factura de 100) | `valor_pagado` | `notas_credito` | `saldo` |
|---|---|---|---|
| 2 pagos (50+50) + 1 nota (30) | 100 ✅ | **60** ❌ (era 30) | **60** ❌ (era 30) |
| 1 pago (40) + 2 notas (10+10) | **80** ❌ (era 40) | 20 ✅ | **40** ❌ (era 80) |

**Por qué es grave:** el saldo es **la cifra central del sistema**. Está inflado o deflactado en cuanto
una factura acumula más de un pago **y** más de una nota de crédito a la vez. Afecta a:
`GET /facturas`, `GET /facturas/:id`, `GET /facturas/:id/saldo`, `GET /mis-facturas`, `GET /mi-saldo`,
`GET /mi-historial`, `GET /reportes/balance-clientes`, `GET /reportes/historial/:id` y
`GET /clientes/:id/resumen-correo`. Puede incluso **cambiar el `estado_pago`** y mostrar como
`PAGADA` una factura que no lo está (o al contrario).

**Por qué nadie lo notó:** ninguna factura de la suite e2e acumula **a la vez** más de un pago y más de
una nota de crédito. Con `P ≤ 1` **o** `N ≤ 1` la multiplicación no cambia el resultado. Es un bug que
solo aparece con datos reales.

**Corrección recomendada** — agregar por separado, sin join cruzado:

```sql
CREATE OR REPLACE VIEW factura_saldo AS
SELECT
  f.factura_id, f.numero_factura, f.pedido_id, f.cliente_id,
  f.fecha_emision, f.fecha_vencimiento,
  f.subtotal::float8, f.impuestos::float8, f.total::float8,
  COALESCE(pg.valor_pagado, 0)::float8  AS valor_pagado,
  (f.total - COALESCE(pg.valor_pagado, 0) + COALESCE(nc.notas_credito, 0))::float8 AS saldo,
  f.estado,
  CASE
    WHEN f.estado = 'ANULADA' THEN 'ANULADA'
    WHEN COALESCE(pg.valor_pagado, 0) - COALESCE(nc.notas_credito, 0) <= 0 THEN 'PENDIENTE'
    WHEN f.total - COALESCE(pg.valor_pagado, 0) + COALESCE(nc.notas_credito, 0) <= 0 THEN 'PAGADA'
    ELSE 'PAGO_PARCIAL'
  END AS estado_pago,
  f.motivo_anulacion, f.fecha_anulacion,
  COALESCE(nc.notas_credito, 0)::float8 AS notas_credito
FROM facturas f
LEFT JOIN (SELECT factura_id, SUM(valor) AS valor_pagado
             FROM pagos GROUP BY factura_id) pg ON pg.factura_id = f.factura_id
LEFT JOIN (SELECT factura_id, SUM(valor) AS notas_credito
             FROM notas_credito WHERE estado = 'ACTIVA' GROUP BY factura_id) nc
       ON nc.factura_id = f.factura_id;
```

> ⚠️ **Ojo al aplicarlo:** como `init.sql` solo se ejecuta al crear el volumen desde cero, en una base
> ya existente hay que reemplazar la vista a mano. Y el `CREATE OR REPLACE VIEW` solo admite **añadir
> columnas al final** — este `SELECT` conserva el mismo orden de columnas, así que es aplicable.

### C2. `POST /api/notas-credito` — se puede devolver más dinero del que se pagó — ✅ CORREGIDO

**Dónde:** `backend/src/routes/notas-credito.js`, líneas 69–88.

**Qué pasa:** el mismo patrón de C1, pero en una consulta que decide **cuánto dinero se autoriza a
devolver**:

```sql
COALESCE(SUM(p.valor), 0)::float8                                   AS pagado,
COALESCE(SUM(CASE WHEN nc.estado='ACTIVA' THEN nc.valor END), 0)::float8 AS notas_previas
FROM facturas f
LEFT JOIN pagos p          ON p.factura_id  = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id
```

El `disponible = round2(pagado − notasPrevias)` queda **inflado** porque `pagado` se multiplica por el
número de notas.

**Consecuencia concreta:** factura de 100 con **2 pagos de 50** y **1 nota de 30**.
`pagado` real = 100, `notas_previas` = 30 → `disponible` real = **70**.
Pero el join duplica `pagado` a 200 → `disponible` calculado = **170**.
El sistema aceptaría una nota de crédito de hasta 170 sobre una factura donde solo se pagaron 100.

**Por qué es el más grave de los dos:** C1 muestra cifras equivocadas; **C2 autoriza una devolución
real de dinero por encima de lo cobrado**. Es un fallo de control, no solo de visualización.

**Corrección:** la misma técnica de subconsultas agregadas por separado.

### C3. El saldo se calcula con **dos fórmulas distintas** según el endpoint — ✅ CORREGIDO

**Dónde:** `pagos.js` (líneas 52–64), `mis.js` (líneas 131–147 y 240–253, para `efecty-codigo` y
`POST /mis-pagos`), `clientes.js` (líneas 30–31 y 47–48), `reportes.js` (`/resumen` línea 21).

**Qué pasa:** estos sitios calculan `saldo = total − Σ pagos` **ignorando las notas de crédito**,
mientras la vista `factura_saldo` usa `total − pagos + notas_credito`. Son dos definiciones
incompatibles del mismo concepto.

**Consecuencia:** en una factura con notas de crédito activas, el sistema acepta un pago **mayor** que
el saldo real → **sobrepago**. Ejemplo: factura de 100, pagada 50 (saldo real 50), se emite una NC de
20 (saldo real pasa a 70). Pero la validación cree que el saldo es `100 − 50 = 50`, así que acepta
50 más. Total cobrado: 100 sobre una factura de 100 con 20 devueltos → **se cobró 20 de más**.

Además, las pantallas muestran **cifras distintas para la misma factura** según de qué endpoint vengan
(el listado de clientes no resta notas; el de facturas sí).

**Corrección:** unificar. Lo más simple es que estos puntos lean de `factura_saldo` en lugar de
recalcular.

### C4. Anular una factura deja el pedido imposible de refacturar (500) — ✅ CORREGIDO

**Dónde:** `backend/src/routes/facturas.js` líneas 171–179.

**Qué pasa:** al anular, el código hace:
```js
// El pedido vuelve a quedar disponible para refacturación
await pool.query(`UPDATE pedidos SET estado = 'CONFIRMADO' WHERE pedido_id = (...)`, [id]);
```
Pero `facturas.pedido_id` es **`NOT NULL UNIQUE`** (`init.sql:111`). El comentario es **falso**: al
intentar facturar de nuevo ese pedido, el `INSERT` viola el UNIQUE, y como el manejador de errores solo
reconoce `HttpError`, PostgreSQL devuelve **500 "Error interno del servidor"** en vez de un 409
explicativo.

**Consecuencia:** anular una factura es un **callejón sin salida**. No hay forma de rehacerla. La
promesa "1 pedido → 0..1 factura" se cumple a nivel de datos, pero la operación de anulación
queda inservible para su propósito evidente.

**La suite e2e no lo detecta** porque anula facturas pero **nunca refactura el mismo pedido**.

**Opciones de corrección** (decisión de negocio, no solo técnica):
1. Quitar el `UNIQUE` de `pedido_id` y permitir N facturas por pedido (cambiando la regla declarada).
2. Permitir "reemplazar" la factura anulada (borrado real de la anulada sin pagos).
3. No devolver el pedido a `CONFIRMADO`, sino crear un estado explícito tipo `ANULADO_PARA_REFACTURAR`.

---

## 🟠 Alto

### A1. El secret JWT de producción está **en el repositorio** y se usa por defecto

**Dónde:** `docker-compose.yml` línea 31.

```yaml
JWT_SECRET: ${JWT_SECRET:-finanx-prod-secret-cambiar-por-una-clave-segura-de-32-caracteres}
```

El guard de `config.js` solo comprueba **longitud ≥ 32**, y ese literal por defecto **la cumple**.
Así que un despliegue en producción sin definir la variable **arranca sin errores** con un secreto que
está escrito en el repositorio → **cualquiera puede forjar tokens JWT** y entrar como ADMIN.

Es el fallo de seguridad más serio del proyecto. La intención del guard era buena (obligar a un secreto
fuerte), pero el valor por defecto lo neutraliza.

**Corrección:** que el valor por defecto esté **vacío** y que `config.js` aborte si está vacío en
producción, en vez de limitarse a comprobar la longitud.

### A2. `OTP_RETORNO_DEMO=on` por defecto incluso en producción

El código de recuperación **viaja en la respuesta de la API** y la UI lo muestra
(`Login.jsx`, `recovInfo.demo_otp`). Con `NODE_ENV=production` por defecto en Docker Compose, un
despliegue real anula el segundo factor de la recuperación de contraseña: cualquiera puede pedir el
código de otro y restablecer su contraseña. El comentario de Compose lo advierte, pero **el default es
inseguro**; debería ser `off` en producción.

### A3. El Dashboard está roto para CAJERO y FACTURADOR

**Dónde:** `frontend/src/pages/Dashboard.jsx` línea 14.

```js
const [r, a] = await Promise.all([api.get('/reportes/resumen'), api.get('/auditoria', { limit: 8 })]);
```

- `/api/reportes/*` exige `ADMIN, SUPERVISOR, FACTURADOR` → **CAJERO recibe 403**
- `/api/auditoria` exige `ADMIN, SUPERVISOR` → **CAJERO y FACTURADOR reciben 403**

Como `Promise.all` **rechaza en el primer fallo**, el `catch` hace `setError(...)` y el componente
retorna `<ErrorBox>` en la línea 23. **Ninguna de las 7 tarjetas de resumen se muestra.**

**Consecuencia:** el rol CAJERO — uno de los cuatro roles del sistema — abre la aplicación y ve una
pantalla de error. Verificado leyendo el código: el `return <div className="content"><ErrorBox .../></div>`
ocurre **antes** de pintar las tarjetas.

**Corrección:** usar `Promise.allSettled` (o llamadas independientes) y mostrar la sección de auditoría
solo si el rol tiene permiso.

### A4. Sin `SELECT ... FOR UPDATE` en los flujos de pago

**Dónde:** `pagos.js` (líneas 52–58) y `mis.js` (líneas 240–247).

Ningún `SELECT` del backend usa `FOR UPDATE`, y no hay transacciones `SERIALIZABLE` ni
`REPEATABLE READ` en todo `backend/src`. Con el nivel por defecto de PostgreSQL (`READ COMMITTED`),
**dos pagos concurrentes** pueden leer el mismo `pagado`, pasar ambos la validación `valor <= saldo` e
insertarse los dos → **sobrepago**.

Esto es un problema de concurrencia real, no teórico: dos cajeros cobrando la misma factura al mismo
tiempo, o un cliente pagando desde el portal mientras el cajero registra el pago.

**Corrección:** `SELECT ... FOR UPDATE` sobre la fila de `facturas` al inicio de la transacción.

### A5. Sin transacción en operaciones de varios pasos

| Dónde | Pasos que deberían ser atómicos |
|---|---|
| `facturas.js` `POST /:id/anular` | Anular la factura **+** devolver el pedido a `CONFIRMADO` |
| `auth.js` `POST /recuperar-cambiar` | Cambiar la contraseña **+** invalidar los OTP **+** actualizar intentos |
| `usuarios.js` `PATCH /:id` | Actualizar estado **+** actualizar contraseña |

Si falla el segundo paso, el estado queda inconsistente y sin `ROLLBACK`.

### A6. `audit()` puede perder registros silenciosamente

`middleware/audit.js` envuelve el `INSERT` en try/catch que **solo hace `console.error`** y nunca
relanza. Y se llama **después del COMMIT**. Por tanto: la operación de negocio puede quedar persistida
**sin su registro de auditoría**. En un sistema donde la auditoría es un requisito funcional
(`RF-A01/A02`), esto es una debilidad real: permitiría actuar sin dejar rastro.

**Corrección:** insertar la auditoría **dentro** de la misma transacción que la operación.

### A7. Los tokens JWT sobreviven al cambio de contraseña

No hay `tokenVersion`, ni lista negra, ni endpoint de logout. Tras restablecer la contraseña con el OTP,
un token robado **sigue siendo válido hasta 8 horas**. La reacción defensiva natural del usuario
(cambiar la contraseña) no expulsa al atacante.

### A8. El bug C1 también afecta a `balance-clientes`, que es la pantalla de cobranza

Refuerzo de C1: `GET /api/reportes/balance-clientes` es la vista de **cuentas por cobrar** — la
herramienta con la que se decide a quién cobrar. Usa `factura_saldo`, así que hereda el saldo inflado.
Aquí el impacto es de negocio directo: se le puede reclamar a un cliente una deuda mayor a la real.

---

## 🟡 Medio

### M1. Enumeración de cuentas por diferencia de mensajes

- `POST /auth/login`: `403 "La cuenta está inactiva"` vs `401 "Credenciales incorrectas"` → revela si la cuenta existe.
- `POST /auth/recuperar-cambiar`: `404 "Cuenta no encontrada o inactiva"` → revela existencia, mientras `recuperar-solicitar` responde genéricamente (bien).

### M2. El OTP se genera con `Math.random()`, no con `crypto`

`auth.js` línea 168: `String(Math.floor(100000 + Math.random() * 900000))`.
`Math.random()` **no es criptográficamente seguro**. Para un código de seguridad de 6 dígitos debería
usarse `crypto.randomInt(100000, 1000000)`. Es un cambio de una línea.

### M3. `clientes PUT /:id` no valida duplicados ni campos obligatorios

**Dónde:** `clientes.js` líneas 81–97.

A diferencia del `POST`, el `PUT` **no comprueba** `(tipo_identificacion, numero_identificacion)`. Si
otro cliente ya usa esa identificación, se viola `uq_cliente_identificacion` y — al no ser `HttpError` —
el usuario recibe **500** en vez de 409. Lo mismo con campos obligatorios ausentes
(`numero_identificacion` es `NOT NULL`).

### M4. Validaciones inconsistentes de contraseña

`≥ 6 caracteres` solo se exige en `POST /auth/registro` y `POST /auth/recuperar-cambiar`.
**No** se exige en `POST /api/usuarios` ni en `POST /api/clientes/:id/cuenta`. Un administrador puede
crear usuarios internos con contraseña de 1 carácter.

### M5. `estado` de usuarios sin whitelist

`usuarios.js` `PATCH /:id` acepta cualquier valor de `estado` y lo escribe; la columna no tiene CHECK.
Clientes y productos **sí** validan contra `['ACTIVO','INACTIVO']`. Inconsistente.

### M6. `metodo_pago` sin validación en ningún nivel

`init.sql:134` solo lo documenta en un comentario (sin CHECK) y el backend no lo valida contra la lista.
Se acepta cualquier cadena. El reporte de facturación solo cuenta 4 métodos
(EFECTIVO/TRANSFERENCIA/TARJETA/CHEQUE), así que un valor arbitrario desaparece de los informes.

### M7. `GET /api/reportes/facturacion` con rango de fechas da un saldo incorrecto

`reportes.js` líneas 45–46: al total facturado **en el rango** se le resta el `SUM(pagos)` de
**todas las facturas activas del sistema** — la subconsulta del segundo término **no lleva el filtro de
fechas**. La cifra de `saldo_pendiente` es, por tanto, incorrecta siempre que se use un rango.

### M8. `GET /api/facturas/:id/pagos` devuelve `[]` en vez de 404

Asimetría: `/facturas/:id` y `/facturas/:id/saldo` dan 404 si la factura no existe, pero
`/:id/pagos` devuelve una lista vacía. Dificulta distinguir "no existe" de "no tiene pagos".

### M9. IDs no numéricos producen 500

Ninguna ruta valida `Number(req.params.id)`. Un `/api/facturas/abc` pasa `NaN` a PostgreSQL y produce
un error de tipo → **500** en lugar de 400.

### M10. `auditoria.js` interpola el `LIMIT` en el SQL

Es el **único punto del backend con interpolación de cadena** en una consulta:
`LIMIT ${Math.min(Number(limit) || 200, 500)}`. Está saneado con `Number()`, pero un valor negativo
genera SQL inválido → 500. Además `modulo ILIKE $1` **sin comodines** es una igualdad
case-insensitive, probablemente no lo que se pretendía. Y no hay paginación (`OFFSET`).

### M11. Fechas en UTC, no en hora local

`resumen-correo` usa `fecha_emision.toISOString().slice(0,10)`. En Colombia (UTC−5), una emisión a las
20:00 se muestra con **la fecha del día siguiente**. Los filtros `hasta` con `+ interval '1 day'`
incluyen además el instante 00:00 del día posterior.

### M12. Los pagos del portal quedan sin `usuario_id` — ✅ CORREGIDO

`pagos.usuario_id` referencia `usuarios` (internos), así que los pagos del portal se insertan con
`NULL`. El esquema **no puede representar por FK** quién pagó desde el portal; la trazabilidad depende
de `auditoria.usuario`, que es texto libre.

### M13. La documentación promete más pureza arquitectónica de la que hay

El proyecto declara arquitectura **hexagonal (puertos y adaptadores)**. En el código es un monolito
Express de 3 capas (rutas → SQL → PostgreSQL) con buenas guardas y una utilidad de dominio aislada
(`utils.js`). **No hay** carpeta `domain/`, entidades, interfaces de repositorio ni inyección de
dependencias. Está **bien organizado y es legible**, pero quien espere puertos e interfaces formales no
los encontrará. Es una observación de expectativas, no un defecto funcional.

### M14. Migraciones duplicadas sin runner

`migracion_notas_credito.sql` y `migracion_recuperacion_contrasena.sql` **replican exactamente**
contenido ya presente en `init.sql`; en instalaciones nuevas son no-ops. No hay tabla de versiones,
herramienta de migración ni orden de aplicación garantizado. Para una base ya existente, el único
camino documentado es ejecutar el SQL a mano con `docker exec`.

---

## 🔵 Bajo / limpieza

| # | Detalle |
|---|---|
| B1 | **Código muerto:** `AUDITOR` (`audit.js:16-18`) sin uso; `num()` (`utils.js:11`) sin uso; `.map()` no-op en `usuarios.js:19`; `Topbar` y `EntityPill()` (`Layout.jsx`) sin uso |
| B2 | **Duplicación:** el saldo y el `INSERT` de pago están copiados entre `pagos.js` y `mis.js`; el enmascarado entre `auth.js:enmascarar` y `notificar.js`; el formato de dinero entre `ui.jsx` y `fmt`/`cpu` de varias páginas |
| B3 | **`clientes.js` `saldo_pendiente`** hecho a mano en vez de usar la vista (además de ser la fórmula incorrecta, ver C3) |
| B4 | `frontend/package.json` incluye un campo no estándar `allowScripts` que npm ignora |
| B5 | `backend/.env.example` **desactualizado**: le falta `CORS_ORIGINS`, `LOGIN_MAX_FAILURES`, `REGISTRO_RATE_LIMIT`, `OTP_*`, `RECUPERAR_RATE_LIMIT`. Y su `JWT_SECRET=cambia-esta-clave` (17 chars) haría fallar el guard de producción — engañoso como plantilla |
| B6 | Docker publica `5432` y `4000` en todas las interfaces del host, saltándose nginx en el caso del 4000 |
| B7 | El contenedor `frontend` no tiene healthcheck (db y backend sí); `db` no tiene `restart` |
| B8 | `nginx.conf` no añade cabeceras de seguridad a los estáticos de la SPA (helmet solo protege Express) |
| B9 | `levantar.ps1` no valida el modo (cualquier valor distinto de `--stop`/`--purge` arranca el stack) y **no tiene `--dev`**, a diferencia de `levantar.sh`; `iniciar-app.sh` asume macOS |
| B10 | `ProductPreview`/`FacturaPreview` con NIT y ciudad **hardcodeados**; "Contado / Crédito a {fecha_vencimiento}" se imprime incluso con fecha nula (muestra "—") |
| B11 | `Login.jsx` muestra las credenciales demo en pantalla; combinado con un seed que corre en cada arranque del contenedor, implica usuarios con contraseña conocida en producción |
| B12 | Los CHECK de enumeración casi no existen: los valores válidos de `estado`, `metodo_pago`, `usuario_tipo` solo están en comentarios SQL y en el código. El único CHECK de dominio es `recuperaciones_clave.canal IN ('EMAIL','SMS')` |
| B13 | `GET /mis-pagos/efecty-codigo` es un **GET con efectos secundarios** (genera y audita) y **no está cubierto por ninguna prueba**. Además el código **no se persiste, no hay endpoint que lo redima y no hay integración real con Efecty** — es una simulación |
| B14 | Sin paginación en ningún listado (`LIMIT 300`/`500` fijos) |
| B15 | Sin tests unitarios; la cobertura es solo e2e. `frontend` no tiene lint ni tests |

---

## ✅ Cosas que están bien hechas (y conviene no romper)

Para ser justo, esto merece reconocimiento explícito:

1. **`round2()` en cada acumulación monetaria** (`utils.js`), no solo al final. Evita el error de coma
   flotante, que es un clásico en sistemas de facturación.
2. **El precio se lee siempre de la base de datos**, nunca del body del cliente. Un usuario no puede
   inventarse un precio.
3. **`precio_unitario` se copia a `detalle_pedido`**, congelando el precio del momento de la venta.
4. **Nunca se persiste el número completo de tarjeta ni el CVV.** `validarDatosPago` los usa para validar
   y **devuelve solo los campos seguros** (`n.slice(-4)` + marca). Hay una prueba e2e que verifica que la
   respuesta cruda **no** contiene el número completo ni `codigoSeguridad`. Es la decisión correcta
   (PCI-DSS) y está bien implementada.
5. **El OTP se guarda hasheado con bcrypt**, nunca en texto plano.
6. **El `clienteId` sale siempre del token**, nunca del navegador. El aislamiento entre clientes es
   sólido y está probado. Devolver 404 (no 403) para recursos ajenos evita revelar existencia.
7. **El saldo es derivado, nunca almacenado.** Es la opción correcta: no puede desincronizarse. (El bug
   C1 es un error en la *fórmula*, no en la decisión de diseño.)
8. **El seed es idempotente** (`ON CONFLICT DO NOTHING` + comprobaciones previas) y corre en cada
   arranque sin duplicar datos.
9. **El esquema usa `IF NOT EXISTS`** en todo, lo que lo hace re-ejecutable.
10. **`config.js` aborta en producción sin `JWT_SECRET`** — buena intención (arruinada por el default de
    Compose, ver A1).
11. **El contador de fuerza bruta se resetea con un login correcto** — un usuario legítimo que se
    equivoca no queda bloqueado. Buen detalle de UX y seguridad.
12. **La respuesta de `recuperar-solicitar` es genérica** para no revelar si la cuenta existe.
13. **La suite e2e de 154 comprobaciones es notable**, e incluye pruebas de aislamiento entre clientes, de las
    validaciones de tarjeta (Luhn, CVV, vencimiento) y de privacidad PCI. Es la mejor red de seguridad
    del proyecto.
14. **La documentación es excepcionalmente completa**: PDFs, HTMLs, specs en Markdown, 14 diagramas
    PlantUML, 14 mockups y tablas de trazabilidad requisito ↔ implementación.
15. **CORS con lista blanca** y cabeceras de seguridad con `helmet` (`X-Content-Type-Options`,
    `X-Frame-Options`, sin `X-Powered-By`), verificadas por la suite.

---

## Lo que en su momento **no** se pudo verificar (y después sí)

Transparencia sobre los límites del análisis inicial y de lo que se comprobó después:

1. **Al principio no se ejecutó la aplicación.** El entorno no tenía acceso al named pipe de Docker
   Desktop. **Después sí se pudo** (con permisos ampliados) y **la corrección se verificó contra
   PostgreSQL 16 real**, ejecutando la suite completa.
2. **Al inicio la suite e2e no se ejecutó**; los 99 casos iniciales se contaron leyendo `e2e.mjs` (hoy son 154 y se ejecutan realmente).
   **Después se ejecutó: 112/112 en verde** con la corrección aplicada.
3. **El bug C1 se verificó primero aritméticamente** ([`_verificacion-fanout.mjs`](_verificacion-fanout.mjs))
   y **después contra la base de datos real**, reproduciéndolo antes de corregirlo. Ver
   *Estado de la corrección*.
4. **No se revisaron los archivos binarios** (PDFs, PNGs, SVGs) ni el `.docx` de comandos.
5. **Al inicio no se modificó nada**: `deep-docs/` fue lo único creado. Las correcciones posteriores
   (C1, C2, C3) las apliqué después y quedaron aisladas en el commit `5877ef8`.

---

## ✅ Estado de la corrección (commit `5877ef8`)

Se corrigieron **C1, C2 y C3**, verificados contra PostgreSQL 16 real.

### Cómo se comprobó

Se levantó una base de datos **aislada** (contenedor y volumen propios, puerto 55432) creada desde el
`init.sql` corregido, se sembró con `seed.js` y se ejecutó el backend corregido para correr la suite
completa.

**Paso 1 — reproducir el bug** (vista original, factura de 100):

| Escenario | `valor_pagado` | `notas_credito` | `saldo` |
|---|---|---|---|
| 2 pagos (50+50) + 1 nota (30) | 100 ✅ | **60** ❌ (debía 30) | **60** ❌ (debía 30) |
| 1 pago (40) + 2 notas (10+10) | **80** ❌ (debía 40) | 20 ✅ | **40** ❌ (debía 80) |

**Paso 2 — aplicar la corrección:** los cuatro valores quedan correctos en ambos escenarios.

**Paso 3 — suite completa:** `=== Resultado: 112 aprobadas, 0 fallidas ===`

**Paso 4 — comprobar que la prueba realmente detecta el bug.** Se reintrodujo temporalmente la vista
con el bug y la suite **falló con 6 errores**, entre ellos:

```
✘ Valor pagado sigue siendo el total (no multiplicado por 3 notas)
  {"total":297500,"valor_pagado":892500,"notas_credito":595000,...}
✘ El pago usa el saldo de la vista (coherente con las notas)
  {"error":"El valor supera el saldo pendiente ($ 0)"}
```

`valor_pagado = 892500` sobre una factura de `297500` es exactamente 3× — el fan-out con 2 pagos y
3 notas. Restaurada la corrección, la suite vuelve a **112/112**.

> Esto importa: una prueba de regresión que nunca falla no protege de nada. Esta falla cuando debe.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `database/init.sql` | La vista agrega pagos y notas en subconsultas independientes |
| `database/migracion_notas_credito.sql` | La misma vista (idéntica, para bases existentes) |
| `backend/src/routes/notas-credito.js` | Subconsultas en el cálculo de `disponible` (C2) |
| `backend/src/routes/pagos.js` | Saldo desde la vista (C3) |
| `backend/src/routes/mis.js` | Saldo desde la vista en `POST /mis-pagos` y en el código Efecty (C3) |
| `backend/src/routes/clientes.js` | `saldo_pendiente` desde la vista (C3) |
| `backend/src/routes/reportes.js` | `saldo_pendiente_total` desde la vista (C3) |
| `backend/src/routes/facturas.js` | `GET /:id/saldo` expone `notas_credito` |
| `backend/scripts/e2e.mjs` | 14 comprobaciones nuevas de regresión |

La corrección de la vista conserva **los mismos nombres y el mismo orden de columnas**, así que es
compatible con `CREATE OR REPLACE VIEW` sobre una base ya existente.

### Importante: la base de datos ya creada NO se actualiza sola

`init.sql` solo se ejecuta cuando el volumen de PostgreSQL se crea **desde cero**. En una base que ya
existe, la vista sigue siendo la defectuosa hasta que se reemplace a mano:

```bash
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_notas_credito.sql
```

O, si prefieres empezar de cero (borra los datos): `docker compose down -v && docker compose up -d --build`.

### Qué sigue pendiente

**C4** (refacturación imposible tras anular) y todo lo de las secciones 🟠 Alto, 🟡 Medio y 🔵 Bajo.
El más urgente de los pendientes es **A1** (el `JWT_SECRET` de producción está en el repositorio) y
**A2** (`OTP_RETORNO_DEMO=on` por defecto), ambos de una línea.

---

## Orden sugerido de corrección

Si hubiera que seguir arreglando esto por impacto:

1. ~~**C1 + C2** (fan-out)~~ — ✅ **hecho** (commit `5877ef8`). **Máxima prioridad, resuelta.**
2. **C4** (refacturación) — decisión de negocio + cambio de esquema.
3. **A1** (JWT por defecto) — línea de configuración, riesgo de seguridad grave.
4. **A2** (`OTP_RETORNO_DEMO`) — una variable, anula el segundo factor.
5. ~~**C3** (unificar la fórmula de saldo)~~ — ✅ **hecho**, evita sobrepagos.
6. **A4** (`FOR UPDATE`) — concurrencia en pagos.
7. **A3** (Dashboard roto) — la aplicación se ve rota para un rol entero.
8. **A5, A6, A7** — transacciones y auditoría.
9. El resto, por orden de severidad.

---

*Análisis hecho leyendo el código y la documentación, con verificación aritmética del hallazgo
principal. Ver [`README.md`](README.md) para el índice general.*
