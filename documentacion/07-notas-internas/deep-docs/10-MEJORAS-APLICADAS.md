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
- [Bugs que detecté y corregí](#bugs-que-detecté-y-corregí)
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
| **B12** | Los valores válidos de `estado`, `metodo_pago` y `usuario_tipo` solo estaban en comentarios SQL | Se añadieron **9 CHECK constraints**. La columna era TEXT sin restricción, así que nada impedía guardar un estado que el sistema no sabe interpretar (rompe filtros e informes) | La base rechaza un estado inventado |
| **B** | Un ADMIN podía desactivarse a sí mismo o al último ADMIN activo | Salvaguardas: **409** en ambos casos | Desactivarse a sí mismo → 409; con otro ADMIN activo → 200 |

*(No toqué `Topbar` ni `EntityPill` en esta primera pasada; se eliminaron después — ver la sección siguiente.)*

---

## Segunda tanda: los pendientes que quedaban

Tras la segunda revisión quedaban C4, M12 y algunas mejoras. Se resolvieron con una decisión de
negocio previa (te la pregunté porque no es solo técnica).

### C4 · Refacturar un pedido tras anular su factura

**Qué pasaba.** `facturas.pedido_id` era **UNIQUE**, así que un pedido no podía tener nunca una
segunda factura. Al anular una factura, el código devolvía el pedido a `CONFIRMADO` *"para poder
refacturarlo"*, pero al intentarlo se violaba el UNIQUE y el usuario recibía un **500**. La anulación
era un callejón sin salida.

**Decisión tomada:** permitir **una factura ACTIVA por pedido** y conservar las anuladas como
historial. Es lo que hace cualquier sistema de facturación real: la factura anulada es un documento
que debe existir (para auditoría) y el pedido debe poder facturarse de nuevo.

**Qué se hizo.**

1. Se **quita el UNIQUE** de `pedido_id`.
2. Se sustituye por un **índice único parcial**, que aplica solo a las facturas ACTIVA:
   ```sql
   CREATE UNIQUE INDEX uq_factura_activa_por_pedido
     ON facturas (pedido_id) WHERE estado = 'ACTIVA';
   ```
   La regla la impone **la base de datos**, no solo el código: si el código fallara, no podrían
   existir dos facturas activas del mismo pedido.
3. `POST /facturas` ahora comprueba solo las ACTIVA (`409` si ya hay una).
4. Las subconsultas que mostraban "la factura del pedido" usaban `LIMIT 1` y podían devolver **la
   anulada**. Ahora ordenan por `(estado = 'ACTIVA') DESC, factura_id DESC`, así que priorizan la
   activa y, si no hay, muestran la última anulada.

**Cómo se comprobó** (6 pruebas nuevas + prueba manual en el stack desplegado): facturar → 409 al
intentar facturar otra vez con una activa → anular → **refacturar devuelve 201 con otro número** →
el pedido apunta a la activa → la anulada sigue existiendo con estado `ANULADA`.

### M12 · Saber quién pagó desde el portal

**Qué pasaba.** `pagos.usuario_id` apunta a `usuarios` (personal interno). Un pago hecho por el
cliente desde el portal se guardaba con `usuario_id` **NULL**: el esquema no podía representar quién
pagó, y la trazabilidad dependía de `auditoria` (texto libre).

**Qué se hizo.** Se añadió `pagos.usuario_cliente_id` (FK a `usuario_cliente`). Ahora los dos actores
se distinguen:

| Origen del pago | `usuario_id` | `usuario_cliente_id` |
|---|---|---|
| Personal interno (`POST /api/pagos`) | el usuario | NULL |
| Cliente desde el portal (`POST /api/mis-pagos`) | NULL | el cliente |

Se conservan **las dos** columnas porque son dos tipos de actor distintos (no es un descuido: un
`usuario_id` polimórfico perdería la integridad referencial).

Además, `GET /api/pagos`, `GET /api/mis-pagos`, `GET /api/mi-historial` y
`GET /api/reportes/historial/:id` devuelven ahora `registrado_por` y `registrado_por_tipo`, y las
pantallas de pagos muestran esa columna ("Portal del cliente" vs "Personal interno").

**Cómo se comprobó:** pruebas de que hay pagos identificados como `CLIENTE` y como `INTERNO`, con
nombre, tanto en el panel interno como en el portal.

**Los pagos anteriores** quedan con ambas columnas NULL. Si quieres rellenarlos, se puede cruzar con
`auditoria` (los pagos del portal se registran con la operación `PAGO_PORTAL`).

### B12 · Dominios válidos en la base de datos

Se añadieron **9 CHECK constraints**: `estado` en usuarios, clientes, productos, usuario_cliente,
pedidos, facturas y notas_credito; `metodo_pago` en pagos; y `usuario_tipo` en auditoria. Antes los
valores válidos solo existían en comentarios SQL, así que un error de programación o una llamada
directa a la API podían dejar una fila con un estado que el sistema no interpreta.

### Salvaguardas de administrador

Un ADMIN podía **desactivarse a sí mismo** o **al último administrador activo**, dejando el sistema
sin acceso a la gestión de usuarios y sin forma de arreglarlo desde la aplicación. Ahora ambas cosas
devuelven **409** con un mensaje que explica qué hacer.

### Limpieza final

Eliminados `Topbar` y `EntityPill` de `Layout.jsx`: eran código muerto (nadie los importaba y
`EntityPill` siempre devolvía `null`).

### Estado final

**Suite e2e: 154 comprobaciones, todas en verde** (empezó en 99). Verificado contra PostgreSQL 16
real, y el frontend **compila** con los cambios (build de Vite en Docker).

---

## ⚠️ Las migraciones (ya aplicadas en esta máquina)

`init.sql` **solo se ejecuta al crear el volumen de PostgreSQL desde cero**. Si tu base ya existía,
necesita las migraciones; si la creas de nuevo, `init.sql` ya lo incluye todo.

Ya las apliqué a tu base de datos en ejecución. Para otra máquina, el orden es:

```bash
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_version_token.sql
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_notas_credito.sql
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_refacturacion_y_dominios.sql
```

| Migración | Qué añade |
|---|---|
| `migracion_version_token.sql` | `token_version` en usuarios y usuario_cliente (revocar sesiones) |
| `migracion_notas_credito.sql` | La vista `factura_saldo` corregida (sin producto cartesiano) |
| `migracion_refacturacion_y_dominios.sql` | Refacturación (quita el UNIQUE, índice parcial), `pagos.usuario_cliente_id` y los 9 CHECK |

Todas son **idempotentes**: se pueden ejecutar varias veces sin efectos secundarios.

**Consecuencia esperada:** los tokens emitidos **antes** de `migracion_version_token.sql` dejan de
valer (no traen `ver`), así que **hay que volver a iniciar sesión**. Es el precio de poder revocar
sesiones.

Si prefieres empezar de cero: `docker compose down -v && docker compose up -d --build`
(⚠️ **borra los datos**).

---

## Bugs que detecté y corregí

Registro honesto, porque explica por qué llevó más tiempo del previsto y por qué conviene desconfiar de
los cambios "pequeños" hechos en masa:

1. **Se corrompieron los acentos de 6 archivos.** Un script de PowerShell con `Set-Content -Encoding utf8`
   sobre archivos UTF-8 sin BOM **doble-codificó** los acentos (`crédito` → `crÃ©dito`) y añadió
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

4. **`METODOS_PAGO` e `idNumerico` sin importar.** Se añadió su uso pero no siempre el `import`:
   `ReferenceError` → 500 en todos los pagos. Detectado en los logs del backend.

5. **Parámetros duplicados en `reportes.js`.** Empujé `desde`/`hasta` dos veces al array de
   parámetros → `bind message supplies 4 parameters, but prepared statement requires 2`. Corregido
   reutilizando los mismos índices `$n`.

6. **Pruebas mal planteadas.** `/productos/abc` no existe como `GET` (daba 403), y en
   `/mis-pagos` con `facturaId: 999999` el método por defecto `EFECTIVO` disparaba el 400 antes que
   el 404. Se corrigieron las aserciones, no el producto.

Y un recordatorio operativo que costó dos corridas fallidas: **el backend en contenedor ocupa el
puerto 4000**. Si arrancas el backend local sin detenerlo, tus peticiones van al contenedor (código
antiguo) y parece que las correcciones no funcionan.

---

## Qué queda pendiente (y por qué)

Resueltos en esta tercera tanda: **C4** (refacturación), **M12** (pagador del portal), **B12** (CHECK
constraints), las salvaguardas de administrador y la limpieza final. Lo que queda **no son bugs**:

| # | Qué | Por qué no se hizo |
|---|---|---|
| **M13** | La documentación declara arquitectura hexagonal "pura" y el código es un monolito de 3 capas con buenas guardas | Es una **observación de expectativas**, no un defecto. Corregirlo es reescribir la documentación del proyecto (PDFs, HTMLs, specs), que no es mía |
| — | Sin paginación (los listados usan `LIMIT 300`/`500` fijos) | Es una **mejora de UX y un cambio de contrato de API** (hay que decidir el formato de paginación y tocar todas las pantallas). No es una corrección; dime si la quieres y la planteo aparte |
| — | `Efecty` es una **simulación**: el código se genera pero no se persiste, no hay endpoint que lo redima y `vigencia_horas` está fijo en 24 | Requiere la **integración real con Efecty**, que no existe. El código está preparado y documentado para conectarla |
| — | Entrega real del OTP por SMS/correo | Es una decisión de producto: hay que contratar un proveedor y conectarlo en `notificar.js`. El adaptador ya está aislado justo para eso |
| — | Sin verificación de correo en el autoregistro (el cliente nace ACTIVO) | Es una **decisión de negocio** (¿aprobación manual del administrador?). El código actual funciona así a propósito |
| — | Sin tests unitarios (la cobertura es e2e) | La suite e2e cubre las reglas de negocio de punta a punta; añadir unitarios es una mejora de proceso, no una corrección |

---

*Tercera revisión. Ver [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md) para el
registro de la primera (el bug de saldos) y [`README.md`](README.md) para el índice.*
