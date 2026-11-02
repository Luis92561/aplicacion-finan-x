# Historial de cambios · FINAN-X

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado semántico.

## [1.0.0] — 2026-11-02

Primera versión preparada para despliegue. Incluye la auditoría de seguridad y su
remediación, el panel de control interactivo y el flujo de primer ingreso.

### Añadido

- **Panel de control interactivo** con indicadores, gráficas (Recharts) y tabla con
  búsqueda, orden, paginación y exportación a CSV. Contenido distinto según el rol:
  el CAJERO ve solo su caja.
- **Primer ingreso obligatorio**: columnas `debe_cambiar_clave` y
  `clave_actualizada_en`; pantalla `/cambiar-clave`; la API bloquea el resto de rutas
  con `403 CAMBIO_CLAVE_REQUERIDO` hasta que se cambie la contraseña.
- **Sesión con cookie HttpOnly** (`fx_session`) y protección CSRF por `SameSite=Strict`
  y comprobación de origen. Se mantiene `Bearer` para API y pruebas.
- Endpoints `GET /auth/sesion`, `POST /auth/cambiar-clave`, `POST /auth/logout` y
  `GET /dashboard`.
- Script `npm run init:usuarios` para crear las cuentas iniciales con claves temporales.
- Verificación de esquema al arrancar (`scripts/verificar-esquema.mjs`).
- Migración `database/migracion_despliegue.sql` y creación del rol `finanx_app` con
  privilegios mínimos (`database/zz-rol-app.sh`).
- Lanzadores de doble clic para Windows (`.bat`) y macOS (`.command`), con modo HTTPS
  separado y paquete de imágenes para funcionar sin internet.
- `scripts/respaldo.ps1` y `scripts/respaldo.sh`.
- Documentación reorganizada por propósito, acta de usuarios iniciales, checklist de
  despliegue y guía para abrir el proyecto en otro equipo.

### Cambiado

- `docker-compose.yml`: la base de datos ya no publica el puerto 5432 y el backend ya no
  publica el 4000; la aplicación se conecta como `finanx_app` (sin DDL ni superusuario).
- El seed de demostración ya no se ejecuta en el arranque y se niega a correr en
  producción (`SEED_DEMO=true` solo en desarrollo).
- Contraseñas: mínimo 12 caracteres, lista de contraseñas comunes, bcrypt coste 12.
- Bloqueo de fuerza bruta por cuenta (base de datos) y por IP+usuario, sin reinicio global.
- Notas de crédito y anulación de facturas: solo ADMIN y SUPERVISOR.
- La auditoría guarda IP y user-agent; la aplicación no puede modificar ni borrar sus
  registros.
- Datos de pago: la API enmascara el número de cuenta y no devuelve el vencimiento.
- Cabeceras de seguridad en nginx (CSP, HSTS, X-Frame-Options, no-store).
- Tokens JWT de 2 horas, con emisor y audiencia fijos y algoritmo restringido.

### Corregido

- `PATCH`/`POST` de usuarios inexistentes respondían como portal en lugar de 404.
- El cuerpo JSON inválido devolvía 500 en lugar de 400.
- La columna "Rol" de Usuarios mostraba estados de negocio ("CONFIRMADO",
  "PAGO PARCIAL"); ahora muestra ADMIN/FACTURADOR/CAJERO/SUPERVISOR/CLIENTE.
- La operación de auditoría se pintaba como estado de pago.
- Enlaces `mailto:` sin codificar el destinatario (posible inyección de cabeceras).
- Errores de validación que terminaban en 500 en facturas, notas de crédito y productos.
- Desactivar un cliente no revocaba su sesión del portal.

### Seguridad

Corregidos los 3 hallazgos críticos y los 6 altos del informe de auditoría; el detalle
punto por punto está en `documentacion/04-seguridad/04-Estado-de-Remediacion.md`.

### Pendiente (documentado)

- MFA (TOTP) para administradores.
- Row-Level Security como defensa en profundidad.
- Paginación completa en todos los listados (hoy `limit/offset` + total).
- Escaneo de imágenes y SAST/DAST dentro de un pipeline CI.
