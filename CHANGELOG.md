# Historial de cambios · FINAN-X

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado semántico.

## [1.0.1] — 2026-11-15

### Documentación

- Evidencias **E1–E7 regeneradas** desde el sistema real: esquema de **128 columnas y 16 claves
  foráneas**, **276 dependencias**, suite de **157 comprobaciones** y **51 casos de control**.
- Portada y pie de E1–E7 con **autores, versión y fecha**.
- E3 incorpora los requisitos del primer ingreso, la eliminación de clientes y el panel de control;
  E6 los traza (25 historias, 43 requisitos) y E7 añade CP-49 a CP-51.
- Fuera las credenciales de demostración de las especificaciones, el plan y la guía de código
  (sustituidas por el flujo de primer ingreso del acta).
- Enlaces del acta corregidos; variables reales de la suite documentadas.

### Cambiado

- El **portal del cliente** permite iniciar sesión con el **correo** registrado en su
  ficha, además del nombre de usuario.

### Corregido

- **Autoregistro de clientes:** la pantalla llamaba a `entrar(user, token)` con una variable
  inexistente. El servidor creaba el cliente (201 + cookie), pero el navegador mostraba
  "token is not defined" y el alta parecia fallar; ahora entra directo al portal.
- Documentacion alineada con el codigo: contrasena minima de **12 caracteres**, version 1.0.1
  y enlaces de operacion actualizados.

### Cambiado

- **La carpeta `entrega/` deja de versionarse** (paquete de imagenes de ~191 MB y lanzadores).
  El paquete se publica como adjunto del Release y el repositorio se ejecuta con
  `docker compose up -d --build`.
- Se retiran `LEEME-PRIMERO.txt`, `LEEME-WINDOWS.md` y `SHA256SUMS.txt`: su contenido
  queda en el README, en `documentacion/03-operacion/ABRIR-EN-OTRA-PC.md` y en las notas del
  Release, que incluye el SHA-256 del ZIP.
- **Retiro formal de las credenciales de demostracion:** nuevo documento
  `documentacion/04-seguridad/06-Retiro-Credenciales-Demo.md` y redaccion de las claves en la
  documentacion vigente.
- Se declara el uso de **agentes de IA bajo supervision constante de los autores** en el README
  y en las especificaciones.
- **Integracion continua** (GitHub Actions): compilacion del frontend, instalacion del backend,
  validacion de los tres perfiles de Compose y construccion de imagenes.
## [1.0.0] — 2026-11-02

Primera versión preparada para despliegue. Incluye la auditoría de seguridad y su
remediación, el panel de control interactivo y el flujo de primer ingreso.

### Añadido

- **Ver/Ocultar contraseña** en el login, el registro, la recuperación y el cambio
  obligatorio, para comprobar que la clave temporal se escribió completa.
- **Eliminar cliente** desde la pantalla de Clientes (solo ADMIN). Se permite únicamente
  si el cliente no tiene pedidos, facturas, pagos ni notas de crédito; si tiene historial,
  la API responde 409 y se sugiere inactivarlo. La operación queda en auditoría.
- **Catálogo tecnológico de ejemplo**: 20 productos de informática con precios de
  referencia en COP, IVA del 19 % y características (`base/productos-tecnologicos.sql`).
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
