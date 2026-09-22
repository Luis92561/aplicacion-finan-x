# FINAN-X · Especificación Funcional

> **Propósito de este documento:** describir **qué** hace FINAN-X, para quién, bajo qué reglas, y qué debe poder comprobarse al final. Es la guía de requisitos para **recrear el proyecto desde cero** con Claude Code u OpenCode (léalo junto con `SPEC_Tecnico.md` y ejecute `PLAN_Creacion.md`).
>
> **Proyecto:** FINAN-X · **Desarrolladores:** Luis Alfredo Jaramillo Restrepo · Mayra Juliana Velez
> **Estado:** funcional · **Verificación:** suite e2e 99/99 aprobadas.
> **Proceso:** se desarrolló con **metodología ágil (entregas semanales, 6 sprints: 21 ago – 28 sep 2026)** y **arquitectura hexagonal** (núcleo de reglas de negocio + puertos/adaptadores). Ver sección 10 y `PLAN_Creacion.md`.

---

## 1. Qué es FINAN-X

FINAN-X es una aplicación web **de facturación y pagos** para una empresa. Tiene dos caras:

1. **Panel interno** para el personal de la empresa (Administrador, Facturador, Cajero, Supervisor): gestiona clientes, productos, pedidos, facturación, pagos, notas de crédito, balances, reportes y auditoría.
2. **Portal de autoservicio del cliente**: crear cuenta, ver saldo, facturas, pagos, notas de crédito e historial, y **pagar/abonar sus propias facturas en línea** (tarjeta, transferencia o cheque; el **efectivo** no se registra aquí: el portal genera un **código de pago Efecty** de 24 h para cancelar en un punto físico). También puede **recuperar su contraseña** con un código de seguridad de un solo uso (OTP) enviado por SMS o correo.

Es un proyecto **académico** (Ingeniería Informática, sexto semestre) pero construido con criterios de **producción**: seguridad, aislamiento de datos por cliente, registro de auditoría y pruebas automatizadas.

---

## 2. Actores y roles

### 2.1 Roles internos (usuarios de la empresa)

| Rol | Qué puede hacer (resumen) |
|---|---|
| **ADMIN** | Todo: gestión de usuarios internos, clientes, productos, pedidos, facturas, pagos, notas de crédito, reportes, auditoría. |
| **FACTURADOR** | Clientes, productos, pedidos, facturación, pagos, notas de crédito, reportes. |
| **CAJERO** | Registrar y consultar pagos y saldos; clientes, pedidos y facturas en consulta/registro. |
| **SUPERVISOR** | Consulta financiera: facturas, pagos, saldos, reportes, historial y auditoría. |

### 2.2 Cliente (usuario externo)

Solo ve y opera **sus propios datos** (aislamiento estricto por `clienteId`):
- Se **autoregistra** (empresa o persona) y entra de inmediato.
- Consulta su saldo, facturas, compras, pagos, notas de crédito e historial financiero.
- **Paga o abona** facturas propias: valor que no supere el saldo y, según el método, completa los datos en línea (tarjeta/transferencia/cheque).
- **Recupera su contraseña** si la olvidó, con OTP enviado por SMS o correo.

| Permiso | ADMIN | FACTURADOR | CAJERO | SUPERVISOR | CLIENTE |
|---|---|---|---|---|---|
| Gestión de usuarios internos | ✅ | — | — | — | — |
| Clientes / productos / pedidos / facturas / pagos / notas de crédito | ✅ | ✅ | ✅ | ✅* | — |
| Reportes / balance / auditoría | ✅ | ✅ | — | ✅ | — |
| Portal propio (saldo, pagos, historial) | — | — | — | — | ✅ |

\* El CAJERO y el SUPERVISOR operan sobre el mismo grupo de rutas; la distinción operativa está en los permisos de negocio que asigne la empresa (la API no discrimina más finamente por rol interno en estos módulos).

### 2.3 Historias de usuario (backlog)

