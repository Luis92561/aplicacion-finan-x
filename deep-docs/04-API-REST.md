# 4 · API REST — contrato completo

> ⚠️ **Documento actualizado tras la segunda revisión.** Varios comportamientos descritos aquí
> cambiaron a propósito: errores genéricos en el login (M1), `404` en pagos de factura inexistente
> (M8), `400` en ids no numéricos (M9), lista blanca de métodos de pago (M6), contraseñas mínimas
> (M4), `token_version` en el token (A7). El detalle de cada cambio está en
> [`10-MEJORAS-APLICADAS.md`](10-MEJORAS-APLICADAS.md).

Prefijo global: **`/api`**. Todos los routers se montan en `backend/src/index.js`.
Formato de error uniforme: **`{ "error": "mensaje" }`**.

| Código | Significado en este proyecto |
|---|---|
| 400 | Datos faltantes o inválidos |
| 401 | No autenticado / credenciales incorrectas |
| 403 | Autenticado pero sin permiso (rol o tipo equivocado) |
| 404 | Recurso no encontrado |
| 409 | Conflicto con una regla de negocio |
| 429 | Rate limit superado |
| 500 | Error interno (incluye violaciones de constraint no capturadas) |

## Mapa de autorización (lo más importante)

Cada archivo aplica **un `router.use(requireAuth, requireRol(...))` al principio**, así que el control
es a nivel de módulo, no por endpoint:

| Módulo | Roles permitidos |
|---|---|
| `/api/auth/*` | **público** (con rate limit en registro y recuperación) |
| `/api/usuarios/*` | **ADMIN** |
| `/api/clientes/*` | ADMIN, FACTURADOR, CAJERO, SUPERVISOR |
| `/api/productos/*` | ADMIN, FACTURADOR, CAJERO, SUPERVISOR |
| `/api/pedidos/*` | ADMIN, FACTURADOR, CAJERO, SUPERVISOR |
| `/api/facturas/*` | ADMIN, FACTURADOR, CAJERO, SUPERVISOR |
| `/api/pagos/*` | ADMIN, FACTURADOR, CAJERO, SUPERVISOR |
| `/api/notas-credito/*` | ADMIN, FACTURADOR, CAJERO, SUPERVISOR |
| `/api/reportes/*` | **ADMIN, SUPERVISOR, FACTURADOR** ← ⚠️ CAJERO excluido |
| `/api/auditoria` | **ADMIN, SUPERVISOR** ← ⚠️ FACTURADOR y CAJERO excluidos |
| `/api/mis-*`, `/api/mi-*` | **`requireCliente`** (tipo `cliente` + `clienteId` del token) |

> ⚠️ **Asimetría real:** `/api/auditoria` solo admite ADMIN y SUPERVISOR, y `/api/reportes` excluye
> al CAJERO. Pero el menú lateral del frontend muestra "Auditoría", "Reportes" y "Balances por
> cliente" a **todos** los roles internos. Un CAJERO ve enlaces que solo producen **403**.

---

## 4.1 Autenticación — `/api/auth` (público)

### `POST /api/auth/login`
Body: `{ username, password }`.

Busca **primero** en usuarios internos (por `correo`, case-insensitive), luego en cuentas de cliente
(por `username`). Devuelve `{ token, user }`.

- `400` si falta usuario o contraseña.
- `403` "La cuenta está inactiva" / "El cliente está inactivo".
- `401` "Credenciales incorrectas".
- `429` tras **5 fallos** consecutivos desde la misma IP (ventana 15 min).

El `user` interno es `{ tipo: 'interno', usuarioId, nombre, correo, rol }`.
El `user` cliente es `{ tipo: 'cliente', usuarioClienteId, clienteId, nombre, username }`.

Detalles: al acertar se llama `limpiarFallosLogin(req)` (un acierto **resetea** el contador de la IP);
en el login de cliente se actualiza `usuario_cliente.ultimo_acceso`; se audita `LOGIN` (o
`LOGIN_FALLIDO`).

