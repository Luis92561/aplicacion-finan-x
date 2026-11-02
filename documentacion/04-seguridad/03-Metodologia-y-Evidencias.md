# Metodología y evidencias — Auditoría de seguridad FINAN-X

Documento de soporte del informe `01-Informe-Auditoria-Seguridad-FINAN-X.md`.

**Fecha de ejecución:** 2 de noviembre de 2026
**Commit auditado:** `ce398d5` (rama `main`, 12 de octubre de 2026)
**Modo:** revisión estática, solo lectura. No se modificó ningún archivo de la aplicación.
**Entorno:** Windows 11 · PowerShell 7 · Node.js 24 · Python 3 · `npm audit` contra el registro público.

---

## 1. Preparación y control de integridad

Antes de empezar se registró el estado del repositorio para poder demostrar que la auditoría no alteró nada:

```
git rev-parse --short HEAD        → ce398d5
git rev-parse --abbrev-ref HEAD   → main
git log -1 --format=%ci           → 2026-10-12 13:37:06 -0500
git status --porcelain            → ?? documentacion/_trabajos/   (preexistente, sin seguimiento)
```

Esa única entrada sin seguimiento (`documentacion/_trabajos/`) ya existía antes de la revisión y no forma parte de la auditoría. Los archivos de la aplicación (`backend/`, `frontend/`, `database/`, `docker-compose.yml`) no se tocaron.

**Huellas SHA-256 de los archivos clave** (primeros 16 hex) para verificar que el informe corresponde a las versiones revisadas:

| Archivo | SHA-256 |
|---|---|
| `backend/src/index.js` | `124bb0d9fa593ee2` |
| `backend/src/config.js` | `e970af4cf9561115` |
| `backend/src/middleware/auth.js` | `33993c5c76445e69` |
| `backend/src/middleware/rateLimit.js` | `05af136112515856` |
| `backend/src/routes/auth.js` | `6961c4582a449968` |
| `backend/src/routes/mis.js` | `bf446051d3211353` |
| `backend/src/routes/notas-credito.js` | `e3a5019d630b33db` |
| `backend/src/routes/pagos.js` | `d2e0e8c9f57266d4` |
| `backend/src/routes/clientes.js` | `166bdff20c878c4b` |
| `backend/src/utils.js` | `1f6b33e776e6b298` |
| `backend/Dockerfile` | `98788000d87bd66c` |
| `frontend/nginx.conf` | `e9804e9da283dd86` |
| `frontend/src/auth.jsx` | `78d4daf89f6e1178` |
| `frontend/src/api.js` | `e1611c3d798b5e52` |
| `docker-compose.yml` | `c64ed4412ec61e14` |
| `database/init.sql` | `42289fc4a3fe4b1b` |

---

## 2. Inventario de la superficie revisada

```
backend/
  src/index.js            → arranque, middleware global, CORS, helmet, manejo de errores
  src/config.js           → validación de JWT_SECRET, OTP, límites
  src/db.js               → pool de PostgreSQL
  src/utils.js            → validación de contraseña, Luhn, datos de pago
  src/middleware/         → auth, rateLimit, audit, notificar
  src/routes/             → 11 routers, 52 rutas
  src/seed.js             → datos y usuarios demo
  Dockerfile              → arranque del contenedor
frontend/
  src/api.js, auth.jsx    → cliente HTTP y sesión
  src/App.jsx, pages/     → 25 vistas (panel interno + portal)
  nginx.conf, Dockerfile  → publicación del SPA y proxy /api
database/
  init.sql                → esquema, CHECK, vista factura_saldo, índices
  migracion_*.sql         → evolución del esquema
docker-compose.yml        → 3 servicios, puertos, credenciales
```

**Recuento de rutas:** 52 en total — 4 públicas de autenticación + 1 de salud, 11 del portal (`/api/mis-*`, `/api/mi-*`), 37 internas.

**Middleware de autorización:** `requireAuth` (JWT + `token_version`), `requireRol` (roles internos), `requireCliente` (aislamiento por cliente).

---

## 3. Comandos ejecutados (solo lectura)