El producto se especificó como **historias de usuario** en formato «Como **rol**, quiero **acción**, para **beneficio**», con criterios de aceptación y trazabilidad a las fases del `PLAN_Creacion.md` (columna *Fases*; las fases se distribuyen en los 6 sprints de la sección 10). Cada historia está cubierta por la suite e2e (99 casos, sección 8).

| ID | Épica | Historia de usuario | Criterios de aceptación (clave) | Fases |
|---|---|---|---|---|
| **HU-01** | Autenticación | Como **cliente**, quiero **crear mi cuenta de portal** (persona/empresa, identificación, usuario y contraseña), para **consultar y pagar mis facturas en línea**. | Identificación única (400 si existe); usuario único (400); contraseña ≥ 6 (400); nombre obligatorio (400); queda autenticado; anti-spam 20/h por IP. | 3 |
| **HU-02** | Autenticación | Como **usuario interno o cliente**, quiero **iniciar sesión con mi correo/usuario y contraseña**, para **acceder solo a la información que me corresponde**. | Token JWT 8 h; 5 fallos seguidos → 429/15 min; un login correcto resetea el contador. | 3 |
| **HU-03** | Autenticación | Como **cliente**, quiero **recuperar mi contraseña con un código de un solo uso (OTP)**, para **volver a entrar si la olvidé**. | Respuesta genérica (anti-enumeración); código 6 dígitos cifrado (bcrypt); vigencia 10 min; 5 intentos; 1 solo uso; login nuevo 200 / anterior 401. Ver §5. | 9 |
| **HU-04** | Autenticación | Como **administrador**, quiero **gestionar los usuarios internos** (crear, listar, habilitar/inhabilitar con rol), para **controlar quién accede al sistema**. | Solo rol ADMIN; estado ACTIVO/INACTIVO; correo y rol obligatorios. | 3 |
| **HU-05** | Clientes | Como **facturador**, quiero **registrar y actualizar clientes con identificación única**, para **facturar y cobrar correctamente**. | Duplicado por tipo + número → 400; listado con filtros `q`/estado; detalle consultable. | 3 |
| **HU-06** | Clientes | Como **facturador**, quiero **crear la cuenta de portal de un cliente**, para **que pueda autoserviciarse**. | Username + contraseña; usuario ya existente → 400. | 3 |
| **HU-07** | Clientes | Como **facturador**, quiero **generar el resumen financiero de un cliente**, para **enviárselo por correo**. | Reporte agregado del cliente (totales, saldo, estado). | 3 |
| **HU-08** | Productos | Como **facturador**, quiero **crear y mantener productos (precio e impuesto)**, para **registrar pedidos y facturas con montos correctos**. | Código único (400 si duplicado); precio ≥ 0 (400); impuesto 0–100 %; activar/inactivar. | 3 |
| **HU-09** | Pedidos | Como **cajero**, quiero **crear pedidos con 1..N productos para un cliente**, para **preparar la facturación**. | Totales (subtotal, impuestos, total) calculados en el servidor; el cliente no envía montos. | 3 |
| **HU-10** | Pedidos | Como **cajero**, quiero **confirmar o cancelar un pedido**, para **controlar el flujo hasta facturar**. | Solo BORRADOR → CONFIRMADO/CANCELADO; estados intermedios controlados (400 si no procede). | 3 |
| **HU-11** | Facturación | Como **facturador**, quiero **generar la factura de un pedido confirmado**, para **cobrar al cliente**. | 1 pedido → 0..1 factura; solo pedidos CONFIRMADO (400/409). | 3 |
| **HU-12** | Facturación | Como **facturador**, quiero **anular una factura indicando el motivo**, para **corregir errores**. | Motivo obligatorio (400); una sola vez (reanular → 409); los pagos se conservan y el saldo se recalcula. | 3 |
| **HU-13** | Pagos | Como **cajero**, quiero **registrar abonos o pagos en caja**, para **reducir el saldo pendiente**. | Sin sobrepago (400); estados PENDIENTE / PAGO_PARCIAL / PAGADA automáticos. | 3 |
| **HU-14** | Pagos | Como **cliente**, quiero **pagar o abonar mis propias facturas en línea**, para **cumplir mis pagos sin ir a la empresa**. | Aislamiento estricto: factura ajena → 404; valor ≤ saldo (400). | 3, 5 |
| **HU-15** | Pagos | Como **quien cobra o paga**, quiero **capturar los datos de pago en línea según el método** (tarjeta/transferencia/cheque), para **completar el pago con datos correctos**. | Luhn (13–19 dígitos); CVV 3–4; vencimiento vigente MM/AA; banco obligatorio; **nunca se guardan CVV/PAN**; la UI solo muestra resumen no sensible. Ver §6. | 10 |
| **HU-16** | Notas de crédito | Como **cajero**, quiero **crear notas de crédito por devoluciones**, para **ajustar el saldo del cliente**. | Valor ≤ recaudado (400 si supera); motivo obligatorio; las notas activas aumentan el saldo. | 8 |
| **HU-17** | Notas de crédito | Como **cajero**, quiero **anular una nota de crédito con motivo**, para **corregir una devolución**. | Una sola vez; reanular → 409; motivo obligatorio. | 8 |
| **HU-18** | Reportes | Como **supervisor**, quiero **ver reportes de facturación, resumen y balance por cliente**, para **tomar decisiones de negocio**. | Serie por período y por cliente; agregados correctos (verificado en e2e). | 3 |
| **HU-19** | Reportes | Como **supervisor**, quiero **consultar el historial financiero de un cliente**, para **ver su saldo móvil**. | Facturas, pagos y notas del cliente con saldo resultante por movimiento. | 3 |
| **HU-20** | Auditoría | Como **administrador**, quiero **revisar la auditoría de operaciones**, para **garantizar trazabilidad y detectar usos indebidos**. | Registro de usuario, tipo, módulo, operación y fecha en cada operación relevante. | 3, 6 |
| **HU-21** | Portal del cliente | Como **cliente**, quiero **ver mi saldo, facturas, compras, pagos y notas de crédito**, para **controlar mis finanzas en línea**. | Solo mis datos (aislamiento); detalle no sensible de medios de pago. | 5 |
| **HU-22** | Portal del cliente | Como **cliente**, quiero **consultar y actualizar mis datos personales**, para **mantener mi información al día**. | Acceso solo a la propia información (ajena → 404). | 5 |

