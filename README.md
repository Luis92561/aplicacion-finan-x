# FINAN-X · Facturación y pagos

Aplicación web de **facturación, cartera y pagos** para una empresa pequeña: clientes,
productos, pedidos, facturas, pagos, notas de crédito, reportes, auditoría y un **portal de
autoservicio para clientes**.

- **Frontend:** React 18 + Vite + Recharts (panel con gráficas interactivas).
- **Backend:** Node.js 22 + Express 4 + PostgreSQL 16.
- **Despliegue:** Docker Compose (nginx + API + base de datos).
- **Versión:** 1.0.1 · ver [`CHANGELOG.md`](CHANGELOG.md).

> **Proyecto académico** de Integración de Aplicaciones (UNISABANETA), desarrollado por
> **Luis Alfredo Jaramillo Restrepo** y **Mayra Juliana Vélez Hernández**.

---

## 1. Requisitos

- **Docker Desktop** (Windows 10/11, macOS 12+ o Linux). Es lo único imprescindible.
- 4 GB de RAM libres y ~3 GB de disco.
- Puerto **8080** libre (demo HTTP); **8443** para la demo HTTPS.

---

## 2. Cómo ejecutarlo

### Desde el repositorio

```bash
cp .env.example .env      # complete JWT_SECRET, POSTGRES_PASSWORD y APP_DB_PASSWORD
docker compose up -d --build

# Cuentas iniciales: genera claves temporales aleatorias y las imprime en pantalla
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs
```

Abra <http://localhost:8080>. La primera construcción descarga las imágenes base de Node y
nginx (necesita internet); los arranques siguientes son locales.

- **Demo HTTPS:** `docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build`
  → <https://localhost:8443> (certificado autofirmado: acepte la excepción).
- **Producción:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.

La base de datos **no publica puertos** y la aplicación usa el rol sin privilegios
`finanx_app`; el superusuario de PostgreSQL solo se usa para inicializar.

### Con el paquete de entrega (sin internet)

El paquete `FINAN-X-USB.zip` (~191 MB) se publica en la pestaña **Releases**: incluye las
imágenes de Docker y lanzadores de doble clic para Windows. Pasos, verificación del SHA-256 y
solución de problemas en
[`documentacion/03-operacion/ABRIR-EN-OTRA-PC.md`](documentacion/03-operacion/ABRIR-EN-OTRA-PC.md).

> El paquete no se versiona porque supera el límite de 100 MB por archivo de GitHub.

---

## 3. Cuentas, primer ingreso y roles

1. Las cuentas se crean **una sola vez** con `npm run init:usuarios` (o el lanzador del
   paquete). Nacen con `debe_cambiar_clave = true` y una **clave temporal aleatoria**.
2. Al iniciar sesión, la API solo permite `/auth/sesion`, `/auth/cambiar-clave` y
   `/auth/logout`; el resto responde `403 CAMBIO_CLAVE_REQUERIDO`.
3. Tras cambiar la contraseña se invalidan las sesiones anteriores (`token_version`).
4. Un ADMIN puede restablecer claves desde **Usuarios**.

Reglas de contraseña: mínimo **12 caracteres**, sin contraseñas comunes, sin el usuario,
correo ni el nombre de la persona, y sin la marca de la aplicación. Se almacena con bcrypt (12).

**No existen credenciales de demostración.** Cómo se retiraron y por qué:
[`documentacion/04-seguridad/06-Retiro-Credenciales-Demo.md`](documentacion/04-seguridad/06-Retiro-Credenciales-Demo.md).

### Roles

| Rol | Puede |
|---|---|
| **ADMIN** | Todo: usuarios, clientes, facturación, pagos, devoluciones, reportes y auditoría. |
| **FACTURADOR** | Clientes, productos, pedidos, facturas, reportes y balances. |
| **CAJERO** | Clientes, pedidos, facturación, pagos y su caja del día (sin devoluciones). |
| **SUPERVISOR** | Consulta financiera, reportes, auditoría, devoluciones y anulaciones. |
| **CLIENTE** | Portal: sus datos, pedidos, facturas, pagos, saldo e historial. |

Las **notas de crédito** y la **anulación de facturas** están reservadas a ADMIN y SUPERVISOR
(separación de funciones: quien cobra no autoriza devoluciones).

### Autoregistro de clientes

Si `REGISTRO_ABIERTO=on`, un cliente puede crear su cuenta desde **Crear cuenta** en la
pantalla de ingreso. Límite antispam: 20 registros por hora e IP. En el repositorio y en
producción el valor por defecto es `off`; el paquete de demostración lo habilita.

---

## 4. Panel de control

El inicio es un panel con filtros de periodo (3, 6 o 12 meses):

- Indicadores: facturado del mes (con variación), recaudado, cartera, facturas pendientes y
  pagos del día.
- Gráfica de área **facturado vs recaudado** (se puede ocultar cada serie).
- Dona de **pagos por método**: al hacer clic filtra la tabla.
- Barras de **top 5 clientes por saldo**: al hacer clic filtra la tabla.
- Tabla interactiva con búsqueda, orden por columna, paginación y exportación a CSV.

El **CAJERO** ve solo su operación (caja del día, pagos por método y últimos pagos). Detalle en
[`documentacion/02-tecnica/DASHBOARD.md`](documentacion/02-tecnica/DASHBOARD.md).