> 🔍 **Observación de seguridad:** `403 "La cuenta está inactiva"` frente a `401 "Credenciales
> incorrectas"` **revela si una cuenta existe**. Es enumeración de cuentas por diferencia de mensaje.

### `POST /api/auth/registro` — autoregistro de cliente
Rate limit: **20 / hora / IP**. Body: datos del cliente + `username` + `password`.

**Usa transacción** (BEGIN/COMMIT/ROLLBACK con cliente dedicado). Valida:
`numeroIdentificacion` y `nombreRazonSocial` obligatorios (400); `username` y `password` (400);
`password.length >= 6` (400); `username` contra `/^[a-zA-Z0-9._@-]{3,}$/` (400).
Duplicados → **409**: por `(tipo_identificacion, numero_identificacion)` y por `username`
(comprobado contra `usuario_cliente UNION usuarios.correo` — buen detalle).

Devuelve **201 con token**: el cliente queda autenticado de inmediato. El cliente nace `ACTIVO`
(no hay aprobación por administrador — está declarado como pendiente futuro).

### `POST /api/auth/recuperar-solicitar` — pide el OTP
Rate limit compartido: **40 / 15 min / IP** (la misma instancia de limitador que el siguiente
endpoint, así que **el cupo es compartido entre los dos**). Body: `{ username, canal }` con
`canal ∈ {EMAIL, SMS}`.

Marca como `usado = TRUE` todas las solicitudes previas (solo una vigente por cuenta), genera un
**OTP de 6 dígitos**, guarda su **hash bcrypt** con `expira_en = NOW() + intervalo de
`OTP_VALIDEZ_MINUTOS` (10)`, y llama a `enviarCodigo()`.

La respuesta es **genérica** para no revelar si la cuenta existe: *"Si la cuenta existe, recibirá su
código…"*. **Pero si `OTP_RETORNO_DEMO` está en `on` (valor por defecto), la respuesta incluye
`demo_otp` con el código, `destino` enmascarado y `canal`.**

### `POST /api/auth/recuperar-cambiar` — valida el OTP y cambia la clave
Body: `{ username, codigo, nuevaClave }`. Valida `codigo` con `/^\d{6}$/` y `nuevaClave.length >= 6`.

- `404` "Cuenta no encontrada o inactiva" ← **también revela existencia**, a diferencia del endpoint anterior.
- `400` si no hay solicitud vigente, o si el código expiró.
- `429` si ya se agotaron los 5 intentos.
- `401` "Código de seguridad incorrecto" (incrementa `intentos`; al llegar a 5 marca la solicitud como usada).

Al acertar: hashea la nueva clave, actualiza `usuario_cliente.password_hash`, marca **todas** las
recuperaciones de la cuenta como usadas y audita `CLAVE_RECUPERADA`. **Sin transacción.**

---

## 4.2 Usuarios internos — `/api/usuarios` (solo ADMIN)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/` | Lista usuarios con su rol |
| `GET` | `/roles` | Catálogo de roles |
| `POST` | `/` | Crea usuario. `rol` se resuelve **por nombre**. 409 si el correo existe. **Sin validación de longitud de contraseña** ni formato de correo |
| `PATCH` | `/:id` | Cambia `estado` y/o `password`. ⚠️ **`estado` sin whitelist**: se guarda cualquier cadena (la columna no tiene CHECK) |

No hay `PUT` ni `DELETE`: **no se puede cambiar nombre, correo ni rol** de un usuario. Tampoco hay
salvaguarda para que un ADMIN no se desactive a sí mismo o al último ADMIN.

## 4.3 Clientes — `/api/clientes`