**Nota de trazabilidad:** las historias se agrupan en **épicas** y se resuelven en las **fases** del `PLAN_Creacion.md` (columna *Fases*); las fases se distribuyen en los 6 sprints de la sección 10. Todas quedan cubiertas por la suite e2e (99 casos). El mismo backlog aparece en `FINAN-X_Documentacion.html` §2.4 (completo) y en `B_Guia_Tecnica_Desarrolladores.html` §2.3 (resumen).

---

## 3. Módulos funcionales

### 3.1 Autenticación
- **Login** con usuario (correo de usuario interno **o** username de cliente) + contraseña. Devuelve token JWT + datos del usuario.
- **Anti fuerza bruta:** ≥5 fallos consecutivos desde una IP → bloqueo **429** por 15 minutos. Un login correcto resetea el contador.
- **Autoregistro de cliente:** formulario con tipo (PERSONA/EMPRESA), identificación (CC/CE/NIT/PASAPORTE), número, nombre/razón social, contacto opcional, usuario y contraseña (mín. 6). Al registrarse lo deja autenticado. Validaciones: número de identificación único (400 si existe), usuario único (400), contraseña corta (400), nombre obligatorio. Anti-spam: **20 solicitudes/hora por IP**.
- **Recuperación de contraseña con OTP** — ver sección 5.

### 3.2 Usuarios internos (solo ADMIN)
- Listar usuarios y roles, crear usuario (nombre, correo, rol, contraseña) y habilitar/inhabilitar (estado ACTIVO/INACTIVO).

### 3.3 Clientes
- CRUD: listar (con filtros q/estado), ver detalle, crear (identificación única), cambiar estado, **crear cuenta de acceso al portal** (username + contraseña) y **generar resumen financiero para correo** (`resumen-correo`).

### 3.4 Productos
- Listar, crear (código único, nombre, precio ≥ 0, impuesto 0–100 %, categoría, unidad), activar/inactivar.