```powershell
# 1. Inventario de archivos
Get-ChildItem -Force
Get-ChildItem -Recurse -File -Path backend,frontend,database |
  Where-Object { $_.FullName -notmatch 'node_modules|dist\\' }

# 2. Control de versiones: ¿hay secretos versionados?
git ls-files | Select-String '\.env'
git log --all --name-only --pretty=format: | Sort-Object -Unique | Select-String '(^|/)\.env'
#   Resultado: solo backend/.env.example (el .env real NO está versionado)

# 3. Dependencias
npm audit --omit=dev --json        # ejecutado en backend/ y en frontend/

# 4. Búsquedas dirigidas
grep -R "dangerouslySetInnerHTML|innerHTML|eval\(" frontend/src
grep -R "localStorage" frontend/src
grep -R "router\.(get|post|put|patch|delete)\(" backend/src/routes
grep -R '\$\{' backend/src          # interpolaciones en SQL: 117, todas estáticas

# 5. Huellas de integridad
Get-FileHash -Algorithm SHA256 <archivo>
```

No se ejecutó la aplicación, ni `docker compose up`, ni peticiones HTTP contra un servidor en marcha, ni herramientas de explotación (sqlmap, nikto, nuclei, etc.).

---

## 4. Resultado bruto de `npm audit` (2 nov 2026)

### Backend

| Paquete | Severidad | Aviso | CVSS |
|---|---|---|---|
| `body-parser` | Alta | GHSA-27r3-jxmh-p828 — DoS por bytes finales tras cuerpo comprimido | 7.5 |
| `qs` | Media | GHSA-6pq8-jhm2-2vcw — TypeError no capturado (DoS) | 5.3 |
| `express` | Alta | transitivo de `body-parser` y `qs` | — |
| `express-rate-limit` | Alta | transitivo de `express` | — |

Totales: **3 altas, 1 media, 0 críticas**.

### Frontend

