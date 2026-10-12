# 10 · Mejoras aplicadas en la segunda revisión

> Documento de registro: **qué se cambió, por qué y cómo**, para todos los hallazgos que quedaban
> pendientes en [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md).
>
> **Resultado:** la suite e2e pasó de **112 a 139 comprobaciones**, todas en verde.
> Verificado contra PostgreSQL 16 real, no solo por lectura del código.

## Índice

- [Cómo se verificó](#cómo-se-verificó)
- [🔴 Alto (A1–A7)](#-alto-a1a7)
- [🟡 Medio (M1–M11)](#-medio-m1m11)
- [🔵 Bajo (limpieza)](#-bajo-limpieza)
- [⚠️ Lo que tienes que hacer tú: la migración](#️-lo-que-tienes-que-hacer-tú-la-migración)
- [Bugs que introduje yo y corregí](#bugs-que-introduje-yo-y-corregí)
- [Qué sigue pendiente](#qué-sigue-pendiente)

---

## Cómo se verificó

No me fié de leer el código. El método fue:

1. Levantar un **PostgreSQL 16 aislado** (contenedor y volumen propios, puerto 55434) creado desde
   el `init.sql` corregido.
2. Sembrarlo con `seed.js` y arrancar el backend con el código nuevo.
3. Ejecutar **`node scripts/e2e.mjs`**.

Resultado final: **`=== Resultado: 139 aprobadas, 0 fallidas ===`**

### Y comprobé que las pruebas nuevas sirven

Una prueba de regresión que nunca falla no protege de nada. Anulé a propósito la comprobación de
`token_version` (A7) y volví a correr el diagnóstico:

| Versión del código | Token anterior al cambio de contraseña | ¿Detecta? |
|---|---|---|
| Con la comprobación **activa** | `401` ✅ | — |
| Con la comprobación **anulada** a propósito | `200` ❌ | **Sí** |

Es decir: la prueba falla cuando debe fallar.

> ⚠️ **Aviso de método:** los `rate limit` viven en memoria del proceso (40/15 min). Si corres
> `npm test` varias veces seguidas verás **429** y fallos que no son reales. **Reinicia el backend**
> entre corridas. Es un comportamiento preexistente del proyecto, no un fallo nuevo.

---

## 🔴 Alto (A1–A7)

### A1 · El `JWT_SECRET` de producción estaba en el repositorio

**Qué pasaba.** `docker-compose.yml` traía:

```yaml
JWT_SECRET: ${JWT_SECRET:-finanx-prod-secret-cambiar-por-una-clave-segura-de-32-caracteres}
```

Y `config.js` solo comprobaba **longitud ≥ 32**. Ese literal mide más de 32, así que **pasaba la
validación**: un despliegue sin variables de entorno arrancaba con un secreto **publicado en el
repositorio** y cualquiera podía firmar tokens y entrar como ADMIN.

**Por qué es grave.** La autenticación se apoya por completo en la firma del JWT. Con el secreto
conocido, el resto de controles (roles, aislamiento del portal, rate limits) son irrelevantes: basta
fabricar un token con `rol: 'ADMIN'`.

**Qué se hizo.**

- `docker-compose.yml`: el valor por defecto **se elimina**; ahora es obligatorio, con mensaje de
  ayuda si falta (`${JWT_SECRET:?...}`). Docker Compose se detiene en vez de arrancar inseguro.
- `config.js`: además de la longitud, se **rechazan los valores de ejemplo** que aparecen en el
  repositorio o la documentación (`finanx-prod-secret`, `finanx-dev-secret`, `cambiar`,
  `cambia-esta-clave`, `changeme`). Y ahora se exige **también en desarrollo** (antes no), para que
  nadie desarrolle con un secreto por defecto y lo lleve a producción.
- Se generaron secretos reales en `backend/.env` y `.env` (raíz), **ambos ignorados por git**.
- `backend/.env.example` se reescribió: estaba desactualizado (le faltaban todas las variables de
  seguridad y OTP) y su `JWT_SECRET=cambia-esta-clave` era una plantilla engañosa.

**Cómo se comprobó.**

| Caso | Resultado |
|---|---|
| Sin `JWT_SECRET` | ❌ no arranca, explica cómo generar uno |
| El valor que tenía docker-compose | ❌ rechazado, nombra el valor encontrado |
| `cambia-esta-clave` (del `.env.example`) | ❌ rechazado |
| Secreto de 5 caracteres | ❌ rechazado por longitud |
| Secreto aleatorio de 64 caracteres | ✅ arranca |
| `docker compose config` sin la variable | ❌ se detiene con instrucciones |

---

### A2 · `OTP_RETORNO_DEMO` activo también en producción

**Qué pasaba.** `config.otpDemo` era `(process.env.OTP_RETORNO_DEMO || 'on') !== 'off'`, y Compose
fijaba `OTP_RETORNO_DEMO: ${OTP_RETORNO_DEMO:-on}`. Con `NODE_ENV=production`.

**Por qué es grave.** Con esto activo, la respuesta de `POST /auth/recuperar-solicitar` **incluye el
código OTP** y la interfaz lo muestra. Cualquiera puede pedir el código de otra cuenta y
**cambiarle la contraseña**: el segundo factor queda anulado. Es la diferencia entre "recuperar tu
cuenta" y "cualquiera toma tu cuenta".

**Qué se hizo.** El valor por defecto ahora **depende del entorno**: en producción `off`, en
desarrollo `on` (para poder demostrar el flujo sin proveedor real de SMS/correo). Compose ya no
impone `on`; deja la variable vacía y decide el backend. Se puede forzar con
`OTP_RETORNO_DEMO=on` de forma explícita y consciente.

**Cómo se comprobó:** `NODE_ENV=production → otpDemo = false`; `NODE_ENV=development → true`.

---

### A3 · El panel de inicio estaba roto para CAJERO y FACTURADOR

**Qué pasaba.** `Dashboard.jsx` hacía:

```js
const [r, a] = await Promise.all([api.get('/reportes/resumen'), api.get('/auditoria', ...)]);
```

`/api/auditoria` exige `ADMIN, SUPERVISOR` y `/api/reportes` excluye a `CAJERO`. Con `Promise.all`,
**un solo rechazo tumba todo**: el `catch` pintaba un `ErrorBox` y **ninguna** de las 7 tarjetas
aparecía. Un CAJERO abría la aplicación y veía una pantalla de error.

**Qué se hizo.** `Promise.allSettled` (cada parte se pinta si está disponible) y la auditoría **solo
se pide si el rol tiene permiso**, evitando el 403 innecesario.

**Cómo se comprobó:** prueba de que `/reportes/resumen` responde y de que el panel no depende de la
auditoría para mostrarse.

---

### A4 · Dos pagos simultáneos podían sobrepasar el saldo

**Qué pasaba.** Ningún `SELECT` usaba `FOR UPDATE`. Con el nivel por defecto de PostgreSQL
(`READ COMMITTED`), dos transacciones concurrentes pueden leer el **mismo** saldo, pasar las dos la
validación `valor <= saldo` e insertarse ambas → **sobrepago**.

**Por qué importa.** No es teórico: dos cajeros cobrando la misma factura a la vez, o el cliente
pagando desde el portal justo cuando el cajero registra el pago.

**Qué se hizo.** `FOR UPDATE OF f` al leer la factura, en los **dos** flujos de pago
(`POST /api/pagos` y `POST /api/mis-pagos`). El segundo espera a que el primero confirme y relee el
saldo real. También se añadió en la anulación de facturas, para que no se cuele un pago entre la
comprobación "no tiene pagos" y la anulación.

**Nota honesta:** verificar concurrencia de verdad requiere lanzar peticiones en paralelo. La suite
comprueba que el flujo sigue siendo correcto; el bloqueo es la garantía estructural.

---

### A5 · Operaciones de varios pasos sin transacción

**Qué pasaba.** Tres sitios hacían varios cambios seguidos sin `BEGIN/COMMIT`. El más claro:
**anular una factura** hacía dos `UPDATE` sueltos (anular + devolver el pedido a `CONFIRMADO`). Si
fallaba el segundo, la factura quedaba **anulada con el pedido en `FACTURADO`** — estado imposible.

**Qué se hizo.**

| Ruta | Antes | Ahora |
|---|---|---|
| `POST /api/facturas/:id/anular` | 2 UPDATE sueltos | transacción |
| `POST /api/auth/recuperar-cambiar` | clave + OTP + intentos sueltos | transacción |
| `PATCH /api/usuarios/:id` | 2 UPDATE + auditorías sueltos | transacción |

---

### A6 · La auditoría podía perder registros

**Qué pasaba.** `audit()` insertaba **después del COMMIT** y contra el *pool*, envuelto en un
try/catch que **nunca relanza** (solo `console.error`). Por tanto: la operación podía quedar guardada
**sin su registro de auditoría**. En un sistema donde la auditoría es un requisito funcional
(`RF-A01/A02`), eso permite actuar sin dejar rastro.

**Qué se hizo.** `audit()` acepta ahora un `client` (la conexión de la transacción) y se llama
**antes del COMMIT**, dentro de la transacción, en todas las rutas que la abren: facturas (crear y
anular), pagos, pagos del portal, notas de crédito, pedidos (crear y modificar), registro de clientes
y recuperación de contraseña. Si la auditoría falla, **la operación completa se revierte** — que es
el comportamiento correcto para un sistema auditable.

---

### A7 · Los JWT sobrevivían al cambio de contraseña

**Qué pasaba.** Un JWT no se puede revocar: vale hasta que caduca (**8 h**). Si a alguien le robaban
el token y cambiaba su contraseña para protegerse, **el token robado seguía funcionando**. La víctima
no podía expulsar al atacante.

**Qué se hizo.**

1. Columna `token_version` (INT, por defecto 1) en `usuarios` y `usuario_cliente`.
2. El token lleva ese número en el campo `ver` al emitirse.
3. `requireAuth` compara el `ver` del token con el valor actual en la base en **cada petición
   autenticada**. Si no coinciden → **401** "La sesión se cerró porque la contraseña cambió".
4. Se incrementa al cambiar la contraseña (`recuperar-cambiar`, `PATCH /usuarios/:id`) y al
   **desactivar** una cuenta (un usuario bloqueado no debe seguir usando su token).

**Coste:** una consulta ligera por clave primaria en cada petición autenticada.

**Cómo se comprobó:** ver la tabla de la sección *Cómo se verificó* — y hay además dos pruebas
dedicadas en la suite (token anterior → 401, token del registro original → 401, token nuevo → 200,
token con firma manipulada → 401).

**⚠️ Requiere migración** (ver más abajo).

---

## 🟡 Medio (M1–M11)

| # | Problema | Solución | Cómo se comprueba |
|---|---|---|---|
| **M1** | El login distinguía `403 "cuenta inactiva"` de `401`, y `recuperar-cambiar` daba `404`: **revelaban qué cuentas existen** | La contraseña se valida **antes** que el estado, así el mensaje de inactividad solo lo ve quien ya demostró conocer la contraseña. `recuperar-cambiar` responde genérico | Login con contraseña mala de cuenta existente y de cuenta inexistente devuelven **el mismo 401** |
| **M2** | El OTP se generaba con `Math.random()` (predecible, no criptográfico) | `crypto.randomInt(100000, 1000000)` | Flujo OTP completo en la suite |
| **M3** | `PUT /clientes/:id` no validaba duplicados → violar el UNIQUE daba **500** en vez de 409 | Validación de duplicado (excluyendo el propio cliente) + campos obligatorios | Editar con identificación ya usada → **409**; sin campos → **400** |
| **M4** | La contraseña ≥6 solo se exigía en 2 de 4 sitios | Helper `validarPassword()` usado en registro, recuperación, alta de usuario interno y cuenta de portal | Contraseña de 1 carácter → **400** en ambos sitios nuevos |
| **M5** | `PATCH /usuarios` aceptaba **cualquier** valor de `estado` (la columna no tiene CHECK) | Lista blanca `ACTIVO`/`INACTIVO`, como clientes y productos | `estado: 'CUALQUIERA'` → **400** |
| **M6** | `metodo_pago` sin validar en app ni en BD: se guardaba cualquier cadena y desaparecía de los informes | Constante `METODOS_PAGO` + lista blanca en los dos flujos de pago | `metodoPago: 'BITCOIN'` → **400** |
| **M7** | `GET /reportes/facturacion` con fechas daba `saldo_pendiente` **incorrecto**: la subconsulta restaba los pagos de **todas** las facturas del sistema, sin el filtro de fechas | La subconsulta reutiliza **los mismos índices `$n`** que la consulta principal, aplicando el rango a `f2` | Reporte con rango y sin rango responden y son coherentes |
| **M8** | `GET /facturas/:id/pagos` devolvía `[]` si la factura no existía | **404**, como el resto de endpoints de detalle | Factura 999999 → **404** |
| **M9** | Un id no numérico (`/facturas/abc`) llegaba a PostgreSQL como `NaN` → **500** | Helper `idNumerico()` → **400**. Aplicado en 7 rutas | 5 rutas + `PUT /productos/abc` + pago con `facturaId: 'abc'` → **400** |
| **M10** | `auditoria` interpolaba el `LIMIT` en el SQL (único sitio del backend) y `modulo ILIKE` sin comodines | `LIMIT` parametrizado y acotado 1–500; `modulo` con comodines como `usuario` | `limit=-5` → **200** acotado (antes 500); `modulo=Paga` encuentra "Pagos" |
| **M11** | Fechas en **UTC**: en Colombia (UTC−5) una factura de las 20:00 aparecía con la fecha del día siguiente | `toLocaleDateString` con `timeZone: 'America/Bogota'` | Formato correcto en `resumen-correo` |

---

## 🔵 Bajo (limpieza)

| Qué | Dónde | Por qué |
|---|---|---|
| `.alert-info` usaba `var(--brand-light)` y `var(--brand)`, **variables que no existen** en `:root` | `styles.css` | Una variable CSS inexistente no da error: deja el fondo y el color sin aplicar. Los avisos informativos (OTP en Login, aviso PCI en PagarModal) salían sin estilo. Corregido a `--accent-light` / `--primary` |
| `className="btn primary"` en vez de `btn-primary` | `PagarModal.jsx` | La clase `.primary` no existe: el botón "Generar código Efecty" perdía el estilo |
| Cabecera con 9 `<th>` y cuerpo con 10 `<td>` | `Facturas.jsx` | Tabla desalineada. Añadidas las dos columnas que faltaban |
| `<Estado value="ACTIVO" tone="green">Cuenta</Estado>` | `Clientes.jsx` | `Estado` ignora `tone` y los `children`: renderizaba la insignia "ACTIVO" en vez de "Cuenta". Sustituido por `<Badge tone="green">` |
| Código muerto: `AUDITOR` (nunca usado), `num()` (nunca usado) | `audit.js`, `utils.js` | Eliminado |
| `GET /productos/:id` no existe, pero el id se parseaba igual | — | Documentado; la prueba de M9 usa el `PUT` |

*(No toqué `Topbar` y `EntityPill` de `Layout.jsx`: siguen siendo código muerto, pero eliminarlos
toca el layout y prefiero no arriesgar cambios visuales sin que los pidas.)*

---

## ⚠️ Lo que tienes que hacer tú: la migración

`init.sql` **solo se ejecuta al crear el volumen de PostgreSQL desde cero**. Tu base de datos actual
**no** tiene las columnas nuevas, así que la aplicación daría error al autenticar.

Aplica la migración una vez:

```bash
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_version_token.sql
```

Crea `usuarios.token_version` y `usuario_cliente.token_version`. Es **idempotente** (se puede
ejecutar varias veces sin efectos).

**Consecuencia esperada:** los tokens emitidos **antes** de la migración dejan de valer (no traen
`ver`), así que **hay que volver a iniciar sesión**. Es el precio de poder revocar sesiones.

Si prefieres empezar de cero: `docker compose down -v && docker compose up -d --build`
(⚠️ **borra los datos**).

---

## Bugs que introduje yo y corregí

Registro honesto, porque explica por qué tardé más de lo previsto y por qué conviene desconfiar de
los cambios "pequeños" hechos en masa:

1. **Corrompí los acentos de 6 archivos.** Usé un script de PowerShell con `Set-Content -Encoding utf8`
   sobre archivos UTF-8 sin BOM, y **doble-codifiqué** los acentos (`crédito` → `crÃ©dito`) y añadí
   BOM. Lo detecté comparando con git (que tenía 0 mojibake). **Solución:** restaurar desde git y
   reaplicar con `System.Text.UTF8Encoding($false)` + `.Replace()`, verificando **después de cada
   archivo**. Lección: no hacer reescrituras masivas de archivos con acentos.

2. **El token del registro no llevaba `ver`.** Al añadir A7, `/auth/registro` emitía el token sin el
   campo `ver`, así que `payload.ver || 1` lo trataba como versión 1 y el token moría en cuanto la
   cuenta cambiaba su contraseña alguna vez. Corregido: el `INSERT ... RETURNING` devuelve
   `token_version` y se incluye en el token.

3. **`payload.ver || 1` anulaba la comprobación.** Ese fallback hacía que un token **sin** `ver`
   coincidiera con el valor por defecto de la columna: la comprobación estaba escrita pero no
   protegía nada. Ahora un token sin `ver` se **rechaza**. Lo descubrí porque la prueba de regresión
   pasaba con la comprobación anulada a propósito — justo para eso sirve comprobar que la prueba
   falla.

4. **`METODOS_PAGO` e `idNumerico` sin importar.** Añadí su uso pero no siempre el `import`:
   `ReferenceError` → 500 en todos los pagos. Detectado en los logs del backend.

5. **Parámetros duplicados en `reportes.js`.** Empujé `desde`/`hasta` dos veces al array de
   parámetros → `bind message supplies 4 parameters, but prepared statement requires 2`. Corregido
   reutilizando los mismos índices `$n`.

6. **Purebas mal planteadas por mí.** `/productos/abc` no existe como `GET` (daba 403), y en
   `/mis-pagos` con `facturaId: 999999` el método por defecto `EFECTIVO` disparaba el 400 antes que
   el 404. Corregí las aserciones, no el producto.

Y un recordatorio operativo que me costó dos corridas fallidas: **el backend en contenedor ocupa el
puerto 4000**. Si arrancas el backend local sin detenerlo, tus peticiones van al contenedor (código
antiguo) y parece que las correcciones no funcionan.

---

## Qué sigue pendiente

De la revisión anterior quedan sin tocar, por decisión de alcance o porque requieren una decisión de
negocio:

| # | Qué | Por qué no se hizo |
|---|---|---|
| **C4** | Anular una factura deja el pedido imposible de refacturar (500, por el `UNIQUE` en `pedido_id`) | Hay que **decidir la regla de negocio**: ¿permitir N facturas por pedido, reemplazar la anulada, o un estado nuevo? No es solo técnica. Documenté el motivo en el código |
| **M12** | Los pagos del portal quedan con `usuario_id` NULL | El esquema no puede representar al pagador cliente por FK (`usuario_id` apunta a `usuarios`). Requiere cambio de esquema con impacto en datos existentes |
| **M13** | La documentación declara arquitectura hexagonal "pura" y el código es un monolito de 3 capas | Es una observación de expectativas, no un defecto. Corregirla es reescribir la documentación del proyecto, que no es mía |
| — | `Topbar` y `EntityPill` (código muerto) | Eliminarlos toca el layout; prefiero no arriesgar cambios visuales sin pedírtelo |
| — | Sin paginación (LIMIT 300/500 fijos) | Cambio de UX y de contrato de API; merece su propia decisión |
| — | `Efecty` es una simulación (el código no se persiste ni se redime) y su `vigencia_horas` está fijo en 24 | Requiere la integración real, que no existe |
| — | `auditoria` sin paginación/exportación | Mejora, no corrección |

---

*Segunda revisión. Ver [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md) para el
registro de la primera (el bug de saldos) y [`README.md`](README.md) para el índice.*
