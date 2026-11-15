# FINAN-X · Plan de Creación (paso a paso)

> **Propósito de este documento:** registrar el **orden exacto** en que se construyó FINAN-X, de modo que — junto con `SPEC_Funcional.md` y `SPEC_Tecnico.md` — cualquier agente (Claude Code u OpenCode) pueda **reproducir el proyecto** fase por fase y con criterios de verificación en cada paso.
>
> **Proyecto:** FINAN-X · **Desarrolladores:** Luis Alfredo Jaramillo Restrepo · Mayra Juliana Velez
> **Nota:** cada fase termina con un ✅ *Verificación* — no avance a la siguiente si no se cumple.
> **Metodología:** este plan se ejecutó con **metodología ágil (entregas semanales)** — las fases se agruparon en **6 sprints de una semana (21 ago – 28 sep 2026)**, cinco cerrados en viernes y el último como cierre final el lunes 28 de septiembre; cada sprint cierra con una versión ejecutable y verificada lista para demo ante el interesado (ver la tabla de abajo).

> **Uso de IA.** Este documento y el proyecto se construyeron con asistencia de agentes de IA
> (Claude Code y OpenCode) **bajo supervisión constante de los autores**: cada fase fue
> dirigida, revisada, probada y aprobada manualmente antes de continuar. Las decisiones de
> diseño, la validación funcional y la verificación de seguridad son responsabilidad de los
> autores.

---

## Metodología: entregas semanales (sprints)

| Sprint | Semana (2026) | Entrega | Fases | Entregable que se demuestra al cierre |
|---|---|---|---|---|
| 1 | 21–27 ago | vie 28 ago | 0, 1 | Alcance + stack + infraestructura Docker encendida y sana |
| 2 | 28 ago–3 sep | vie 4 sep | 2, 3 | Modelo de datos + API REST del núcleo (probada con curl) |
| 3 | 4–10 sep | vie 11 sep | 4 | Panel interno navegable (React) |
| 4 | 11–17 sep | vie 18 sep | 5, 6, 7 | Portal del cliente aislado + seguridad endurecida + suite e2e base 74/74 |
| 5 | 18–24 sep | vie 25 sep | 8, 9 | Notas de crédito y saldo derivado + recuperación de contraseña con OTP |
| 6 | 25–28 sep | **lun 28 sep (cierre)** | 10, 11, 12 | Datos de pago en línea (PCI) + verificación final 99/99 + documentación y mockups |

Ver el cronograma visual en `diagrams/FINAN_X_Diagrama_Gantt.svg` (`14_diagrama_gantt.puml`).

Rituales por sprint: planificación semanal, desarrollo, ejecución de la suite e2e y demo/revisión. La suite en verde es la *definición de terminado*: un sprint no se cierra con pruebas fallidas.

---

## Fase 0 · Análisis y requisitos

**Objetivo:** definir qué se construye y con qué restricciones.

1. Definir el dominio: empresa con clientes, productos, pedidos, facturas, pagos, notas de crédito y seguimiento financiero.
2. Definir los dos públicos: **personal interno** (ADMIN, FACTURADOR, CAJERO, SUPERVISOR) y **cliente externo** (portal de autoservicio).
3. Fijar invariantes de negocio: sin sobrepago, totales en el servidor, 1 pedido → 0..1 factura, saldo calculado (nunca almacenado), aislamiento por cliente, auditoría de todo.
4. Fijar stack: React + Vite, Node + Express, PostgreSQL, Docker Compose.
5. Adoptar **arquitectura hexagonal** (puertos y adaptadores): núcleo de reglas de negocio aislado + puerto de entrada HTTP (REST) y puertos de salida (persistencia, notificaciones, seguridad) — ver `SPEC_Tecnico.md` §1.1.
6. Adoptar **metodología ágil con entregas semanales**: 6 sprints (21 ago – 28 sep 2026), cada uno con demo y verificación (tabla al inicio de este documento).
7. Definir entregables: documentación en `documentacion/` (HTML + PDF + índices), suite e2e, specs y **mockups de demostración para el cliente**.
8. Definir el **backlog de historias de usuario** (formato «Como…, quiero…, para…» con criterios de aceptación) y su trazabilidad a las fases — ver `SPEC_Funcional.md` §2.3 (22 historias, épicas HU-01…HU-22).

