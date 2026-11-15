# Checklist de despliegue · FINAN-X

Marque cada punto antes de publicar o de entregar el proyecto. Si algo falla, no se
considera desplegable.

## 1. Antes de desplegar

- [ ] `.env` creado a partir de `.env.example` y **fuera de Git**.
- [ ] `JWT_SECRET` aleatorio de 48 bytes (no un valor de ejemplo).
- [ ] `POSTGRES_PASSWORD` y `APP_DB_PASSWORD` aleatorios y distintos.
- [ ] `NODE_ENV=production`, `COOKIE_SECURE=on`, `REGISTRO_ABIERTO=off`.
- [ ] `CORS_ORIGINS` con el dominio HTTPS real (sin `*`).
- [ ] Certificado TLS en `certs/` (`fullchain.pem`, `privkey.pem`).

## 2. Puertos y red

- [ ] `docker compose ps` **no** muestra 5432 ni 4000 publicados.
- [ ] Solo 80/443 (producción) o 8080/8443 (demo) están expuestos.
- [ ] `curl http://IP:5432` y `curl http://IP:4000` fallan desde otro equipo.

## 3. Base de datos

- [ ] `docker compose exec backend node scripts/verificar-esquema.mjs` → OK.
- [ ] El usuario de la aplicación no es superusuario:
      `SELECT rolsuper FROM pg_roles WHERE rolname = current_user;` → `f`.
- [ ] La migración de despliegue está aplicada (`debe_cambiar_clave`, `username`, `ip`).

## 4. Cuentas y acceso

- [ ] `primer-ingreso/usuarios-iniciales.json` existe y coincide con el acta.
- [ ] Las cuentas se crearon (script o pantalla de Usuarios).
- [ ] El primer login pide cambiar la contraseña y bloquea el resto (403).
- [ ] La contraseña temporal ya no sirve después del cambio.
- [ ] El acta se entrega aparte y no está en el repositorio.

## 5. Seguridad de la aplicación

- [ ] Respuesta con `Content-Security-Policy`, `X-Frame-Options: DENY` y HSTS (TLS).
- [ ] `/api/*` responde `Cache-Control: no-store`.
- [ ] 6 intentos fallidos contra una cuenta → 429; un login ajeno no la desbloquea.
- [ ] Un CAJERO recibe 403 al crear o anular una nota de crédito.
- [ ] Dos notas de crédito simultáneas no superan lo pagado.
- [ ] La API no devuelve `numero_cuenta` completo ni el vencimiento de la tarjeta.
- [ ] `npm audit --audit-level=high` sin hallazgos altos.
- [ ] No queda ningún `[clave retirada]`/`finanx.test` en la **interfaz ni en la documentación vigente**.
      Solo pueden aparecer en (a) el informe histórico de auditoría, (b) el **seed de demostración**
      (exige `SEED_DEMO=true` y `NODE_ENV≠production`) y (c) la lista de contraseñas bloqueadas.

## 6. Operación

- [ ] Respaldo generado y **restaurado** en un entorno limpio.
- [ ] `respaldo/` se copia fuera del servidor.
- [ ] Logs revisados (`docker compose logs backend`) sin errores.
- [ ] `reiniciar-datos` probado en un entorno de demo (no en producción).
- [ ] Documentación actualizada: `README.md`, `00-indice.md`, acta.

## 7. Entrega académica

- [ ] `version final finan-x/` completa (código, docs, acta, entrega, base demo).
- [ ] El informe de auditoría y el estado de remediación están incluidos.
- [ ] Las notas del Release publican el SHA-256 del ZIP entregado.
- [ ] El proyecto original quedó intacto (manifiesto SHA-256).
