# Política de seguridad · FINAN-X

## Versiones soportadas

| Versión | Soporte |
|---|---|
| 1.0.x | Sí (versión actual) |
| < 1.0 | No (versiones de desarrollo) |

## Reportar una vulnerabilidad

Este es un proyecto académico. Si encuentra un problema de seguridad:

1. **No lo publique** en un repositorio público ni en redes sociales.
2. Escriba a los responsables del proyecto (Luis Alfredo Jaramillo Restrepo y
   Mayra Juliana Velez) con:
   - descripción del problema,
   - pasos para reproducirlo,
   - impacto estimado,
   - versión/commit afectado.
3. Se confirmará la recepción y se coordinará la corrección antes de divulgar.

## Alcance

- API REST, SPA, base de datos y configuración de despliegue de este repositorio.
- Queda fuera el entorno del proveedor de infraestructura, la red y los servicios
  externos (SMS/correo) que no forman parte del código.

## Controles implementados en esta versión

- Autenticación con bcrypt (coste 12) y JWT de 2 h con emisor/audiencia fijos.
- Sesión en cookie `HttpOnly`, `Secure` en producción y `SameSite=Strict`.
- Cambio de contraseña obligatorio en el primer ingreso.
- Bloqueo por cuenta e IP+usuario ante intentos fallidos.
- Autorización por rol y aislamiento por cliente en el portal.
- Consultas parametrizadas en todo el backend.
- Auditoría con IP y user-agent, de solo inserción para la aplicación.
- Base de datos sin puertos publicados y con rol de aplicación sin DDL.
- TLS, HSTS, CSP y cabeceras anti-clickjacking en el proxy.
- Respaldos documentados y verificables.

## Riesgos residuales conocidos

- No hay MFA: se compensa con contraseñas de 12+, bloqueo y cambio obligatorio.
- El modo demostración del OTP solo puede activarse fuera de producción.
- La aplicación no implementa facturación electrónica DIAN.

El estado detallado está en `documentacion/04-seguridad/04-Estado-de-Remediacion.md`.