✅ *Verificación:* lista de módulos closed: clientes, productos, pedidos, facturación, pagos, notas de crédito, reportes, auditoría, portal del cliente, autenticación (+oy: recuperación OTP y datos de pago en línea).

---

## Fase 1 · Infraestructura reproducible (Docker)

**Objetivo:** un `docker compose up` encendiendo BD, API y frontend.

1. `docker-compose.yml` con tres servicios y healthchecks encadenados:
   - **db** `postgres:16-alpine`, volumen nombrado `finanx_pgdata`, monta `database/init.sql` en `/docker-entrypoint-initdb.d/`; env `POSTGRES_USER/PASSWORD/DB=finanx`.
   - **backend** build `./backend`, puerto 4000, heritage `JWT_SECRET`, `CORS_ORIGINS`, límites; `depends_on: db (healthy)`; healthcheck `GET /api/health`.
   - **frontend** build `./frontend`, puerto 8080→80; `depends_on: backend (healthy)`.
2. Dockerfiles: backend `node:22-alpine` (`CMD sh -c "node src/seed.js && node src/index.js"`); frontend multi-etapa `node:22-alpine` build Vite → `nginx:1.27-alpine`.
3. `frontend/nginx.conf`: proxy `/api` → `http://backend:4000` + SPA `try_files`.

✅ *Verificación:* `docker compose up -d --build` → 3 contenedores `healthy`; `curl localhost:4000/api/health` responde `{"ok":true,...}`.

---

## Fase 2 · Modelo de datos

**Objetivo:** esquema PostgreSQL completo y semillas.

1. Escribir `database/init.sql` — tablas: `roles`, `usuarios`, `clientes`, `usuario_cliente`, `productos`, `pedidos`, `detalle_pedido`, `facturas`, `pagos`, `notas_credito`, `auditoria` + índices.
2. Crear la **vista `factura_saldo`** con `estado_pago` calculado (`PENDIENTE/PAGO_PARCIAL/PAGADA/ANULADA`) que suma pagos y resta notas de crédito activas.
3. Escribir `backend/src/seed.js` (idempotente, `ON CONFLICT DO NOTHING`): roles, 4 usuarios internos, 2 clientes demo + cuenta de portal, 5 productos.
4. Conectar pool en `db.js` desde env.

✅ *Verificación:* contenedor db en 1ª arrancada aplica init.sql y seed; `psql` muestra las 11 tablas + vista; login con seed funciona al terminar la Fase 3.

---

## Fase 3 · Backend núcleo (API REST)

**Objetivo:** todas las rutas con contrato y reglas de las secciones 4–5 de `SPEC_Tecnico.md`.

1. **Base:** `index.js` (helmet, CORS lista blanca, `express.json`, rutas, 404, manejador de `HttpError`), `config.js`, `utils.js` (`HttpError`, `round2`).
2. **Auth:** `routes/auth.js` — `login` (interno por correo o cliente por username; bcrypt; `registrarFalloLogin`/`limpiarFallosLogin`), `registro` con `registroLimiter`.
3. **Middleware:** `requireAuth` (JWT), `requireRol`, `requireCliente`, `audit()`.
4. **Módulos** (cada uno con `router.use(requireAuth, requireRol(...))` y consultas parametrizadas):
   - `usuarios.js` (ADMIN), `clientes.js` (+ cuenta portal, + resumen-correo), `productos.js`, `pedidos.js` (totales en servidor), `facturas.js` (generar desde pedido CONFIRMADO, detalle, pagos, saldo, anular), `pagos.js` (validación de saldo), `notas-credito.js` (valor ≤ recaudado, anular), `reportes.js` (resumen/facturacion/balance-clientes/historial), `auditoria.js`.
