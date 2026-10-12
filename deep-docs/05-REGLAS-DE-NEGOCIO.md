# 5 · Reglas de negocio

> **Este es el documento más importante para no romper nada.** Aquí están las invariantes del
> sistema y **dónde están implementadas**. Si tocas una de estas reglas, revisa los tres niveles:
> la base de datos, la ruta de la API y la UI.

> ✅ **Actualización:** los dos bugs de saldo que se documentan más abajo (el producto cartesiano de la
> vista `factura_saldo` y el `disponible` inflado de las notas de crédito) **ya están corregidos y
> verificados** (commit `5877ef8`). Se conservan aquí como registro de por qué la regla se escribe así.
> Ver [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md) → *Estado de la corrección*.

## Resumen de invariantes

| # | Regla | Dónde se aplica | Código |
|---|---|---|---|
| 1 | Cliente único por `(tipo_identificacion, numero_identificacion)` | `clientes.js` (consulta previa) + **UNIQUE en BD** | 409 |
| 2 | Totales calculados **siempre** en el servidor | `pedidos.js` relee precios de `productos` | — |
| 3 | Un pago **no puede superar el saldo** | `pagos.js`, `mis.js` | 400 |
| 4 | El **saldo** nunca se almacena: se deriva | Vista `factura_saldo` | — |
| 5 | 1 pedido → **0..1** factura | `facturas.pedido_id UNIQUE` | 409 |
| 6 | Solo se factura un pedido **CONFIRMADO** | `facturas.js` | 409 |
| 7 | Un pedido facturado no se modifica | `pedidos.js` (`PUT` exige BORRADOR) | 409 |
| 8 | Anulación de factura **lógica** y con motivo | `facturas.js` | 400 |
| 9 | No se anula una factura **con pagos** | `facturas.js` | 409 |
| 10 | Nota de crédito **no devuelve más de lo pagado** | `notas-credito.js` | 400 |
| 11 | Nota de crédito solo sobre factura **ACTIVA** | `notas-credito.js` | 409 |
| 12 | Nota de crédito exige **motivo** | `notas-credito.js` + `motivo NOT NULL` | 400 |
| 13 | Una nota de crédito **aumenta** el saldo | Vista `factura_saldo` | — |
| 14 | El `clienteId` sale **del token**, nunca del navegador | `middleware/auth.js` + `mis.js` | 403/404 |
| 15 | Baja lógica (nunca `DELETE`) | `PATCH /estado` + anulaciones | — |
| 16 | Toda operación sensible se **audita** | `middleware/audit.js` | — |
| 17 | Nunca se guarda el número completo de tarjeta ni el CVV | `utils.js` `validarDatosPago` | — |

---

## 1. Cálculos financieros (el corazón del sistema)

**Los totales se calculan SIEMPRE en el servidor.** En `pedidos.js`, por cada línea:

```js
const precioUnitario = Number(prod.rows[0].precio);   // ← de la BD, NUNCA del body
const lineaSubtotal  = round2(precioUnitario * cantidad);
const lineaImpuesto  = round2(lineaSubtotal * (Number(prod.rows[0].impuesto) / 100));
subtotal  = round2(subtotal + lineaSubtotal);          // round2 en CADA paso
impuestos = round2(impuestos + lineaImpuesto);
const total = round2(subtotal + impuestos);
```

Tres decisiones deliberadas y correctas:

1. **El precio se lee de la base de datos**, no del cliente. Un usuario malicioso no puede enviar
   `precio: 1`. El `precio_unitario` se **copia** a `detalle_pedido` para congelar el precio del
   momento de la venta (si luego cambia el producto, la factura histórica no se altera).
2. **`round2()` en cada acumulación**, no solo al final. Esto evita que se acumule error de coma
   flotante (`utils.js`: `Math.round(n * 100) / 100`).
3. **`impuesto` es un porcentaje** (0–100, con CHECK en BD), no un valor absoluto.

El frontend **también** calcula totales (`PedidoForm.jsx` con `useMemo`), pero es **solo una vista
previa** y la UI lo advierte explícitamente ("Los valores se calculan en el servidor"). No es una
segunda fuente de verdad.

## 2. El saldo: derivado, nunca almacenado

**Decisión de diseño clave:** no existe una columna `saldo` en ninguna tabla. Se calcula en la vista
`factura_saldo`:

```
saldo = total − Σ pagos + Σ notas_crédito_ACTIVAS
```

Y el estado de pago se **deriva** también:

| `estado_pago` | Condición |
|---|---|
| `ANULADA` | `facturas.estado = 'ANULADA'` |
| `PENDIENTE` | `Σ pagos − Σ NC <= 0` |
| `PAGADA` | `saldo <= 0` |
| `PAGO_PARCIAL` | cualquier otro caso |

**Por qué está bien:** no hay posibilidad de que el saldo quede desincronizado con los pagos, porque
no se guarda. Es la opción correcta. El precio que se paga es un `JOIN` + `GROUP BY` en cada consulta.

**El detalle conceptual que hay que entender:** una nota de crédito **SUMA** al saldo. No lo resta.
La lógica es: si el cliente pagó 100 y se le devuelven 30, ese pago se **revierte** y la factura
vuelve a deber 30. Por eso `saldo = total − pagos + notas_credito`. El propio SQL lo documenta:
*"Las notas de crédito activas aumentan el saldo (reversan pagos)."*

---

## 3. Ciclo de vida del pedido

```
        POST /pedidos
              │
              ▼
        ┌──────────┐   PATCH estado=CONFIRMADO    ┌─────────────┐
        │ BORRADOR │ ───────────────────────────► │ CONFIRMADO  │
        └──────────┘                              └─────────────┘
              │                                          │
              │ PATCH estado=CANCELADO                   │ POST /facturas
              ▼                                          ▼
        ┌───────────┐                             ┌────────────┐
        │ CANCELADO │                             │ FACTURADO  │
        └───────────┘                             └────────────┘
```

Transiciones permitidas (en `pedidos.js PATCH /:id/estado`):
- `BORRADOR → CONFIRMADO` ✅
- `BORRADOR → CANCELADO` ✅
- `CONFIRMADO → CANCELADO` ✅
- **Cualquier otra → 409** `Transición X → Y no permitida`

`FACTURADO` **nunca** se pone desde este endpoint: lo pone `facturas.js` al generar la factura.

**Modificación:** `PUT /pedidos/:id` exige `estado = 'BORRADOR'` (409 si no). Es decir, **una vez
confirmado un pedido ya no se puede editar**. Implementación: borra todas las líneas
(`DELETE FROM detalle_pedido`) y las reinserta con el recálculo completo, todo dentro de una
transacción.

## 4. Facturación

`POST /api/facturas { pedidoId }` valida en este orden exacto:

1. `pedidoId` presente → si no, **400**
2. El pedido existe → si no, **404**
3. No está `CANCELADO` → **409** "No se puede facturar un pedido cancelado"
4. **Está `CONFIRMADO`** → **409** "El pedido debe estar CONFIRMADO antes de facturarse"
5. No tiene ya una factura → **409** "El pedido ya tiene una factura asociada"
6. El cliente existe → **400**

Luego: inserta la factura copiando `subtotal/impuestos/total` **del pedido** (no recalcula — ya se
calculó bien al crear el pedido), pone `fecha_vencimiento = NOW() + 30 días`, genera
`numero_factura = 'FAC-' + padStart(6,'0')`, y marca el pedido como `FACTURADO`. Todo en transacción.

### Anulación de factura
`POST /api/facturas/:id/anular { motivo }`:
- `motivo` no vacío → **400**
- La factura existe → **404**
- Está `ACTIVA` → **409** "La factura no está activa"
- **No tiene pagos** → **409** "No se puede anular una factura con pagos registrados (regla de negocio)"

Es **anulación lógica**: no se borra nada, se marca `estado='ANULADA'` + `motivo_anulacion` +
`fecha_anulacion` + `usuario_anulacion`. Después intenta devolver el pedido a `CONFIRMADO`.

> 🐛 **Rompe la promesa del comentario:** el código comenta *"El pedido vuelve a quedar disponible
> para refacturación"*, pero `facturas.pedido_id` es `NOT NULL UNIQUE`. Refacturar ese pedido viola el
> UNIQUE y devuelve **500**. En la práctica, anular una factura es un **callejón sin salida**.
> La suite e2e anula facturas pero **nunca refactura el mismo pedido**, así que no lo detecta.