### 3.5 Pedidos
- Crear para un cliente con 1..N ítems `{ productoId, cantidad }`. **Los totales (subtotal, impuestos, total) los calcula el servidor** leyendo precio e impuesto actuales del producto — el cliente no los manda.
- Flujo de estados: `BORRADOR → CONFIRMADO → FACTURADO` (al facturar) o `CANCELADO`. Solo se puede confirmar un BORRADOR; estados intermedios controlados.

### 3.6 Facturación
- **Generar factura desde un pedido CONFIRMADO** (1 pedido → 0..1 factura). Verifica que el estado del pedido sea CONFIRMADO y que no exista otra factura para ese pedido.
- Detalle de factura con sus pagos y saldo; consulta de saldo (`/saldo`) que usa la vista `factura_saldo`.
- **Anulación** de factura: requiere `motivo`; se permite solo si está ACTIVA; si tiene pagos queda con estado ANULADA y los pagos se conservan (el saldo se calcula con la vista). Reanular → 409.

### 3.7 Pagos
- Registrar pagos sobre facturas ACTIVAS (`origen` interno `CAJA` o portal `PORTAL`).
- **Regla de oro:** el valor acumulado de pagos no puede superar el saldo pendiente de la factura (sobrepago → 400). El saldo considera las notas de crédito activas.
- El estado resultante se calcula automáticamente: `PENDIENTE` (sin pagos), `PAGO_PARCIAL`, `PAGADA`.
- **Datos en línea según método** — ver sección 6.
- Listado de pagos (interno y del portal) muestra el detalle no sensible del medio (p. ej. `VISA ····1111`, banco, cuenta).

### 3.8 Notas de crédito (devoluciones)
- Crear nota de crédito sobre una factura con `{ facturaId, valor, motivo }`. **El valor de las notas activas de una factura no puede superar el total recaudado** (pagos − notas activas previas); sobrepasar → 400. Solo si el motivo es obligatorio y el valor > 0.
- Anular nota (requiere motivo, una sola vez; reanular → 409).
- Las notas activas **aumentan el saldo** de la factura (reversan pagos) en la vista `factura_saldo`.

### 3.9 Reportes y auditoría
- **Resumen:** conteo/estado de facturas, saldo por cobrar, etc.
- **Facturación:** serie por período (por días/meses) y por cliente.
- **Balance por cliente:** resumen agregado + lista de clientes con valores.
- **Historial de un cliente:** transacciones (facturas, pagos, notas) con saldo móvil.
- **Auditoría:** cada operación importante (usuario interno **o** cliente) se registra: usuario, tipo, módulo, operación, descripción, fecha. Consultable por ADMIN/SUPERVISOR.

### 3.10 Portal del cliente (autoservicio)
- **Mi saldo:** saldo total a favor/deuda del cliente.
- **Mis facturas / Mis compras:** listados propios con detalle.
- **Mis pagos / Mis notas de crédito / Mi historial:** listados propios.
- **Pago/abono de factura propia** con modal: valor + método + datos en línea (sección 6). No puede pagar facturas de otro cliente (aislamiento).
- **Mis datos:** consulta de la propia información.

---

## 4. Reglas de negocio críticas (invariantes)

1. **Sin sobrepago:** `sum(pagos) − sum(notas_credito ACTIVAS) ≤ total` de la factura. El servidor rechaza valores que la excedan (400).
2. **Totales siempre en el servidor:** el precio del ítem en el momento del pedido y los impuestos los calcula el backend; el frontend no envía montos de línea.
3. **1 pedido → 0..1 factura:** no se puede facturar dos veces el mismo pedido, ni facturar un pedido no confirmado.
4. **Anulación con motivo:** anular factura o nota de crédito exige motivo; solo una vez.
5. **Aislamiento del cliente:** todas las rutas `mis-*` filtran por el `clienteId` del token; facturas/pagos/notas ajenas → 404 (no revelan existencia).
6. **El saldo es calculado**, nunca almacenado: la vista `factura_saldo` deriva `estado_pago` y `saldo` de totales, pagos y notas activas.
7. **Los datos de tarjeta son efímeros** (sección 6): CVV y número completo jamás se persisten ni se exponen.
8. **El OTP es de un solo uso** (sección 5): 6 dígitos, vigencia 10 min, 5 intentos, caduca/al agotarse se descarta.