5. **Portal:** `mis.js` con todas las rutas `mis-*` bajo `requireCliente` y filtros estrictos por `clienteId`.

✅ *Verificación:* con curl: login admin 200 → `POST /pedidos` → `PATCH estado CONFIRMADO` → `POST /facturas` (201) → `POST /pagos` (201, sin sobrepasar saldo) → `GET /facturas/:id/saldo` con estado correcto.

---

## Fase 4 · Frontend panel interno

**Objetivo:** SPA React para el personal de la empresa.

1. Bootstrap Vite + React 18 + Router 6 + Axios; `api.js` (baseURL `/api`, token en interceptor, logout automático en 401); `auth.jsx` (contexto con `localStorage`).
2. `App.jsx`: guardas `RequireAuth`, `RequireInternal`, `RequireCliente`, `RequireRol`; rutas del panel (dashboard, clientes, productos, pedidos, listas/detalles/formulario, facturas, pagos, notas de crédito, balance, reportes, auditoría; `/usuarios` solo ADMIN).
3. Páginas y componentes compartidos (`ui.jsx`: `Money`, `Estado`, `Badge`, `FechaHora`, `Empty`, `Loading`; `Layout.jsx`, `FacturaPreview.jsx`).
4. `styles.css` con el sistema visual (cards, tablas, badges, alerts, modal, login).

✅ *Verificación:* `http://localhost:8080` → login admin → navegar facturas/pedidos/clientes sin errores de consola.

---

## Fase 5 · Portal del cliente

**Objetivo:** autoservicio aislado por cliente.

1. `Login.jsx` con modos `login / registro` y credenciales demo.
2. Rutas `/portal/*` (`MiSaldo`, `MisDatos`, `MisCompras`, `MisFacturas`, `MisPagos`, `MisNotasCredito`, `MiHistorial`) con `ClientPage`.
3. `PagarModal.jsx`: valor (≤ saldo) + método + referencia/observaciones; llama `POST /api/mis-pagos`.

✅ *Verificación:* con la cuenta `cliente` del acta de primer ingreso (clave temporal ya cambiada) se ve solo el saldo del cliente 1; no se lista ni paga factura de otro cliente.

---

## Fase 6 · Seguridad y endurecimiento

1. Helmet + CORS lista blanca (ya en Fase 3) + `trust proxy` correcto.
2. Anti fuerza bruta: `middleware/rateLimit.js` (fallos → 429, reset al acertar, poda del Map).
3. Anti-spam público: `registroLimiter` (20/h).
4. Reglas de anulación/facturación con códigos 400/409 explícitos.
5. Auditoría en cada operación relevante.

✅ *Verificación:* 6 logins fallidos seguidos → 429; login correcto resetea; cabeceras de seguridad presentes.

---

## Fase 7 · Suite e2e base (74 casos)

1. `backend/scripts/e2e.mjs` con helper `call(method, path, {token, body})` y `check(nombre, cond, extra)`.
2. Secciones: auth, RBAC, clientes/productos, pedidos/totales, facturación, pagos, anulaciones, aislamiento, portal, notas de crédito, balance/resumen, seguridad.
3. `npm test` como script del backend.

✅ *Verificación:* `=== Resultado: 74 aprobadas, 0 fallidas ===` y re-ejecución (determinismo).

---

## Fase 8 · Notas de crédito + vista de saldo v2

1. Migración `migracion_notas_credito.sql` (tabla + vista v2) y aplicar en vivo.
2. Rutas `notas-credito.js` (crear con límite de devolución, anular) + `reportes/historial` con notas.
3. `mis-notas-credito` en el portal.
4. Espejar DDL en `init.sql` para BD nuevas.

✅ *Verificación:* nota sobrepasa el recaudado → 400; anular una vez; saldo sube tras nota activa; Appende documentación.

