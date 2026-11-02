# FINAN-X · Facturación y pagos

Aplicación web de **facturación, cartera y pagos** para una empresa pequeña:
clientes, productos, pedidos, facturas, pagos, notas de crédito, reportes, auditoría
y un **portal de autoservicio para clientes**.

- **Frontend:** React 18 + Vite + Recharts (panel con gráficas interactivas).
- **Backend:** Node.js 22 + Express 4 + PostgreSQL 16.
- **Despliegue:** Docker Compose (frontend nginx + API + base de datos).
- **Versión:** 1.0.0 · ver `CHANGELOG.md`.

> **Proyecto académico** de Integración de Aplicaciones (UNISABANETA), desarrollado por
> **Luis Alfredo Jaramillo Restrepo** y **Mayra Juliana Velez**. Esta versión se endureció
> para poder desplegarse: los cambios de seguridad están documentados en
> `documentacion/04-seguridad/04-Estado-de-Remediacion.md`.

---

## 1. Requisitos

- **Docker Desktop** (Windows 10/11, macOS 12+ o Linux). Es lo único imprescindible.
- 4 GB de RAM libres y ~3 GB de disco.
- Puertos libres: **8080** (demo HTTP) o **8443** (demo HTTPS) y, en producción, 80/443.

---

## 2. Abrir la aplicación (la forma fácil)

| Sistema | Archivo |
|---|---|
| Windows | `entrega/windows/ABRIR-FINAN-X.bat` (doble clic) |
| macOS | `entrega/mac/ABRIR-FINAN-X.command` (doble clic) |

El lanzador arranca Docker, genera el `.env` con claves aleatorias, carga las imágenes si
están en el paquete sin conexión, levanta el stack, crea las cuentas iniciales y abre
`http://localhost:8080`.

Las cuentas y sus **claves temporales** están en
`primer-ingreso/Acta-Usuarios-Primer-Ingreso.pdf`. Todas obligan a **cambiar la contraseña
en el primer ingreso**.

Otros lanzadores:

| Acción | Windows | macOS |
|---|---|---|
| Detener (conserva datos) | `CERRAR-FINAN-X.bat` | `CERRAR-FINAN-X.command` |
| Borrar datos y reiniciar demo | `REINICIAR-DATOS.bat` | `REINICIAR-DATOS.command` |
| Modo seguro HTTPS (:8443) | `ABRIR-MODO-SEGURO.bat` | `ABRIR-MODO-SEGURO.command` |

---

## 3. Abrir con Docker Compose (manual)

```bash
cp .env.example .env      # y complete JWT_SECRET, POSTGRES_PASSWORD y APP_DB_PASSWORD
docker compose up -d --build

# Crear las cuentas iniciales (una sola vez)
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs \
  --archivo /primer-ingreso/usuarios-iniciales.json
```

- Demo HTTP: <http://localhost:8080>
- Producción con TLS: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
- Demo HTTPS: `docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build` → <https://localhost:8443>

La base de datos **no publica puertos** y la aplicación usa un rol sin privilegios de
administrador (`finanx_app`). El superusuario de PostgreSQL solo se usa para inicializar.

---

## 4. Estructura del proyecto

```
backend/            API REST (rutas, middleware, scripts de operación)
frontend/           SPA React + configuración de nginx
database/           init.sql, migraciones y creación del rol de aplicación
deploy/             nginx con TLS y generador de certificados
scripts/            respaldo de base de datos
entrega/windows/    lanzador .bat + paquete sin conexión
entrega/mac/        lanzador .command + paquete sin conexión
primer-ingreso/     acta de usuarios iniciales y claves temporales
base/               datos de demostración (opcional)
documentacion/      guía docente, evidencias, especificaciones, operación y seguridad
```

---

## 5. Usuarios y primer ingreso

1. El administrador crea las cuentas (`npm run init:usuarios`) o desde **Usuarios**.
2. Cada cuenta nace con `debe_cambiar_clave = true`.
3. Al iniciar sesión, la API solo permite `/auth/sesion`, `/auth/cambiar-clave` y
   `/auth/logout`; cualquier otra ruta responde `403 CAMBIO_CLAVE_REQUERIDO`.
4. Tras cambiar la contraseña se invalidan las sesiones anteriores (`token_version`) y se
   emite una sesión nueva.

Reglas de contraseña: mínimo **12 caracteres**, sin contraseñas comunes, sin el usuario,
correo o nombre de la persona y sin la marca de la aplicación. Se almacena con bcrypt (12).

### Roles