---

## 5. Recuperación de contraseña con OTP (requisito funcional)

### 5.1 Flujo
1. En el login, el cliente elige **«¿Olvidaste tu contraseña?»**.
2. Escribe su **usuario** y elige **canal: EMAIL o SMS** (el código se envía al correo o teléfono registrados).
3. El sistema genera un **código de 6 dígitos**, lo guarda cifrado y lo entrega.
4. El cliente escribe **código + nueva contraseña (mín. 6, confirmada)**. Si es válido, la contraseña se actualiza y puede entrar con la nueva.

### 5.2 Reglas de la funcionalidad (criterios de aceptación)
- **R1 Solicitud** → `POST /auth/recuperar-solicitar` con `{ username, canal }`. Sin `username` → 400; `canal` diferente de EMAIL/SMS → 400.
- **R2 Anti-enumeración:** la respuesta es **genérica** (misma 200 con texto neutro) exista o no la cuenta. Solo la entrega real del código distingue internamente.
- **R3 Una solicitud vigente por cuenta:** al pedir un código nuevo, los anteriores quedan invalidados (`usado = true`).
- **R4 Código:** 6 dígitos, cifrado con bcrypt en `recuperaciones_clave.codigo_hash` (nunca texto plano). Vigencia `OTP_VALIDEZ_MINUTOS` (10). Máx. `OTP_MAX_INTENTOS` (5) intentos fallidos; al agotarse, la solicitud se anula y hay que pedir otra.
- **R5 Validación y cambio** → `POST /auth/recuperar-cambiar` con `{ username, codigo, nuevaClave }`. Código no numérico de 6 dígitos → 400; clave < 6 → 400; cuenta inexistente/inactiva → 404; sin solicitud vigente → 400 «No hay una solicitud vigente…»; expirado → 400; código incorrecto → 401 (cuenta intento); código correcto → cambia `password_hash` (bcrypt), marca la solicitud usada y audita `CLAVE_RECUPERADA`.
- **R6 Un solo uso:** un código exitoso no puede reutilizarse (la solicitud queda `usado = true`).
- **R7 Modo demo:** este entorno no tiene proveedor real de SMS/correo, por lo que en `OTP_RETORNO_DEMO=on` la API devuelve `demo_otp` (+ `destino` enmascarado y `canal`) en la respuesta de solicitud para poder probar el flujo de punta a punta. En producción: `off` + conecte un proveedor en `backend/src/middleware/notificar.js` (Twilio/MessageBird/nodemailer/Resend) y el código **solo** sale por ese canal.
- **R8 Anti-spam:** solicitar/cambiar comparten un limitador propio (`RECUPERAR_RATE_LIMIT`, 40 solicitudes/15 min por IP).

### 5.3 UI (pantalla de login)
- Pestañas/modos: **Iniciar sesión · Crear cuenta · Recuperar contraseña**.
- Paso 1: usuario + selector EMAIL/SMS + botón «Enviar código de seguridad».
- Paso 2: código (6 dígitos), nueva contraseña y confirmación; mensaje de confirmación y botón «Volver a iniciar sesión».
- En modo demo se muestra un aviso con el código recibido. La información del envío (destino enmascarado) se muestra en ambos pasos.

---

## 6. Datos de pago en línea (requisito funcional)

Cuando el método de pago es **TARJETA, TRANSFERENCIA o CHEQUE**, el cliente (e igualmente el personal en caja) debe completar campos obligatorios. Si faltan o son inválidos → **400** con mensaje claro. Se aplica por igual en caja (`POST /api/pagos`) y en el portal (`POST /api/mis-pagos`).

### 6.1 Campos por método