---

## Fase 9 · Función nueva A: recuperación de contraseña con OTP

1. **BD:** migración `migracion_recuperacion_contrasena.sql` → tabla `recuperaciones_clave` (`canal` EMAIL/SMS, `codigo_hash` bcrypt, `intentos`, `usado`, `expira_en`) + índice; aplicar en vivo y espejar en `init.sql`.
2. **Entrega:** `middleware/notificar.js` con `enviarCodigo({canal, destino, codigo})` (demo: consola; hook para Twilio/nodemailer).
3. **Config:** `otpDemo` (`OTP_RETORNO_DEMO`), `otpValidezMinutos` (10), `otpMaxIntentos` (5), `recuperarRateMax` (40/15 min) + passthrough en compose.
4. **Rutas** en `auth.js` con `recuperarLimiter` propio (separado del registro):
   - `POST /recuperar-solicitar`: valida username/canal, busca cliente, invalida solicitudes anteriores, inserta código cifrado con expiración, llama `enviarCodigo`, audita `RECUPERAR_SOLICITAR`; respuesta **genérica** (anti-enumeración) y, en modo demo, `demo_otp` (y `destino` enmascarado).
   - `POST /recuperar-cambiar`: valida formato, vigencia e intentos (último intento anula la solicitud), compara bcrypt, actualiza `password_hash`, marca usada, audita `CLAVE_RECUPERADA`.
5. **Frontend:** `Login.jsx` modo `recuperar` en 2 pasos (solicitar → código + nueva clave), aviso del código demo, clase `.alert-info`.
6. **e2e:** sección 12 (parte OTP): solicitud con `demo_otp`, anti-enumeración, 5 intentos fallidos → bloqueo, código correcto ya no vale, nuevo código, cambio de clave (login nuevo 200 / viejo 401), no reuso.

✅ *Verificación:* 99/99 (74 + 25 de la sección 12); curl devuelve `demo_otp`; `recuperaciones_clave` nunca muestra texto plano.

---

## Fase 10 · Función nueva B: datos de pago en línea (tarjeta/transferencia/cheque)

1. **BD:** en la misma migración, `ALTER TABLE pagos ADD COLUMN IF NOT EXISTS` → `banco, titular, tipo_tarjeta, ultimos_digitos_tarjeta, vencimiento_tarjeta, numero_cuenta` (idempotente; espejada en `init.sql`).
2. **Validación compartida** en `utils.js`:
   - `validarLuhn(numero)` (13–19 dígitos; duplica alternado; suma % 10).
   - `derivarTipoTarjeta(numero)` (VISA/MASTERCARD/AMEX/OTRA por prefijo).
   - `validarDatosPago(metodoPago, body)` → devuelve solo campos seguros; lanza `HttpError(400)` si faltan/inválidos.
3. **Backend:** aplicar `validarDatosPago` en `POST /api/pagos` y `POST /api/mis-pagos` (mismo contrato); ampliar INSERT y SELECT con las columnas nuevas. **Nunca** persistir CVV ni PAN.
4. **Frontend:**
   - `PagarModal.jsx` (portal) y `FacturaDetalle.jsx` (caja): campos dinámicos por método; limpiar datos al cambiar de método; aviso PCI.
   - `ui.jsx` → componente `DatosPago` (p. ej. `VISA ····1111 · vence 12/30`); `Pagos.jsx` y `MisPagos.jsx` lo muestran.
5. **e2e:** actualizar `pagoCli` (TARJETA ahora exige datos) y el pago completo por transferencia; sección 12 (parte pagos): campos faltantes → 400, CVV inválido → 400, no-Luhn → 400, vencida → 400, válidas → 201, cheque sin banco → 400, validación interna compartida, solo últimos 4 dígitos en BD y ausencia de CVV/PAN en respuestas.

✅ *Verificación:* 99/99 (2 corridas consecutivas, determinismo); tarjeta de prueba `4111111111111111` / `12/30` / `123`.