| Rol | Puede |
|---|---|
| **ADMIN** | Todo: usuarios, clientes, facturación, pagos, devoluciones, reportes y auditoría. |
| **FACTURADOR** | Clientes, productos, pedidos, facturas, reportes y balances. |
| **CAJERO** | Clientes, pedidos, facturación, pagos y su caja del día (sin devoluciones). |
| **SUPERVISOR** | Consulta financiera, reportes, auditoría, devoluciones y anulaciones. |
| **CLIENTE** | Portal: sus datos, pedidos, facturas, pagos, saldo e historial. |

Las **notas de crédito** y la **anulación de facturas** están reservadas a ADMIN y
SUPERVISOR (separación de funciones: quien cobra no autoriza devoluciones).

---

## 6. Panel de control

El inicio es un panel con filtros de periodo (3, 6 o 12 meses):

- Indicadores: facturado del mes (con variación), recaudado, cartera, facturas pendientes
  y pagos del día.
- Gráfica de área **facturado vs recaudado** (se puede ocultar cada serie).
- Dona de **pagos por método**: al hacer clic filtra la tabla.
- Barras de **top 5 clientes por saldo**: al hacer clic filtra la tabla.
- Tabla interactiva con búsqueda, orden por columna, paginación y exportación a CSV.

El **CAJERO** ve solo su operación (caja del día, pagos por método y últimos pagos); no
recibe la cartera global ni el top de clientes. Detalle en
`documentacion/02-tecnica/DASHBOARD.md`.

---

## 7. API (resumen)

```
POST   /api/auth/login               Iniciar sesión (usuario o correo)
GET    /api/auth/sesion              Usuario de la sesión actual
POST   /api/auth/cambiar-clave       Cambio de contraseña (primer ingreso)
POST   /api/auth/logout              Cerrar sesión (opcional: todas)

GET    /api/dashboard                Panel (rol-consciente)
GET    /api/clientes · /productos · /pedidos · /facturas · /pagos
POST   /api/notas-credito            Devolución (ADMIN/SUPERVISOR)
POST   /api/facturas/:id/anular      Anulación (ADMIN/SUPERVISOR)
GET    /api/reportes/* · /api/auditoria
GET    /api/mis-*                    Portal del cliente (aislado por cliente)
```

La sesión viaja en una cookie `HttpOnly` (`fx_session`); también se acepta
`Authorization: Bearer` para integraciones y pruebas.

---

## 8. Pruebas

```bash
cd backend && npm test          # suite end-to-end (155 comprobaciones)
npm audit --audit-level=high    # dependencias (backend y frontend)
```

La suite necesita el modo demostración (`NODE_ENV != production`, `SEED_DEMO=true`,
`OTP_RETORNO_DEMO=on`). El detalle está en `documentacion/03-operacion/Instrucciones_Despliegue.md`.

---

## 9. Seguridad

- TLS en producción (nginx) con redirección 80→443 y HSTS.
- Cabeceras CSP, `X-Frame-Options: DENY`, `Referrer-Policy` y `Cache-Control: no-store`.
- PostgreSQL sin puertos publicados y con rol de aplicación de privilegios mínimos.
- Bloqueo de fuerza bruta por cuenta y por IP+usuario, con retroceso.
- Auditoría con IP y user-agent, sin posibilidad de reescribirla desde la aplicación.
- Sin credenciales de demostración en la interfaz ni en el arranque de producción.

Informe completo: `documentacion/04-seguridad/01-Informe-Auditoria-Seguridad-FINAN-X.pdf`.
Estado de las correcciones: `documentacion/04-seguridad/04-Estado-de-Remediacion.md`.

---

## 10. Documentación

Índice completo en **`documentacion/00-indice.md`**. Los documentos clave:

- `documentacion/03-operacion/Instrucciones_Despliegue.md`
- `documentacion/03-operacion/CHECKLIST-DESPLIEGUE.md`
- `documentacion/03-operacion/ABRIR-EN-OTRA-PC.md`
- `documentacion/02-tecnica/SPEC_Tecnico.md` y `SPEC_Funcional.md`
- `documentacion/05-usuarios/Acta-Usuarios-Primer-Ingreso.pdf`

---

## 11. Autores y licencia

Desarrollado por **Luis Alfredo Jaramillo Restrepo** y **Mayra Juliana Velez** para el
proyecto de Integración de Aplicaciones (UNISABANETA, sexto semestre).
Licencia: ver `LICENSE.md` y `documentacion/01-academica/E5_Contrato_Licencia_Software.pdf`.