| Método | Ruta | Detalles |
|---|---|---|
| `GET` | `/?q=&estado=&tipo=` | `q` busca en nombre / número de documento / correo. Incluye `total_pedidos`, `saldo_pendiente`, `tiene_cuenta`. `LIMIT 300` |
| `GET` | `/:id` | Detalle + `saldo_pendiente` |
| `POST` | `/` | 400 si faltan identificación o nombre; **409 si ya existe** `(tipo_identificacion, numero_identificacion)` |
| `PUT` | `/:id` | ⚠️ **No valida duplicados ni obligatorios** → violar el UNIQUE produce **500** en vez de 409 |
| `PATCH` | `/:id/estado` | Whitelist `ACTIVO`/`INACTIVO` (400 si no) |
| `POST` | `/:id/cuenta` | Crea la cuenta de portal. 409 si ya tiene cuenta o el username está usado. **No exige ≥6 caracteres** y no compara contra `usuarios.correo` |
| `GET` | `/:id/resumen-correo` | Texto del estado financiero para `mailto:` (ver abajo) |

> ⚠️ **`saldo_pendiente` aquí se calcula a mano** como `Σ(total − Σ pagos)` y **NO resta las notas de
> crédito**, a diferencia de la vista `factura_saldo`. Dos definiciones de saldo distintas en el
> mismo sistema (ver [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md)).

**`GET /:id/resumen-correo`** devuelve `{ destinatario, asunto, cuerpo, cliente }` en texto plano.
El cuerpo incluye: saludo, bloque `FACTURAS ACTIVAS` (una línea por factura con total/pagado/saldo/
estado), `SALDO TOTAL PENDIENTE`, `TOTAL PAGADO`, bloque opcional `NOTAS DE CRÉDITO ACTIVAS` y pie
corporativo. Usa `Intl.NumberFormat('es-CO', { currency: 'COP' })`.
**No envía correo** — el frontend monta un `mailto:`. No registra auditoría.
Tiene `LIMIT 50` en las facturas, así que **los totales suman solo esas 50**, no todas.

## 4.4 Productos — `/api/productos`

| Método | Ruta | Detalles |
|---|---|---|
| `GET` | `/?q=&estado=&categoria=` | `q` en nombre/código/descripción. `LIMIT 300` |
| `POST` | `/` | Código y nombre obligatorios; 400 si el precio es negativo; **409 si el código existe** |
| `PUT` | `/:id` | ⚠️ Sin validaciones: precio negativo o impuesto >100 los corta el CHECK de la BD como **500** |
| `PATCH` | `/:id/estado` | Whitelist ACTIVO/INACTIVO. Baja lógica (nunca se borra) |

## 4.5 Pedidos — `/api/pedidos`

| Método | Ruta | Detalles |
|---|---|---|
| `GET` | `/?q=&estado=&clienteId=&desde=&hasta=` | Incluye `numero_factura` si ya se facturó |
| `GET` | `/:id` | Detalle + `lineas` |
| `POST` | `/` | **Transacción.** Crea el pedido y sus líneas |
| `PUT` | `/:id` | **Transacción.** Solo si está `BORRADOR` (409 si no) |
| `PATCH` | `/:id/estado` | Transiciones: `BORRADOR→CONFIRMADO`, `BORRADOR|CONFIRMADO→CANCELADO`. Otra → 409 |

**Los totales se calculan SIEMPRE en el servidor** y el precio se lee de `productos` en la BD
**nunca** del body del cliente. Por cada línea:
`lineaSubtotal = round2(precio * cantidad)`, `lineaImpuesto = round2(lineaSubtotal * impuesto/100)`,
acumulando con `round2` en cada paso para evitar errores de coma flotante. El frontend solo muestra
una **vista previa** (y lo advierte en la UI).

`FACTURADO` nunca se pone aquí: lo pone `facturas.js`.

## 4.6 Facturas — `/api/facturas`

