# Estado de remediación de la auditoría · FINAN-X 1.0.0

Este documento cierra el informe `01-Informe-Auditoria-Seguridad-FINAN-X.pdf` (32
hallazgos) y dice, punto por punto, **qué se corrigió**, **cómo se verificó** y **qué
queda pendiente**.

Fecha de cierre: 2 de noviembre de 2026 · Versión: 1.0.0

---

## 1. Críticos

| ID | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| C-01 | Credenciales de administrador por defecto en cada arranque y demo en la UI | **Corregido** | `backend/Dockerfile` ya no ejecuta el seed; `seed.js` se niega a correr con `NODE_ENV=production`; `Login.jsx` sin bloque de credenciales; cuentas iniciales con clave temporal y cambio obligatorio (`scripts/crear-usuarios-iniciales.mjs`). |
| C-02 | PostgreSQL publicado con `finanx`/`finanx` y superusuario | **Corregido** | `docker-compose.yml` sin `ports` para `db`; `POSTGRES_USER=postgres` solo para init; rol `finanx_app` sin superusuario (`database/zz-rol-app.sh`); verificado con `rolsuper = f`. |
| C-03 | Sin TLS y backend publicado en :4000 | **Corregido** | `docker-compose.prod.yml` (80/443) y `deploy/nginx-tls.conf` con TLS 1.2/1.3 y HSTS; backend solo `expose`; modo seguro en 8443 para la demo. |

## 2. Altos

| ID | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| A-01 | El bloqueo se reiniciaba con un login válido | **Corregido** | Contador por `(IP, usuario)` y por cuenta en BD (`fallos_login`, `bloqueado_hasta`); sin reset global. Prueba e2e: 5 fallos → 429 y un login ajeno no desbloquea. |
| A-02 | `X-Forwarded-For` falsificable | **Corregido** | `trust proxy` por rangos (loopback y red Docker); nginx sobrescribe la cabecera con `$remote_addr`; el 4000 no se publica. |
| A-03 | JWT en `localStorage` y SPA sin CSP | **Corregido** | Cookie `fx_session` HttpOnly/SameSite=Strict; `api.js` con `withCredentials`; CSP, HSTS, X-Frame-Options y no-store en nginx; token de 2 h. |
| A-04 | Devoluciones y anulaciones sin segregación | **Corregido** | `notas-credito.js` y la anulación de facturas exigen ADMIN/SUPERVISOR; probado: CAJERO → 403. |
| A-05 | Carrera en notas de crédito | **Corregido** | `SELECT … FOR UPDATE OF f` y recálculo dentro de la transacción (`notas-credito.js`). |
| A-06 | Contraseñas débiles y sin MFA | **Parcial** | Mínimo 12, lista de comunes, datos personales bloqueados, bcrypt 12, cambio obligatorio. **MFA pendiente** (ver §5). |

## 3. Medios

| ID | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| M-01 | OTP demo activable sin `NODE_ENV` | **Corregido** | `config.js`: `otpDemo = !esProduccion && …`; nunca en producción. |
| M-02 | Enumeración de cuentas | **Corregido** | Hash de relleno para igualar tiempos; mensajes uniformes; duplicados sin oráculo; OTP con respuesta genérica. |
| M-03 | Cualquier rol creaba cuentas de portal | **Corregido** | Solo ADMIN; clave temporal generada y mostrada una vez; cambio obligatorio. |
| M-04 | Límite solo por IP, sin cooldown de OTP | **Corregido** | Contadores por cuenta + enfriamiento de 60 s por OTP (`OTP_COOLDOWN_SEGUNDOS`). |
| M-05 | Datos de pago completos y sin cifrar | **Parcial** | La API enmascara `numero_cuenta` y no devuelve vencimiento; **cifrado en reposo pendiente** (ver §5). |
| M-06 | Desactivar cliente no revocaba sesión | **Corregido** | `requireAuth` valida estado de la cuenta y del cliente en cada petición. |
| M-07 | Auditoría sin IP/UA ni integridad | **Corregido** | Columnas `ip` y `user_agent`; `REVOKE UPDATE, DELETE` para `finanx_app`; retención documentada. |
| M-08 | App como superusuario, sin RLS | **Parcial** | Rol de aplicación sin DDL ni superusuario; **RLS pendiente**. |
| M-09 | SPA sin cabeceras | **Corregido** | `frontend/nginx.conf` y `deploy/nginx-tls.conf`. |
| M-10 | Inyección en `mailto:` | **Corregido** | `encodeURIComponent` en FacturaDetalle, Clientes y BalanceClientes; validación de correo en API. |
| M-11 | Validación incompleta → 500 | **Corregido** | `idNumerico` en facturas y notas; `Number.isFinite` para cantidades; impuesto validado; método normalizado; errores PG mapeados a 400/409. |
| M-12 | Dependencias con CVE | **Corregido** | `npm audit` de backend y frontend sin hallazgos altos. |
| M-13 | Sin límite global ni paginación | **Parcial** | Límite global (300/15 min), cuerpo de 64 KB y `limit/offset` en listados; la paginación visual solo está en el panel. |
| M-14 | Sin respaldos | **Corregido** | `scripts/respaldo.ps1` / `.sh` con retención 14; procedimiento de restauración documentado. |

## 4. Bajos

| ID | Estado | Nota |
|---|---|---|
| B-01 | Corregido | `/api/health` devuelve solo `{ok:true}`; 404 genérico. |
| B-02 | Corregido | JWT con `algorithms`, `iss`, `aud`; 2 h. |
| B-03 | Pendiente | Código Efecty determinístico; requiere integración con el recaudador. |
| B-04 | Parcial | Enums validados; verificación de correo/teléfono pendiente. |
| B-05 | Corregido | Sin OTP en logs; errores no exponen detalles. |
| B-06 | Pendiente | Escaneo de imágenes/SAST en CI (se incluye workflow básico). |
| B-07 | Corregido | `Cache-Control: no-store` en `/api`. |
| B-08 | Documentado | Limitador en memoria; para varias instancias usar Redis. |
| B-09 | Aceptado | Numeración secuencial (requisito de facturación). |

## 5. Pendiente y por qué

1. **MFA (A-06):** requiere dependencia, enrolamiento y códigos de respaldo. Se compensa
   con 12+, bloqueo por cuenta y cambio obligatorio. Recomendado para la siguiente versión.
2. **Cifrado de datos de pago en reposo (M-05):** implica `pgcrypto`/KMS y rotación de
   claves; hoy se mitiga no devolviendo el dato completo.
3. **RLS (M-08):** defensa en profundidad; el aislamiento ya se hace en cada consulta.
4. **Paginación completa (M-13):** el panel paginа; los listados aceptan `limit/offset`.
5. **B-03 / B-06:** dependen de integraciones y del pipeline del repositorio.

## 6. Cómo se verificó

- Suite end-to-end: **157 comprobaciones en verde** (`npm test`), incluidas las nuevas de
  primer ingreso, bloqueo por cuenta, roles, dashboard y eliminación de clientes.
- Pruebas manuales contra el stack Docker: login → 403 de cambio obligatorio → cambio →
  200; token anterior → 401; CAJERO → 403 en notas; panel del CAJERO sin cartera.
- `npm audit --audit-level=high` sin hallazgos altos.
- Revisión de puertos: 5432 y 4000 no publicados.
- Esquema y rol: `verificar-esquema.mjs` y `SELECT rolsuper …` → `f`.