| Paquete | Severidad | Aviso | CVSS |
|---|---|---|---|
| `follow-redirects` | Alta | GHSA-q3jh-wrc6-jgq8 — headers en forma de array omiten el filtrado de credenciales | 0.0* |
| `follow-redirects` | Alta | GHSA-8r9p-f939-6h3c — escape de regex en `sensitiveHeaders` | 0.0* |
| `follow-redirects` | Alta | GHSA-mrwp-f3q8-3g9p — arrays entre reinos descartados; credenciales siguen redirecciones | 5.9 |
| `axios` | Alta | transitivo de `follow-redirects` | — |
| `react-router` | Media | GHSA-wrjc-x8rr-h8h6 — open redirect vía `\` en `<Link>`/`useNavigate` | 0.0* |
| `react-router` | Media | GHSA-337j-9hxr-rhxg — inyección de constructor vía `deserializeErrors()` (SSR) | 6.1 |
| `react-router-dom` | Media | transitivo de `react-router` | — |

\* `0.0` indica que el aviso no trae CVSS calculado en la fuente; se mantiene la severidad publicada.

`npm audit` reportó `fixAvailable: false` en ambos lockfiles: la corrección requiere actualizar la dependencia raíz y regenerar el lockfile, no un simple `npm audit fix`.

---

## 5. Criterios de clasificación

| Severidad | Criterio aplicado |
|---|---|
| **Crítica** | Compromiso total del sistema o de los datos sin credenciales válidas, o pérdida masiva de confidencialidad/integridad. Explotable por un atacante externo con herramientas comunes. |
| **Alta** | Bypass de un control de seguridad, fraude con impacto económico directo, o robo de sesión. Requiere una condición alcanzable (cuenta propia, acceso interno, red observada). |
| **Media** | Exposición de datos sensibles acotada, debilidad de configuración, ausencia de control de defensa en profundidad, dependencia vulnerable explotable. |
| **Baja** | Endurecimiento, higiene, fuga menor de información, riesgo que depende de un fallo futuro. |

El **CVSS es estimado**: se asignó vector y puntuación a partir del impacto y la explotabilidad observados en el código, sin escáner. Se indica explícitamente en el informe y en el CSV.

---

## 6. Qué NO se hizo (límites de esta revisión)

- No se levantó la aplicación ni se enviaron peticiones a un servidor en ejecución.
- No se explotaron los hallazgos (las "reproducciones" del informe son **lógicas**, escritas a partir del código).
- No se hizo pentest de red, ni escaneo de puertos, ni pruebas de carga.
- No se auditaron la infraestructura del proveedor, el firewall, el DNS, los certificados ni el sistema operativo anfitrión.
- No se revisaron binarios, el runtime de Node ni las imágenes Docker capa por capa.
- No se analizó el PDF de documentación ni los mockups (no son código ejecutable).

Los hallazgos que dependen del comportamiento en ejecución (condiciones de carrera, tiempos de respuesta, bypass de limitadores) están marcados como tales y deben **validarse en un entorno de pruebas propio** antes de cerrarlos.

---

## 7. Cómo reproducir esta auditoría

1. Situarse en la raíz del proyecto y confirmar el commit: `git rev-parse --short HEAD` → `ce398d5`.
2. Leer los archivos del inventario (§2) y comparar sus hashes con los de §1.
3. Ejecutar `npm audit --omit=dev` en `backend/` y `frontend/`.
4. Verificar los hallazgos críticos con `cat`/lectura de:
   `backend/Dockerfile`, `backend/src/seed.js`, `docker-compose.yml`, `frontend/nginx.conf`.
5. Contrastar cada recomendación con el checklist del §8 del informe principal.

---

## 8. Trazabilidad hallazgo → evidencia

| Hallazgo | Archivo(s) | Línea(s) |
|---|---|---|
| C-01 | `backend/Dockerfile`; `backend/src/seed.js`; `frontend/src/pages/Login.jsx` | 14; 37-52,116-121; 143-147 |
| C-02 | `docker-compose.yml`; `backend/src/config.js` | 2-18; 73-79 |
| C-03 | `frontend/nginx.conf`; `docker-compose.yml`; `backend/src/index.js` | 1-14; 53-54,68-69; 21 |
| A-01 | `backend/src/middleware/rateLimit.js`; `backend/src/routes/auth.js` | 32-53; 61,89,105 |
| A-02 | `backend/src/index.js`; `docker-compose.yml`; `backend/src/middleware/rateLimit.js` | 21; 53-54; 16-18 |
| A-03 | `frontend/src/auth.jsx`; `frontend/src/api.js`; `frontend/nginx.conf` | 17-18; 6; 1-14 |
| A-04 | `backend/src/routes/notas-credito.js`; `backend/src/routes/facturas.js` | 8,59-123,126-154; 8,176-225 |
| A-05 | `backend/src/routes/notas-credito.js` | 72-101 |
| A-06 | `backend/src/utils.js`; `backend/src/routes/usuarios.js` | 36-48; 41 |
| M-01 | `backend/src/config.js`; `backend/src/middleware/notificar.js`; `backend/src/routes/auth.js` | 101; 17; 244-246 |
| M-02 | `backend/src/routes/auth.js` | 48-56,96-99,211-222,122-126 |
| M-03 | `backend/src/routes/clientes.js` | 128-153 |
| M-04 | `backend/src/middleware/rateLimit.js`; `backend/src/routes/auth.js` | —; 198-252 |
| M-05 | `database/init.sql`; `backend/src/routes/mis.js`; `backend/src/routes/pagos.js` | 282-287; 104-106; 29-30 |
| M-06 | `backend/src/routes/clientes.js`; `backend/src/middleware/auth.js` | 115-125; 22-67 |
| M-07 | `backend/src/middleware/audit.js`; `database/init.sql` | 19-41; 175-184 |
| M-08 | `docker-compose.yml`; `backend/src/db.js` | 5-8,27-29; 4-11 |
| M-09 | `frontend/nginx.conf` | 1-23 |
| M-10 | `frontend/src/pages/FacturaDetalle.jsx`; `Clientes.jsx`; `BalanceClientes.jsx` | 120; 80; 44 |
| M-11 | `backend/src/routes/facturas.js`; `notas-credito.js`; `pedidos.js`; `productos.js`; `pagos.js` | 48-56; 62-66; 87; 39-41; 98 |
| M-12 | `backend/package-lock.json`; `frontend/package-lock.json` | — |
| M-13 | `backend/src/index.js`; `backend/src/routes/*.js`; `reportes.js` | 36; `LIMIT 300`; 82-113 |
| M-14 | `docker-compose.yml` | 11-13 |

---

## 9. Declaración final

La revisión se realizó con fines académicos y defensivos, sobre una copia local del proyecto, sin acceso a datos reales de clientes ni a infraestructura de producción. No se modificó el código auditado y los hallazgos se documentan con evidencia verificable (archivo y línea) para que el equipo pueda corregirlos y volver a verificarlos.