| Método | Ruta | Detalles |
|---|---|---|
| `GET` | `/?q=&estado=&estadoPago=&clienteId=&desde=&hasta=` | Se une a `factura_saldo` para traer `saldo`, `valor_pagado`, `notas_credito`, `estado_pago`. `LIMIT 300` |
| `GET` | `/:id` | Detalle + `lineas` + `pagos` + `notas_credito` |
| `GET` | `/:id/pagos` | ⚠️ Devuelve `[]` si la factura no existe (no da 404, a diferencia de las otras) |
| `GET` | `/:id/saldo` | `{ numero_factura, total, valor_pagado, saldo, estado_pago, estado }` |
| `POST` | `/` | **Transacción.** `{ pedidoId }` → genera la factura |
| `POST` | `/:id/anular` | Anulación **lógica** |

**`POST /`** valida en orden: pedido existe (404); no `CANCELADO` (409); **debe estar `CONFIRMADO`**
(409); no tiene factura previa (409); el cliente existe (400). Inserta la factura con
`fecha_vencimiento = NOW() + 30 días` (**hardcodeado**), genera `numero_factura = FAC-000123`
y pone el pedido en `FACTURADO`.

**`POST /:id/anular`** exige `motivo` no vacío (400), exige `ACTIVA` (409) y **prohíbe anular si hay
pagos** (409, "regla de negocio"). Marca `estado='ANULADA'` + motivo + fecha + usuario, y luego
devuelve el pedido a `CONFIRMADO`.
⚠️ **Los dos UPDATE van SIN transacción.**
🐛 **Y el comentario "El pedido vuelve a quedar disponible para refacturación" es falso**:
`facturas.pedido_id` es `NOT NULL UNIQUE`, así que refacturar ese pedido viola el UNIQUE y devuelve
**500**. La anulación es, en la práctica, un callejón sin salida.

## 4.7 Pagos — `/api/pagos`

| Método | Ruta | Detalles |
|---|---|---|
| `GET` | `/?q=&facturaId=&clienteId=&desde=&hasta=` | Incluye metadatos de tarjeta/cuenta (enmascarados en la UI) |
| `POST` | `/` | **Transacción.** Registra un pago |

Body: `{ facturaId, valor, metodoPago, referencia, observaciones }` + los datos del método.
Métodos: `EFECTIVO | TARJETA | TRANSFERENCIA | CHEQUE` (**sin whitelist en app ni CHECK en BD**).

Validaciones: `facturaId` y `valor > 0` (400); factura existe (404); `estado === 'ACTIVA'` (409);
**`valor <= saldo`** (400) donde `saldo = round2(total − Σ pagos)`.
Luego `validarDatosPago()` valida los datos según el método y **devuelve solo los campos seguros**.
Genera `numero_pago = PAG-000123` y audita `REGISTRAR`.

> 🐛 **Dos problemas serios aquí:**
> 1. El saldo se calcula como `total − Σ pagos`, **ignorando las notas de crédito** — contradice la
>    vista `factura_saldo`. Permite **sobrepagar** una factura que tiene NC.
> 2. **No hay `SELECT ... FOR UPDATE`**: dos pagos concurrentes pueden pasar ambos la validación y
>    sobrepasar el saldo.
> 3. `estado_pago` se calcula **solo para la respuesta**; no se persiste (correcto, porque es
>    derivado — pero conviene saberlo).

No hay `DELETE` ni `PUT`: **un pago no se puede anular ni corregir**.

## 4.8 Notas de crédito — `/api/notas-credito`

| Método | Ruta | Detalles |
|---|---|---|
| `GET` | `/?q=&estado=&clienteId=&facturaId=` | Lista con `LIMIT 300` |
| `GET` | `/:id` | Detalle |
| `POST` | `/` | **Transacción.** Crea la devolución |
| `POST` | `/:id/anular` | Anulación lógica, exige motivo |

**`POST /`** exige `facturaId`, `valor > 0` y `motivo` no vacío (400). Exige factura `ACTIVA` (409).
Calcula `disponible = round2(pagado − notasPrevias)`; si `disponible <= 0` → **409** "No hay pagos
disponibles para devolver"; si `valor > disponible` → **400**. Genera `numero_nota = NC-000001` y
devuelve `saldo_restante_devolver`.

