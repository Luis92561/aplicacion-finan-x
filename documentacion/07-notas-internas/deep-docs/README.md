# 📁 deep-docs — Notas de reconocimiento de FINAN-X

> **Notas internas del proyecto.** No forman parte del código de la aplicación.
> Contiene notas de familiarización para recordar cómo funciona el proyecto.

> ✅ **Estado:** corregidos y verificados el **bug crítico del saldo** (producto cartesiano en
> `factura_saldo`), **todos los hallazgos de severidad Alta y Media**, y **los pendientes C4**
> (refacturación tras anular) **y M12** (pagador del portal). La suite e2e pasó de **99 a 154
> comprobaciones**, todas en verde contra PostgreSQL 16 real.
> Ver [`10-MEJORAS-APLICADAS.md`](10-MEJORAS-APLICADAS.md).
> Lo único que queda es **M13**, que es una observación sobre cómo se describe la arquitectura en la
> documentación, no un defecto del código.

---

## Qué es esta carpeta

Revisé el código y la documentación de FINAN-X y aquí dejé mis notas de trabajo. Las correcciones del
bug de saldo (C1, C2, C3) las apliqué después y quedaron aisladas en un único commit (`5877ef8`).

## Índice de notas

| Archivo | Qué contiene | Cuándo leerlo |
|---|---|---|
| [`01-VISION-GENERAL.md`](01-VISION-GENERAL.md) | Qué es FINAN-X, para qué sirve, actores y roles, alcance real. | Primero. Para entender el *qué*. |
| [`02-ARQUITECTURA.md`](02-ARQUITECTURA.md) | Arquitectura hexagonal, mapa de carpetas, los 3 servicios, puertos, proxy, cómo se conecta todo. | Para entender el *cómo está armado*. |
| [`03-BASE-DE-DATOS.md`](03-BASE-DE-DATOS.md) | Las 11 tablas, la vista `factura_saldo`, índices, migraciones, y las reglas que viven en el SQL. | Antes de tocar consultas o modelos. |
| [`04-API-REST.md`](04-API-REST.md) | Todos los endpoints por módulo, roles permitidos, qué valida cada uno. | Para consumir o extender la API. |
| [`05-REGLAS-DE-NEGOCIO.md`](05-REGLAS-DE-NEGOCIO.md) | Las invariantes del negocio (sin sobrepago, anulación lógica, 1 pedido → 1 factura…) y dónde se aplican. | **El documento más importante para no romper nada.** |
| [`06-FRONTEND.md`](06-FRONTEND.md) | Rutas de la SPA, guardas de acceso, páginas, cliente HTTP, sistema visual. | Para trabajar en la interfaz. |
| [`07-LEVANTAR-Y-PROBAR.md`](07-LEVANTAR-Y-PROBAR.md) | Cómo arrancar (Docker y modo dev), cuentas iniciales, suite e2e, solución de problemas. | Cuando quieras ejecutarlo. |
| [`08-ESTADO-GIT-Y-GITHUB.md`](08-ESTADO-GIT-Y-GITHUB.md) | **Estado del control de versiones y conexión con GitHub.** | Si la pregunta es "¿está subido a algún lado?". |
| [`09-OBSERVACIONES-Y-RIESGOS.md`](09-OBSERVACIONES-Y-RIESGOS.md) | Cosas que noté: deuda técnica, pendientes declarados, detalles a revisar. | Antes de planear cambios. |
| [`10-MEJORAS-APLICADAS.md`](10-MEJORAS-APLICADAS.md) | **Segunda revisión: qué se corrigió, por qué y cómo** (A1–A7, M1–M11, limpieza), con la verificación de cada punto. | Si quieres saber qué cambió y por qué. |

## Resumen en 10 líneas

FINAN-X es una **aplicación web de facturación y pagos** (no es un ERP completo). Un cliente pide
productos → se crea un **pedido** (BORRADOR → CONFIRMADO) → se genera una **factura** → se registran
**pagos** parciales o totales → y si hay devoluciones se emiten **notas de crédito**. Tiene dos caras:
un **panel interno** para 4 roles (Administrador, Facturador, Cajero, Supervisor) y un **portal del
cliente** aislado por `clienteId` del token. Stack: **React 18 + Vite** (frontend), **Node.js +
Express** (API REST), **PostgreSQL 16** (datos), todo orquestado con **Docker Compose**. Sin ORM:
SQL parametrizado directo con `pg`. Autenticación **JWT** (8 h) + **bcrypt**; autorización por rol
(RBAC) en cada ruta. El saldo de una factura **nunca se almacena**: se calcula en la vista
`factura_saldo`. Tiene una suite **e2e de 99 casos** (`backend/scripts/e2e.mjs`).

## Aviso

Son **mis notas de trabajo**: recogen lo que entendí del código en el momento de la revisión. Si el
código cambia, pueden quedar desactualizadas; las fuentes autoritativas siguen siendo el código y
`documentacion/` del proyecto.

---

*Notas de reconocimiento del proyecto FINAN-X.*