| Método | Campos obligatorios | Validaciones |
|---|---|---|
| **TARJETA** | `numeroTarjeta`, `codigoSeguridad`, `vencimientoTarjeta`, `banco`, `titularTarjeta` | Número de **13–19 dígitos** y que pase **Luhn**; CVV de **3–4 dígitos**; vencimiento **MM/AA** no vencido (válido hasta el último día del mes); banco no vacío; titular ≥ 3 caracteres. |
| **TRANSFERENCIA** | `banco`, `numeroCuenta`, `referencia` (n.º de comprobante) | Banco no vacío; cuenta de **4–20 dígitos**; referencia **≥ 4 caracteres**. |
| **CHEQUE** | `banco`, `referencia` (n.º de cheque) | Banco no vacío; referencia ≥ 4 caracteres. |
| **EFECTIVO** | — | Sin datos adicionales. |

### 6.2 Seguridad de tarjeta (criterios de aceptación)
- **Nunca se almacenan** el número completo ni el CVV (buena práctica **PCI-DSS**).
- En BD solo persisten: `banco`, `titular`, `tipo_tarjeta` (VISA/MASTERCARD/AMEX/OTRA derivado del prefijo), `ultimos_digitos_tarjeta` (4), `vencimiento_tarjeta` (MM/AA) y para transferencia `numero_cuenta`.
- Las respuestas de la API **no exponen** `codigoSeguridad` ni el número completo (probado en e2e: el JSON de `mis-pagos` no contiene esos valores).
- La UI muestra solo el resumen no sensible: `VISA ····1111 · vence 12/30 · Banco X`, `Banco Y · cuenta ···7890`.
- La UI avisa que el CVV y el número se validan pero no se guardan.

### 6.3 UI de pago
- Modal/formulario con: valor (nunca mayor al saldo), selector de método y **campos dinámicos**:
  - TARJETA: número, CVV, vencimiento, banco, titular (+ aviso de seguridad y botón «pagar saldo completo»).
  - TRANSFERENCIA: banco, número de cuenta, referencia (comprobante).
  - CHEQUE: banco, referencia (n.º de cheque).
  - EFECTIVO: sin campos extra.
- Al cambiar de método se limpian los datos sensibles del formulario.

---

## 7. Estado inicial esperado (demo/seed)

Al levantar el proyecto por primera vez (BD vacía + seed idempotente) debe existir:

- **Roles:** ADMIN, FACTURADOR, CAJERO, SUPERVISOR.
- **Usuarios internos:** `admin@finanx.test/admin123`, `facturador@finanx.test/facturador123`, `cajero@finanx.test/cajero123`, `supervisor@finanx.test/supervisor123`.
- **Clientes demo:** María Fernanda López (CC 1002003001, Bogotá) y TecnoAndina S.A.S. (NIT 901234567, Medellín). El cliente 1 con cuenta de portal **`cliente@finanx.test` / `cliente123`**.
- **Productos:** PROD-001…005 (Laptop 15" $4.500.000 IVA 19 %, Mouse $120.000 IVA 19 %, Teclado $280.000 IVA 19 %, Monitor 27" $2.100.000 IVA 19 %, Servicio de soporte $150.000 IVA 0 %).
- Sin facturas ni pagos (los crea la operación).

---

## 8. Criterios de aceptación finales (qué debe comprobarse)

Verificación automatizada: **99 casos e2e aprobados** (`backend/scripts/e2e.mjs`). Cubre al menos:

1. Login válido/inválido/sin token; 401 correctos; login correcto tras bloqueo.
2. RBAC: 403 para roles sin permiso (p. ej. cliente tocando rutas internas).
3. Cliente duplicado (misma identificación) → 400; producto con código duplicado → 400; precio negativo → 400.
4. Totales de pedido calculados en el servidor (un ítem de producto con IVA produce subtotal/impuestos/total correctos).
5. Factura solo desde pedido CONFIRMADO; no refacturar el mismo pedido.
6. Pagos: parcial → PAGO_PARCIAL; completo → PAGADA; sobrepago → 400.
7. Anulación de factura con motivo; reanular → 409; anular sin motivo → 400.
8. Aislamiento: no pagar factura ajena (404); portal requiere token de cliente.
9. Notas de crédito: crear, listar, saldo sube tras la nota, anular una vez.
10. Balance por cliente y resumen para correo.
11. Seguridad: cabeceras HTTP/helmet presentes, CORS bloquea orígenes desconocidos, fuerza bruta → 429.
12. **Recuperación OTP:** solicitud devuelve `demo_otp`; anti-enumeración; bloqueo a los 5 intentos; código correcto ya no vale al agotarse; cambio de contraseña funciona (login nuevo 200, anterior 401); código no reutilizable.
13. **Datos de pago:** tarjeta sin datos/CVV inválido/no-Luhn/vencida → 400; tarjeta y transferencia válidas → 201; cheque sin banco → 400; interna y portal comparten validación; solo se guardan últimos 4 dígitos; no se exponen CVV/PAN en respuestas.