> 🐛 **BUG GRAVE — producto cartesiano.** La consulta que calcula `pagado` y `notas_previas` hace
> `LEFT JOIN pagos` **y** `LEFT JOIN notas_credito` en la **misma query**:
> ```sql
> COALESCE(SUM(p.valor), 0)                                    AS pagado,
> COALESCE(SUM(CASE WHEN nc.estado='ACTIVA' THEN nc.valor END), 0) AS notas_previas
> FROM facturas f
> LEFT JOIN pagos p          ON p.factura_id  = f.factura_id
> LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id
> ```
> Con **2 pagos** y **1 nota** activa se generan 2 filas: `pagado` se **duplica**. El `disponible`
> queda inflado y **se puede devolver más de lo realmente pagado**.
> Verificación aritmética ejecutable: [`_verificacion-fanout.mjs`](_verificacion-fanout.mjs).

## 4.9 Reportes — `/api/reportes` (ADMIN, SUPERVISOR, FACTURADOR)

| Método | Ruta | Detalles |
|---|---|---|
| `GET` | `/resumen` | 8 indicadores del dashboard en una sola consulta |
| `GET` | `/facturacion?desde=&hasta=` | Facturación por rango + desglose por método de pago |
| `GET` | `/balance-clientes` | `{ resumen, clientes }` — cuentas por cobrar |
| `GET` | `/historial/:clienteId` | `{ cliente, facturas, pagos }` |

`/resumen` devuelve: `clientes_activos`, `productos_activos`, `total_pedidos`,
`pedidos_por_facturar`, `facturas_activas`, `facturas_anuladas`, `pagos_recibidos` y
`saldo_pendiente_total`.

> 🐛 `saldo_pendiente_total` usa la fórmula manual `total − pagos` e **ignora las notas de crédito**.

> 🐛 **`/facturacion` con rango de fechas da un `saldo_pendiente` incorrecto**: a lo facturado en el
> rango le resta el `SUM(pagos)` de **todas** las facturas activas del sistema — la subconsulta del
> segundo término **no lleva el filtro de fechas**:
> ```sql
> COALESCE(SUM(f.total) FILTER (WHERE f.estado='ACTIVA'), 0) -
>   COALESCE((SELECT SUM(p.valor) FROM pagos p JOIN facturas f2 ON f2.factura_id = p.factura_id
>             WHERE f2.estado = 'ACTIVA'), 0)   -- ← sin filtro desde/hasta
> ```

`/balance-clientes` es el único que **sí usa `factura_saldo`** y por tanto es coherente con la vista
(pero hereda el bug de fan-out). Define `total_pagado = valor_pagado − notas_credito` (pago **neto**
de devoluciones), que es la interpretación correcta.

## 4.10 Auditoría — `/api/auditoria` (ADMIN, SUPERVISOR)

`GET /?modulo=&usuario=&operacion=&limit=` → listado `ORDER BY auditoria_id DESC`.

- `modulo` se compara con `ILIKE $1` **sin comodines** → es una igualdad case-insensitive
  (probablemente no es lo que se pretendía).
- `usuario` sí usa `%...%`.
- `limit` se limita con `Math.min(Number(limit) || 200, 500)`. ⚠️ Es el **único punto del backend con
  interpolación de cadena en SQL**; está saneado con `Number()`, pero un valor negativo genera SQL
  inválido → 500.
- **Sin paginación** (no hay `OFFSET`) ni exportación.

## 4.11 Portal del cliente — `/api/mis-*` y `/api/mi-*`

> 🔒 Montado en **`/api`** (no en `/api/mis`). Todo el router está detrás de
> `requireAuth, requireCliente`, y **el `clienteId` se toma SIEMPRE del token**, nunca del body ni de
> la query. Ese es el mecanismo de aislamiento entre clientes.