## 5. Pagos

`POST /api/pagos { facturaId, valor, metodoPago, ... }` — **transacción**:
- `facturaId` y `valor > 0` → **400**
- La factura existe → **404**
- Está `ACTIVA` → **409** "Solo se pueden registrar pagos en facturas activas"
- **`valor <= saldo`** → **400** `El valor supera el saldo pendiente ($ X)`

donde `saldo = round2(total − Σ pagos)`.

### Validación por método de pago (`utils.js → validarDatosPago`)

| Método | Exige | Devuelve para persistir |
|---|---|---|
| `EFECTIVO` | nada | `{}` |
| `TARJETA` | número 13–19 dígitos **que pase Luhn**; CVV 3–4 dígitos; vencimiento `MM/AA` **no vencido**; banco; titular (≥3 chars) | `banco`, `titular`, `tipo_tarjeta`, **`ultimos_digitos_tarjeta`** (solo 4), `vencimiento_tarjeta` |
| `TRANSFERENCIA` | banco; cuenta 4–20 dígitos; referencia (≥4 chars) | `banco`, `numero_cuenta` |
| `CHEQUE` | banco; referencia (≥4 chars) | `banco` |

> 🔒 **Regla de seguridad PCI-DSS, y está bien implementada:** la función **devuelve únicamente los
> campos seguros**. El número completo de la tarjeta y el CVV **se usan para validar y se descartan** —
> nunca llegan al `INSERT`. Solo se persiste `n.slice(-4)` y la marca derivada (`VISA`/`MASTERCARD`/
> `AMEX`/`OTRA`). Hay una prueba e2e que verifica que la respuesta cruda **no** contiene
> `codigoServicio` ni el número completo.

### El algoritmo de Luhn
`validarLuhn()` implementa el dígito verificador correctamente: recorre de derecha a izquierda,
duplica cada segundo dígito, resta 9 si supera 9, y comprueba `suma % 10 === 0`. Exige 13–19 dígitos.
Tarjeta de prueba válida: `4111111111111111`.

### ✅ Dos agujeros en la validación de saldo — CORREGIDOS

**1. El saldo ignora las notas de crédito.** Tanto `pagos.js` como `mis.js` calculan:
```sql
COALESCE(SUM(p.valor), 0) AS pagado   --  ← solo pagos, sin notas_credito
```
mientras la vista `factura_saldo` usa `total − pagos + notas_credito`. **Son dos definiciones de
saldo distintas.** Consecuencia: en una factura que tiene notas de crédito activas, el sistema acepta
un pago **mayor** que el saldo real → **sobrepago**.

Ejemplo: factura de 100, pagada 50 (saldo real 50). Se emite una NC de 20 → el saldo real pasa a **70**.
Pero `pagos.js` calcula `100 − 50 = 50`, así que acepta hasta 50 más. Total cobrado: 100 sobre una
factura de 100 con 20 devueltos → **se cobró 20 de más**.

**2. No hay bloqueo de fila.** Ningún `SELECT` del backend usa `FOR UPDATE` ni hay transacciones
`SERIALIZABLE` / `REPEATABLE READ`. Con `READ COMMITTED` (el default de Postgres), **dos pagos
concurrentes** pueden leer el mismo `pagado`, pasar ambos la validación y sobrepasar el saldo.

## 6. Notas de crédito (devoluciones)

`POST /api/notas-credito { facturaId, valor, motivo }` — **transacción**:
- `facturaId`, `valor > 0` y `motivo` no vacío → **400**
- La factura existe → **404**
- Está `ACTIVA` → **409** "Solo se pueden crear notas crédito sobre facturas activas"
- `disponible = round2(pagado − notasPrevias)`:
  - `disponible <= 0` → **409** "No hay pagos disponibles para devolver en esta factura"
  - `valor > disponible` → **400** "El valor supera lo pagado disponible"

Genera `numero_nota = 'NC-' + padStart(6,'0')` y devuelve `saldo_restante_devolver`.

**La regla es correcta en su intención:** solo puedes devolver dinero que **efectivamente se pagó** y
que **no se haya devuelto ya**.

### ✅ BUG GRAVE (CORREGIDO): el cálculo de `disponible` estaba inflado por un producto cartesiano

La consulta mete **dos `LEFT JOIN` a tablas "hijas" en la misma query**:

```sql
SELECT f.factura_id, f.numero_factura, f.cliente_id, f.estado,
       COALESCE(SUM(p.valor), 0)::float8 AS pagado,
       COALESCE(SUM(CASE WHEN nc.estado='ACTIVA' THEN nc.valor END), 0)::float8 AS notas_previas
FROM facturas f
LEFT JOIN pagos p          ON p.factura_id  = f.factura_id
LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id
WHERE f.factura_id = $1
GROUP BY f.factura_id
```

Con **P** pagos y **N** notas activas el join genera **P×N filas**: `SUM(p.valor)` queda multiplicado
por **N** y `SUM(nc.valor)` por **P**.

**Verificación aritmética** ([`_verificacion-fanout.mjs`](_verificacion-fanout.mjs), ejecutable sin BD):

| Escenario | `pagado` real | `pagado` calculado | `notas` real | `notas` calculado | Efecto |
|---|---|---|---|---|---|
| 2 pagos (50+50), 1 nota (30) sobre factura de 100 | 100 | 100 ✅ | 30 | **60** ❌ | `disponible` deflactado |
| 1 pago (40), 2 notas (10+10) sobre factura de 100 | 40 | **80** ❌ | 20 | 20 ✅ | **`disponible` inflado → permite devolver de más** |

**Consecuencia:** con 2 pagos y 1 nota, `disponible = (2×Σpagos) − Σnotas`, que puede ser **mayor que
lo realmente pagado**. Un cajero podría emitir una devolución superior al dinero recibido.

**El mismo patrón defectuoso** (dos LEFT JOIN a hijas en una sola query) está en la **vista
`factura_saldo`** — ver regla 2. Allí afecta a `valor_pagado`, `saldo`, `notas_credito` y
`estado_pago` de **toda la API**.

> ⚠️ **Por qué la suite e2e no lo detecta:** ninguna factura de prueba acumula **a la vez** más de un
> pago y más de una nota de crédito. Con `P ≤ 1` o `N ≤ 1` la multiplicación no cambia nada.
> Es un bug que solo aparece con datos "reales" de varias operaciones.

**Corrección recomendada** (agregar por separado, sin join cruzado):
```sql
SELECT f.factura_id, f.numero_factura, f.cliente_id, f.estado,
       (SELECT COALESCE(SUM(p.valor), 0) FROM pagos p WHERE p.factura_id = f.factura_id)::float8 AS pagado,
       (SELECT COALESCE(SUM(nc.valor), 0) FROM notas_credito nc
         WHERE nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA')::float8 AS notas_previas
FROM facturas f WHERE f.factura_id = $1
```

`POST /:id/anular` exige `motivo` no vacío (400), exige `ACTIVA` (409) y hace anulación **lógica**
(marca `ANULADA` + fecha + usuario + motivo). Al anularse, deja de sumar al saldo.

## 7. Aislamiento del portal del cliente (regla de seguridad crítica)

Esta es **la** regla que protege los datos entre clientes:

```js
// mis.js
router.use(requireAuth, requireCliente);   // exige tipo='cliente' Y clienteId en el token

// Y en CADA consulta:
WHERE ... cliente_id = $1   // ← $1 = req.user.clienteId  (DEL TOKEN)
```

**El `clienteId` se toma siempre del token JWT firmado, nunca del body, la query o la URL.** Un
cliente no puede leer datos de otro ni manipulando la petición. Las rutas de detalle refuerzan con
`WHERE factura_id = $1 AND cliente_id = $2`, devolviendo **404** (no 403) para no revelar siquiera la
existencia del recurso ajeno. Hay pruebas e2e específicas para esto.

`requireCliente` (`middleware/auth.js`) hace dos comprobaciones: `tipo === 'cliente'` y que exista
`clienteId`. Si no → 403.

## 8. Auditoría

`audit({ usuario, usuarioTipo, modulo, operacion, registro, descripcion })` inserta en la tabla
`auditoria`. Se llama en cada mutación relevante.

Módulos registrados: `Autenticación, Usuarios, Clientes, Productos, Pedidos, Facturas, Pagos,
NotasCrédito`.
Operaciones: `LOGIN, LOGIN_FALLIDO, AUTORREGISTRO, RECUPERAR_SOLICITAR, CLAVE_RECUPERADA, CREAR,
ACTUALIZAR, ESTADO, CLAVE, CUENTA, GENERAR, ANULAR, REGISTRAR, PAGO_PORTAL, CODIGO_EFECTY`.