---

## Fase 11 · Verificación final del stack

1. `docker compose up -d --build` (cambios backend/frontend) y healthchecks.
2. `cd backend && npm test` → **99/99, 0 fallidas** (×2 corridas).
3. Curl de humo: login admin, `recuperar-solicitar` con `demo_otp`, `POST /mis-pagos` con tarjeta válida.
4. Confirmar en BD que `recuperaciones_clave.codigo_hash` es bcrypt y `pagos` solo tiene `ultimos_digitos_tarjeta`.
5. (Si se renombra la carpeta raíz) `docker compose down` → `mv` → `docker compose up -d --build` → repetir pasos 2–4; BD nueva = seed; volumen antiguo puede eliminarse.

✅ *Verificación:* mismo resultado 99/99 en la ruta definitiva.

---

## Fase 12 · Documentación y entregables

1. Actualizar: `README.md`, `documentacion/LEEME.md` (índice + instrucciones PDF).
2. Regenerar `A_Explicacion_Proyecto.html`, `B_Guia_Tecnica_Desarrolladores.html`, `FINAN-X_Documentacion.html` (portada con los desarrolladores; secciones nuevas de OTP y pagos en línea; conteo **99**).
3. Generar PDFs con Chrome headless (ver `LEEME.md`):
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless --disable-gpu --no-sandbox \
     --print-to-pdf="documentacion/A_Explicacion_Proyecto.pdf" --no-pdf-header-footer \
     "file://$PWD/documentacion/A_Explicacion_Proyecto.html"
   # repetir para B_Guia_Tecnica_Desarrolladores y FINAN-X_Documentacion
   ```
4. Redactar y guardar en `documentacion/`: `SPEC_Funcional.md`, `SPEC_Tecnico.md` y este `PLAN_Creacion.md` (con metodología ágil e arquitectura hexagonal agregadas).
5. Crear los **mockups de demostración para el cliente** en `mockups/` (prototipos HTML estáticos, wireframes "tipo demo", distintos de la aplicación final): galería en `mockups/index.html` + 14 pantallas: login, recuperación OTP, dashboard, clientes, productos, pedidos, facturas, caja/pagos, notas de crédito, reportes, portal del cliente, pago en línea (con flujo efectivo → código Efecty), registro de usuario nuevo, portal de usuarios internos.
6. Diagramas PlantUML: `bash documentacion/diagrams/render.sh` (regenera SVGs, incluidos `13_arquitectura_hexagonal.puml` y `14_diagrama_gantt.puml` → `FINAN_X_Diagrama_Gantt.svg`).
7. Entregar la **versión PDF de la galería de mockups**: una página por pantalla (`mockups/pdf/*.pdf` vía Chrome headless) combinadas en `mockups/FINAN-X_Mockups_Demo.pdf` (portada = `index.html` + pantallas 01→14).

✅ *Verificación:* los nombres de los desarrolladores aparecen en la portada de los 3 PDFs (extraer texto con `pypdf`); todos los enlaces del índice resuelven.

---

## Resumen de fases vs. verificaciones

| Fase | Entrega | Verificación |
|---|---|---|
| 0 | Requisitos | alcance cerrado |
| 1 | Docker Compose | 3 contenedores healthy + `/api/health` |
| 2 | Esquema + seed | 11 tablas + vista + datos demo |
| 3 | API núcleo | curl: pedido→factura→pago→saldo |
| 4 | Frontend panel | navegación admin OK |
| 5 | Portal cliente | aislamiento por cliente |
| 6 | Seguridad | 429, cabeceras, auditoría |
| 7 | e2e base | 74/74 determinista |
| 8 | Notas de crédito | límite de devolución + anulación |
| 9 | OTP recuperación | +25 casos (99 en total) |
| 10 | Pagos en línea | PCI + validación compartida |
| 11 | Verificación final | 99/99 ×2 |
| 12 | Documentación | PDFs + specs + portada |