| Método | Ruta | Devuelve |
|---|---|---|
| `GET` | `/mis-datos` | Datos del cliente del token (solo lectura) |
| `GET` | `/mis-pedidos` | Sus pedidos + `numero_factura` |
| `GET` | `/mis-pedidos/:id` | Detalle + líneas (verifica pertenencia) |
| `GET` | `/mis-facturas` | Desde `factura_saldo` filtrado por `cliente_id` |
| `GET` | `/mis-facturas/:id` | Detalle + líneas + pagos (verifica pertenencia) |
| `GET` | `/mis-pagos` | Sus pagos con metadatos de tarjeta/cuenta |
| `GET` | `/mis-pagos/efecty-codigo` | Genera un **código Efecty** para pagar en efectivo |
| `GET` | `/mi-saldo` | Agregados de saldo + facturas pendientes |
| `GET` | `/mis-notas-credito` | Sus notas de crédito |
| `GET` | `/mi-historial` | `{ facturas, pagos, notas }` |
| `POST` | `/mis-pagos` | Abona a una factura propia |

**`POST /mis-pagos`** replica la lógica de `/api/pagos` con dos diferencias: la factura debe
pertenecer al cliente (`WHERE factura_id = $1 AND cliente_id = $2` → 404 si no) y **rechaza
`EFECTIVO`** (400): el efectivo se paga con un código Efecty en un punto físico. El pago del portal
se inserta con `usuario_id = NULL` (la columna apunta a `usuarios`, no a `usuario_cliente`), así que la
trazabilidad del pagador cliente depende de `auditoria.usuario`.

> 🐛 Hereda el **mismo bug de saldo sin notas de crédito** y la **misma falta de `FOR UPDATE`**.

**`GET /mis-pagos/efecty-codigo?facturaId=&valor=`** — genera un código determinista:
```
cents = max(1, round(valor * 100))
base  = padStart(facturaId,4,'0') + padStart(cents,10,'0').slice(-10)   // 14 dígitos
c     = 98n - ((BigInt(base) * 100n) % 97n)                            // dígito de control ISO 7064 mod 97-10
código = `EFY-${base}${c}`                                             // EFY- + 16 dígitos
```
Valida pertenencia, `ACTIVA` (409), `saldo > 0` (409 si ya está pagada) y `0 < valor <= saldo` (400).
Devuelve `vigencia_horas: 24` (texto fijo).

> ⚠️ **El código no se persiste, no existe endpoint que lo valide o redima y no hay integración real
> con Efecty.** Es una simulación. Además es un **GET con efectos secundarios** (genera y audita), lo
> que rompe la idempotencia de REST. Y **el endpoint no está cubierto por la suite e2e**.

---

## Resumen de códigos de negocio (los que la suite e2e verifica)

| Regla | Endpoint | Código |
|---|---|---|
| Cliente duplicado | `POST /clientes`, `POST /auth/registro` | 409 |
| Código de producto duplicado | `POST /productos` | 409 |
| Precio negativo | `POST /productos` | 400 |
| Modificar pedido no BORRADOR | `PUT /pedidos/:id` | 409 |
| Facturar pedido no CONFIRMADO | `POST /facturas` | 409 |
| Refacturar el mismo pedido | `POST /facturas` | 409 |
| Pago mayor al saldo | `POST /pagos`, `POST /mis-pagos` | 400 |
| Anular factura con pagos | `POST /facturas/:id/anular` | 409 |
| Anular sin motivo | `POST /facturas/:id/anular` | 400 |
| Nota de crédito mayor a lo pagado | `POST /notas-credito` | 400 |
| Nota de crédito sin pagos | `POST /notas-credito` | 409 |
| Cliente accediendo a datos ajenos | `/mis-*` | 404 |
| Fuerza bruta de login | `POST /auth/login` | 429 |

---

*Siguiente: [`05-REGLAS-DE-NEGOCIO.md`](05-REGLAS-DE-NEGOCIO.md) para las invariantes en detalle.*
