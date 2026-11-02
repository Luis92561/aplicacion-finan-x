# FINAN-X · Instrucciones de despliegue

> **Proyecto:** FINAN-X · **Autores:** Luis Alfredo Jaramillo Restrepo · Mayra Juliana Velez
> **Versión:** 1.0.0 · **Fecha:** noviembre de 2026

Este documento explica cómo dejar FINAN-X funcionando **en otro equipo** y cómo
desplegarla con TLS. Para la guía rápida de doble clic, ver
`ABRIR-EN-OTRA-PC.md` y los `LEEME` de `entrega/`.

---

## 1. Qué se va a levantar

| Componente | Tecnología | Dirección |
|---|---|---|
| Base de datos | PostgreSQL 16 | Solo red interna (`db:5432`), **no publicada** |
| API REST | Node.js 22 + Express | Solo red interna (`backend:4000`), **no publicada** |
| Frontend + proxy | React compilado + nginx | `http://localhost:8080` (demo) o `https://…` (TLS) |

---

## 2. Requisitos

- Docker Desktop (Windows 10/11, macOS 12+ o Linux) con Docker Compose v2.
- 4 GB de RAM libres, ~3 GB de disco.
- Puertos libres: 8080 (demo) o 80/443 (producción) / 8443 (modo seguro).
- Para el paquete sin conexión: las imágenes en `entrega/*/paquete-offline/`.

---

## 3. Configuración (`.env`)

Copie `.env.example` a `.env` y complete:

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `JWT_SECRET` | Sí | Secreto de firma, ≥ 32 caracteres aleatorios. |
| `POSTGRES_PASSWORD` | Sí | Contraseña del superusuario (solo inicialización). |
| `APP_DB_PASSWORD` | Sí | Contraseña del rol de aplicación `finanx_app`. |
| `CORS_ORIGINS` | Sí en producción | Origen(es) permitidos, separados por coma. |
| `COOKIE_SECURE` | Producción: `on` | La cookie de sesión exige HTTPS. |
| `NODE_ENV` | `production` | En producción el OTP demo queda apagado. |
| `REGISTRO_ABIERTO` | `off` | Autoregistro público de clientes. |

Los lanzadores de `entrega/` generan este archivo con claves aleatorias la primera vez.

---

## 4. Levantar

### 4.1 Demo local (HTTP, puerto 8080)

```bash
docker compose up -d --build
```

### 4.2 Producción con TLS (puertos 80/443)

1. Genere el certificado:
   - Dominio real: emita el certificado con Let's Encrypt (certbot) y coloque
     `fullchain.pem` y `privkey.pem` en `certs/`.
   - Demostración: `./deploy/generar-certificado.sh` (o `.ps1` en Windows) crea un
     certificado autofirmado para `localhost`.
2. Ajuste `DOMAIN` y `CORS_ORIGINS=https://su-dominio` en `.env`, con `COOKIE_SECURE=on`.
3. Levante con la superposición de producción:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 4.3 Modo seguro de demostración (HTTPS en 8443)

```bash
./deploy/generar-certificado.sh
docker compose -f docker-compose.yml -f docker-compose.secure.yml up -d --build
# https://localhost:8443  (aceptar el aviso de certificado autofirmado)
```

---

## 5. Crear las cuentas iniciales

La base de datos no crea usuarios sola. Hay dos caminos:

```bash
# A) Script (recomendado): crea admin, facturación, caja, supervisión y cliente
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs \
  --archivo /primer-ingreso/usuarios-iniciales.json
```

```text
# B) Desde la aplicación: entre como ADMIN y use "Usuarios" / "Clientes".
```

- Las claves temporales están en `primer-ingreso/Acta-Usuarios-Primer-Ingreso.pdf`.
- Todas las cuentas piden **cambiar la contraseña en el primer ingreso**.
- Si se pierde el acta, un ADMIN puede restablecer la clave desde **Usuarios →
  Restablecer clave** (se muestra una sola vez).