---

## 5. API (resumen)

```
POST   /api/auth/login               Iniciar sesión (usuario o correo)
GET    /api/auth/sesion              Usuario de la sesión actual
POST   /api/auth/cambiar-clave       Cambio de contraseña (primer ingreso)
POST   /api/auth/logout              Cerrar sesión
POST   /api/auth/registro            Autoregistro de cliente (si está habilitado)

GET    /api/dashboard                Panel (rol-consciente)
GET    /api/clientes · /productos · /pedidos · /facturas · /pagos
DELETE /api/clientes/:id             Eliminar cliente (ADMIN, solo sin movimientos)
POST   /api/notas-credito            Devolución (ADMIN/SUPERVISOR)
POST   /api/facturas/:id/anular      Anulación (ADMIN/SUPERVISOR)
GET    /api/reportes/* · /api/auditoria
GET    /api/mis-*                    Portal del cliente (aislado por cliente)
```

La sesión viaja en una cookie `HttpOnly` (`fx_session`); también se acepta
`Authorization: Bearer` para integraciones y pruebas.

---

## 6. Pruebas

```bash
cd backend && npm test          # suite end-to-end (157 comprobaciones)
npm audit --audit-level=high    # dependencias (backend y frontend)
```

La suite necesita el **modo demostración**: `NODE_ENV=development`, `SEED_DEMO=true`,
`OTP_RETORNO_DEMO=on`, `REGISTRO_ABIERTO=on` y `OTP_COOLDOWN_SEGUNDOS=0`. El detalle está en
[`documentacion/03-operacion/Instrucciones_Despliegue.md`](documentacion/03-operacion/Instrucciones_Despliegue.md).

---

## 7. Seguridad

- TLS en producción (nginx) con redirección 80→443 y HSTS.
- Cabeceras CSP, `X-Frame-Options: DENY`, `Referrer-Policy` y `Cache-Control: no-store`.
- PostgreSQL sin puertos publicados y con rol de aplicación de privilegios mínimos.
- Bloqueo de fuerza bruta por cuenta y por IP+usuario, con retroceso.
- Auditoría con IP y user-agent, sin posibilidad de reescribirla desde la aplicación.
- Sin credenciales de demostración en la interfaz ni en el arranque.

Informe completo:
[`documentacion/04-seguridad/01-Informe-Auditoria-Seguridad-FINAN-X.pdf`](documentacion/04-seguridad/01-Informe-Auditoria-Seguridad-FINAN-X.pdf).
Estado de las correcciones:
[`documentacion/04-seguridad/04-Estado-de-Remediacion.md`](documentacion/04-seguridad/04-Estado-de-Remediacion.md).
Retiro de credenciales demo:
[`documentacion/04-seguridad/06-Retiro-Credenciales-Demo.md`](documentacion/04-seguridad/06-Retiro-Credenciales-Demo.md).

---

## 8. Estructura del proyecto

```
backend/            API REST (rutas, middleware, scripts de operación)
frontend/           SPA React + configuración de nginx
database/           init.sql, migraciones y creación del rol de aplicación
deploy/             nginx con TLS y generador de certificados
scripts/            respaldo de base de datos
primer-ingreso/     alta de cuentas iniciales (el acta se genera, no se versiona)
base/               datos de demostración (opcional)
documentacion/      guía docente, evidencias, especificaciones, operación y seguridad
```

La carpeta `entrega/` **no se versiona**: se construye aparte y se publica como Release.

---

## 9. Documentación

Índice completo en [`documentacion/00-indice.md`](documentacion/00-indice.md). Documentos clave:

- [`documentacion/03-operacion/ABRIR-EN-OTRA-PC.md`](documentacion/03-operacion/ABRIR-EN-OTRA-PC.md) — clonar y ejecutar, o usar el paquete.
- [`documentacion/03-operacion/Instrucciones_Despliegue.md`](documentacion/03-operacion/Instrucciones_Despliegue.md)
- [`documentacion/03-operacion/CHECKLIST-DESPLIEGUE.md`](documentacion/03-operacion/CHECKLIST-DESPLIEGUE.md)
- [`documentacion/02-tecnica/SPEC_Tecnico.md`](documentacion/02-tecnica/SPEC_Tecnico.md) y [`SPEC_Funcional.md`](documentacion/02-tecnica/SPEC_Funcional.md)

---

## 10. Uso de IA

Este proyecto se construyó con asistencia de **agentes de IA (Claude Code y OpenCode)**, siempre
**bajo supervisión constante de los autores**: cada fase fue dirigida, revisada, probada y
aprobada manualmente antes de continuar. Las decisiones de diseño, la validación funcional, las
pruebas y la verificación de seguridad son responsabilidad de los autores.

El detalle del método de trabajo está en
[`documentacion/02-tecnica/PLAN_Creacion.md`](documentacion/02-tecnica/PLAN_Creacion.md).

---

## 11. Autores y licencia

Desarrollado por **Luis Alfredo Jaramillo Restrepo** y **Mayra Juliana Vélez Hernández** para el
proyecto de Integración de Aplicaciones (UNISABANETA, sexto semestre).

Licencia: ver [`LICENSE.md`](LICENSE.md) y
[`documentacion/01-academica/E5_Contrato_Licencia_Software.pdf`](documentacion/01-academica/E5_Contrato_Licencia_Software.pdf).