---

## 9. Fuera de alcance / evolución futura

- Pasarela de pago real (PSE/Stripe/MercadoPago) conectada a `mis-pagos` (los datos ya se capturan y validan).
- Entrega real de OTP por SMS/correo (hoy demo por consola/respuesta).
- Aprobación administrativa del autoregistro (hoy los clientes nacen ACTIVOS).
- Repositorio Git versionado (aún no inicializado).
- Envío automático de correo (hoy el resumen es enlace `mailto:`).
- Paginación de listados grandes y tests unitarios del backend.

---

## 10. Proceso de desarrollo (metodología ágil y arquitectura hexagonal)

**Metodología ágil.** FINAN-X se construyó con entregas semanales (Scrum simplificado): **6 sprints de una semana entre el 21 de agosto y el 28 de septiembre de 2026**, cada uno cerrado con una versión ejecutable y verificada, lista para demo (entregas los viernes 28 ago · 4 · 11 · 18 · 25 sep y cierre final el lunes 28 sep). La "definición de terminado" de cada sprint es la suite e2e en verde.

| Semana (2026) | Entrega | Entregable cuando cierra la semana |
|---|---|---|
| 21–27 ago | vie 28 ago | Requisitos cerrados + infraestructura Docker sana (`/api/health`) |
| 28 ago–3 sep | vie 4 sep | Modelo de datos + API REST del núcleo |
| 4–10 sep | vie 11 sep | Panel interno navegable (React) |
| 11–17 sep | vie 18 sep | Portal del cliente + seguridad endurecida (429, cabeceras, auditoría) + suite e2e base 74/74 |
| 18–24 sep | vie 25 sep | Notas de crédito + recuperación de contraseña con OTP (sección 5) |
| 25–28 sep | **lun 28 sep (cierre)** | Datos de pago en línea con validación compartida (sección 6) + verificación final 99/99 + documentación y mockups de demostración |

La trazabilidad de fases está en `PLAN_Creacion.md`.

**Arquitectura hexagonal.** El sistema separa el **núcleo de reglas de negocio** de la tecnología mediante puertos y adaptadores:

- **Núcleo (dominio):** invariantes y validaciones puras — sin sobrepago, 1 pedido → 1 factura, saldo calculado, reglas del pago (`validarDatosPago`, Luhn, CVV, vencimiento) y reglas del OTP (6 dígitos, 10 min, 5 intentos, un solo uso). Vive en `utils.js` y en las invariantes de las rutas.
- **Puerto de entrada:** los casos de uso se exponen como API REST (adaptadores Express: `routes/auth.js` público, `routes/*.js` interno, `routes/mis.js` portal aislado), con guardas `requireAuth`/`requireRol`/`requireCliente`.
- **Puerto de salida · persistencia:** adaptador `db.js` (pool pg + SQL parametrizado) y la vista `factura_saldo` como proyección de lectura (saldo derivado).
- **Puerto de salida · notificaciones:** adaptador `notificar.js` (`enviarCodigo`) — implementación demo por consola, extensible a Twilio/nodemailer sin tocar el núcleo.
- **Puerto de salida · seguridad:** adaptadores bcryptjs (hash de claves y OTP) y jsonwebtoken (JWT de 8 h).

Detalle técnico completo (mapa pieza → archivo) en `SPEC_Tecnico.md` §1.1.