Para regenerar el archivo de claves (solo si aún no existen las cuentas):

```bash
rm primer-ingreso/usuarios-iniciales.json
docker compose exec -T backend node scripts/crear-usuarios-iniciales.mjs \
  --archivo /primer-ingreso/usuarios-iniciales.json
```

---

## 6. Verificación

| Qué | Cómo |
|---|---|
| API sana | `curl http://localhost:8080/api/health` → `{"ok":true}` |
| Contenedores | `docker compose ps` (db y backend `healthy`) |
| Esquema | `docker compose exec backend node scripts/verificar-esquema.mjs` |
| Primer ingreso | Entrar con una cuenta del acta: debe pedir el cambio de clave. |
| Puertos cerrados | `docker compose ps` no muestra 5432 ni 4000 publicados. |
| Cabeceras | `curl -I http://localhost:8080/` → CSP, X-Frame-Options, no-store. |
| Suite e2e (dev) | `docker compose exec -e API_BASE=http://localhost:4000/api backend npm test` |

La suite e2e requiere modo demostración (`NODE_ENV != production`, `SEED_DEMO=true`,
`OTP_RETORNO_DEMO=on`); no se ejecuta contra producción.

---

## 7. Respaldos y restauración

```bash
./scripts/respaldo.sh          # respaldo/finanx-AAAAMMDD-HHMM.sql.gz
```

- Retención por defecto: 14 archivos.
- Copie `respaldo/` a un almacenamiento externo.
- **Pruebe la restauración** al menos una vez:

```bash
gunzip -c respaldo/finanx-XXXX.sql.gz | docker compose exec -T db psql -U postgres -d finanx
```

Objetivo inicial: RPO ≤ 24 h, RTO ≤ 4 h. Ver `CHECKLIST-DESPLIEGUE.md`.

---

## 8. Actualizar una instalación existente

1. Respaldar la base (`scripts/respaldo.*`).
2. `docker compose down` (conserva el volumen).
3. Actualizar el código y ejecutar `docker compose up -d --build`.
4. Aplicar migraciones pendientes:

```bash
docker compose exec -T db psql -U postgres -d finanx < database/migracion_despliegue.sql
docker compose exec -T db psql -U postgres -d finanx < database/migracion_recuperacion_contrasena.sql
```

5. Verificar con `docker compose exec backend node scripts/verificar-esquema.mjs`.

---

## 9. Detener y borrar

| Acción | Comando |
|---|---|
| Detener conservando datos | `docker compose down` |
| Detener y borrar todo | `docker compose down -v` (¡elimina la base!) |

---

## 10. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Bind for 0.0.0.0:8080 failed` | Otro proceso usa el puerto | Cierre el otro proceso o cambie el mapeo. |
| El backend no arranca y pide migración | Volumen antiguo sin columnas nuevas | Ejecute `migracion_despliegue.sql` (sección 8). |
| `Falta JWT_SECRET` | `.env` incompleto | Genere el secreto (sección 3). |
| La cookie no se guarda en HTTPS | `COOKIE_SECURE=off` | Póngalo en `on` y use HTTPS. |
| El navegador avisa del certificado | Autofirmado | Acepte la excepción (solo demo). |
| `npm test` falla con 403/OTP | Está en modo producción | Use un entorno de desarrollo con `SEED_DEMO` y `OTP_RETORNO_DEMO`. |

---

## 11. Orden recomendado para leer el código

1. `database/init.sql` — esquema, restricciones y vista `factura_saldo`.
2. `backend/src/config.js` y `db.js` — configuración y conexión.
3. `backend/src/index.js` — middleware global y montaje de rutas.
4. `backend/src/middleware/auth.js` — sesión, roles y primer ingreso.
5. `backend/src/routes/` — módulos en orden de negocio.
6. `backend/src/routes/dashboard.js` — panel de control.
7. `frontend/src/App.jsx` y `pages/` — rutas y pantallas.
8. `documentacion/02-tecnica/DASHBOARD.md` — definición de las métricas.
