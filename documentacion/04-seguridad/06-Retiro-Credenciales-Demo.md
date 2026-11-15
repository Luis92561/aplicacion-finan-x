# Retiro de las credenciales de demostración

> **Versión:** 1.0.1 · **Fecha:** noviembre de 2026
> **Estado:** aplicado y verificado. Deja sin efecto cualquier credencial que aparezca en
> documentos históricos del proyecto.

## 1. Por qué existe este documento

Antes de la versión 1.0.0 la aplicación se podía abrir con un usuario y una contraseña fijos
que estaban escritos en la propia pantalla de ingreso y que se recreaban en cada arranque del
contenedor. Eso permitía entrar como **administrador** a cualquiera que alcanzara el puerto
8080. Para la entrega final ese mecanismo se eliminó y se reemplazó por un **flujo de primer
ingreso con claves temporales**.

Este documento deja constancia de qué existía, por qué se retiró y cómo se ingresa hoy, para
que la decisión quede trazable sin necesidad de conservar las credenciales.

## 2. Situación anterior

| Aspecto | Antes (≤ 0.9) |
|---|---|
| Cuentas | El *seed* de demostración se ejecutaba en cada arranque y creaba un administrador con contraseña fija. |
| Interfaz | La pantalla de ingreso mostraba esas credenciales como ayuda. |
| Riesgo | Acceso administrativo sin autenticación real: hallazgo **C-01** del informe de auditoría. |
| Documentación | Las especificaciones reproducían las credenciales para facilitar las pruebas. |

Los valores concretos no se reproducen aquí. Cualquier documento, captura o comentario que
todavía los mostrara se considera **histórico** y fue redactado en la versión 1.0.1.

## 3. Qué se cambió

- Se eliminó el bloque de credenciales de `frontend/src/pages/Login.jsx`.
- El *seed* dejó de ejecutarse en el arranque: `SEED_DEMO=false` por defecto y se rechaza en
  producción.
- El ingreso pasó a un **primer ingreso obligatorio**: las cuentas se crean una sola vez con
  `npm run init:usuarios` (o el lanzador del paquete), con contraseñas temporales aleatorias
  que se entregan en el acta, y `debe_cambiar_clave = true`.
- Mientras no se cambie la contraseña, la API solo permite `/auth/sesion`,
  `/auth/cambiar-clave` y `/auth/logout`; el resto responde `403 CAMBIO_CLAVE_REQUERIDO`.
- Política de contraseñas: mínimo **12 caracteres**, lista de contraseñas comunes, sin datos
  personales y bcrypt con coste 12.
- El autoregistro de clientes (`REGISTRO_ABIERTO`) es una decisión explícita por entorno:
  `off` por defecto en el repositorio y en producción; el paquete de demostración lo habilita.

## 4. Qué queda hoy

- El *seed* de demostración sobrevive **solo** como utilidad de desarrollo y pruebas
  (`npm run seed:demo`, `SEED_DEMO=true`). No se ejecuta en la entrega ni en un despliegue real.
- Ningún documento vigente contiene credenciales. El informe de auditoría cita el hallazgo con
  los valores redactados, porque son la evidencia del problema que se corrigió.
- La comprobación correspondiente está en `03-operacion/CHECKLIST-DESPLIEGUE.md`.

## 5. Cómo se ingresa ahora

1. En el primer arranque, el lanzador del paquete (o `npm run init:usuarios`) genera claves
   temporales aleatorias y las deja en el acta de `primer-ingreso/`.
2. Cada cuenta debe cambiar la contraseña antes de usar el sistema.
3. Un **ADMIN** puede restablecer claves desde **Usuarios → Restablecer clave**.
4. Un cliente nuevo puede crear su cuenta desde **Crear cuenta** en el portal cuando el
   autoregistro está habilitado.

## 6. Regla de mantenimiento

- Ningún documento, captura ni mensaje de la interfaz puede incluir contraseñas, ni siquiera de
  demostración.
- Las evidencias históricas se citan siempre redactadas y con referencia a este documento.
- Si se agrega un entorno de demostración nuevo, sus claves se generan en tiempo de ejecución
  y se entregan por el acta; nunca se versionan.

## 7. Referencias

- `04-seguridad/01-Informe-Auditoria-Seguridad-FINAN-X.md` — hallazgo C-01 y su análisis.
- `04-seguridad/04-Estado-de-Remediacion.md` — corrección y verificación.
- `03-operacion/CHECKLIST-DESPLIEGUE.md` — verificación antes de publicar.
- `02-tecnica/SPEC_Funcional.md` §Cuentas iniciales — flujo vigente de alta de usuarios.