> ⚠️ **`audit()` nunca falla la operación** (envuelto en try/catch que solo hace `console.error`) y se
> invoca **después del COMMIT**. Es "fire and forget": la operación de negocio puede persistir **sin**
> su registro de auditoría. En un sistema con requisito de auditoría estricto, esto permitiría actuar
> sin dejar rastro si la inserción falla.

## 9. Baja lógica (nunca DELETE)

**Nada se borra nunca** en este sistema:
- Clientes y productos → `PATCH /:id/estado` con `ACTIVO` / `INACTIVO`
- Facturas → `estado = 'ANULADA'` con motivo obligatorio
- Notas de crédito → `estado = 'ANULADA'` con motivo obligatorio
- Pedidos → `estado = 'CANCELADO'`

La única excepción real es `detalle_pedido`, que sí se borra al reeditar un pedido en `BORRADOR`
(es correcto: son líneas reemplazables, no historial).

## 10. Seguridad de contraseñas y sesiones

- Contraseñas y **códigos OTP** siempre con **bcrypt, coste 10**. El OTP nunca se guarda en texto plano.
- JWT firmado con `config.jwtSecret`, vida **8 h**. Payload con `tipo` + `rol` (interno) o
  `tipo` + `clienteId` (cliente).
- **Fuerza bruta:** 5 fallos consecutivos por IP → 429. Solo se cuentan los **401**; un acierto
  **resetea** el contador de la IP (bien pensado: un usuario legítimo que se equivoca no queda
  bloqueado). El contador es un `Map` **en memoria** con ventana fija de 15 min.
- **Anti-spam:** autoregistro 20/h por IP; recuperación 40/15 min por IP.

### Flujo del OTP (recuperación de contraseña)

```
1. POST /auth/recuperar-solicitar  { username, canal }
   ├─ invalida solicitudes previas (usado = TRUE)
   ├─ OTP de 6 dígitos → bcrypt → recuperaciones_clave (expira en 10 min)
   └─ respuesta GENÉRICA (no revela si la cuenta existe)
      ⚠️ pero si OTP_RETORNO_DEMO=on (DEFAULT), incluye demo_otp en la respuesta

2. POST /auth/recuperar-cambiar  { username, codigo, nuevaClave }
   ├─ codigo debe ser /^\d{6}$/ y nuevaClave >= 6 chars
   ├─ máximo 5 intentos → 429 y la solicitud se marca usada
   ├─ expiración comprobada → 400
   ├─ bcrypt.compare
   └─ si acierta: nueva clave + invalida TODAS las recuperaciones de la cuenta
```

> ⚠️ **El OTP se genera con `Math.random()`, no con `crypto.randomInt()`.** Para un código de
> seguridad eso es una debilidad (el generador de `Math.random` no es criptográficamente seguro).
> En un proyecto académico es aceptable, pero es un cambio de una línea que conviene hacer.

> ⚠️ **Los JWT sobreviven al cambio de contraseña.** No hay `tokenVersion`, ni blacklist, ni endpoint
> de logout. Si a alguien le roban el token y cambia la contraseña para protegerse, **el token robado
> sigue siendo válido hasta 8 horas**.

## 11. Resumen: cómo verificar que no rompiste nada

```bash
cd backend
npm run seed   # datos demo (idempotente)
npm test       # 154 comprobaciones e2e
```

La suite cubre específicamente: las reglas 1–14 de la tabla de arriba, el aislamiento del portal, las
validaciones de tarjeta (Luhn, CVV, vencimiento), el flujo OTP completo, los rate limits, las
cabeceras de seguridad y **que el CVV y el número completo de tarjeta no se persistan ni se devuelvan**.

**No cubre:** el fan-out de notas de crédito/pagos (reglas 2 y 10) ni el endpoint
`GET /mis-pagos/efecty-codigo`. Si vas a tocar saldos, escribe primero una prueba con **2 pagos y
1 nota** en la misma factura.

---

*Siguiente: [`06-FRONTEND.md`](06-FRONTEND.md) para la interfaz.*
