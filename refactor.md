# Plan de refactor de FINAN-X

> **Versión evaluada:** 1.0.0 (commit `3c8d25d`)
> **Fecha:** 4 de noviembre de 2026
> **Estado:** propuesta. **No se ha ejecutado ningún cambio de código.**
> **Alcance:** backend Node.js/Express, frontend React, PostgreSQL y operación.
> **Objetivo:** reducir la deuda técnica prioritaria sin reescribir la aplicación.

---

## 0. Resumen ejecutivo

FINAN-X es un **monolito Express de tres capas** (rutas → SQL → PostgreSQL) con un frontend React que llama directamente a la API. Está bien organizado, es legible y la seguridad es su punto más fuerte. La deuda no es grave, pero hay tres zonas frágiles:

1. **El dinero** se calcula con `Number` y `round2`, sin pruebas unitarias.
2. **Los pagos** están implementados dos veces (caja y portal).
3. **La factura emitida** no es inmutable ni guarda una foto fiscal del cliente.

Este plan ordena el trabajo en **8 fases**, de la más rentable a la más estructural. Cada fase es independiente y deja el sistema funcionando. **No se reescribe nada**: se extrae, se prueba y se sustituye por partes (patrón *strangler*).

**Duración estimada:** 8 a 10 semanas con un desarrollador; varias fases pueden solaparse.

---

## 1. Diagnóstico de partida

| Dimensión | Nota | Evidencia |
|---|---|---|
| Legibilidad | 7/10 | Nombres claros, comentarios útiles, formato consistente |
| Separación de responsabilidades | 5/10 | ~176 consultas SQL dentro de `routes/`; sin `services/` ni `repositories/` |
| Mantenibilidad | 6/10 | Se entiende, pero sin lint, CI ni tests unitarios |
| Testabilidad | 4/10 | Solo e2e (157 comprobaciones); cálculo de dinero sin unit tests |
| Escalabilidad | 5/10 | Una instancia, límites en memoria, `LIMIT 300` fijo, sin cola ni caché |
| Seguridad | 8/10 | Cookie HttpOnly, roles, auditoría, TLS, puertos cerrados |
| Documentación | 8/10 | Completa; admite que la arquitectura real es de 3 capas |

**Deudas concretas:** `auth.js` con 513 líneas y 29 consultas; lógica de pago duplicada entre `pagos.js` y `mis.js`; validación de usuario repetida en tres sitios; `enmascarar()` sin uso; 10 listados con `LIMIT 300`; PDF generado con `window.print()`; sin migraciones automáticas; sin monitoreo.

---

## 2. Principios del refactor

1. **Primero la red, después el salto.** No se mueve una línea de dinero sin pruebas que capturen el comportamiento actual.
2. **Una regla, un solo sitio.** Si una regla está dos veces, se extrae antes de cambiarla.
3. **Cambios pequeños y reversibles.** Cada fase deja `main` desplegable.
4. **Strangler:** el código nuevo envuelve al viejo; cuando las pruebas pasan, se elimina el viejo.
5. **No reescribir, no microservicios, no moda.** El monolito es adecuado para el tamaño del producto.
6. **La API no se rompe sin versión.** Los cambios de contrato pasan por `/api/v2` o por compatibilidad temporal.

---

## 3. Fases

### Fase 0 · Preparación y red de seguridad (3–5 días)

**Objetivo:** que cualquier cambio futuro pase por un filtro automático antes de fusionarse.

**Cambios**
- ESLint 9 (flat config) + Prettier para backend y frontend; scripts `lint`, `format`, `format:check`.
- CI en GitHub Actions: Node 22, PostgreSQL 16 como servicio, `npm ci`, lint, build del frontend y suite e2e en modo demostración.
- Medición base: cobertura (`c8`), duplicación (`jscpd`) y tamaño del bundle.
- Regla de ramas: `main` protegida, PR obligatorio, CI verde para fusionar.

**Qué se espera**
- Un solo estilo de código y discusiones de formato eliminadas.
- Regresiones detectadas **antes** de fusionar, no en producción.
- Una línea base numérica para demostrar la mejora de las fases siguientes.

**Criterio de salida:** CI verde en `main`, `lint` sin errores, baseline documentado.

**Riesgo:** la suite e2e necesita PostgreSQL y modo demo. Mitigación: servicio de Postgres en el workflow y variables de entorno del job.

---

### Fase 1 · Dinero exacto y pruebas unitarias (1–2 semanas)

**Objetivo:** eliminar la posibilidad de errores de centavos y de IVA.

**Cambios**
- Nuevo `backend/src/domain/dinero.js`: trabajar en **centavos enteros** (o `decimal.js`) con `sumar`, `multiplicar`, `porcentaje`, `redondear`, `formatear` y una política única de redondeo (medio hacia arriba).
- Sustituir `Number` + `round2` en pedidos, facturas, pagos, notas de crédito y dashboard.
- Mantener `NUMERIC(14,2)` en PostgreSQL y dejar de convertir a `float8` en las respuestas financieras; serializar con dos decimales.
- Pruebas unitarias y de propiedad con vectores: `1,005`, `333,33×3`, `10,05×19 %`, IVA mixto 19 %/0 %, cantidades decimales, totales grandes.
- Documentar la política: IVA por línea y suma, o IVA sobre el total (decidir y no cambiar).

**Qué se espera**
- **Cero deriva de centavos** entre lo calculado, lo guardado y lo impreso.
- Una sola política de redondeo en todo el sistema.
- Cobertura del dominio de dinero **≥ 90 %** y pruebas que fallen si alguien vuelve a usar `Number` para importes.

**Criterio de salida:** todas las rutas de dinero usan el módulo; las pruebas de propiedad pasan; la política está documentada.

**Riesgo:** cambio de contrato en la API. Mitigación: mantener números JSON con dos decimales y añadir pruebas de contrato antes de cambiar el formato.

---

### Fase 2 · Servicios y repositorios (2–3 semanas)

**Objetivo:** sacar la lógica de negocio de las rutas y eliminar la duplicación.

**Cambios**
- `services/pagoService.js`: **una sola** implementación de registrar pago, usada por `/pagos` y `/mis-pagos`.
- `services/facturaService.js` (emitir, anular), `services/notaService.js`, `services/clienteService.js`.
- `repositories/` para facturas, pagos y notas: SQL parametrizado, sin lógica de negocio.
- Helper `withTransaction()` para no repetir `BEGIN/COMMIT/ROLLBACK`.
- Dividir `routes/auth.js` en login, registro, OTP y cambio de clave.
- Las rutas quedan como: validar → llamar al servicio → responder.

**Qué se espera**
- La regla de pagos existe **en un solo lugar**; un cambio se hace una vez.
- Rutas de **menos de 150 líneas**, fáciles de leer.
- Servicios testeables con un repositorio falso, sin levantar PostgreSQL.
- Menos probabilidad de que caja y portal se comporten distinto.

**Criterio de salida:** no queda lógica de pago duplicada; pruebas de servicio con repositorio falso; cobertura de servicios ≥ 70 %.

**Riesgo:** cambiar comportamiento sin darse cuenta. Mitigación: pruebas de caracterización que congelen las respuestas actuales antes de mover código.

---

### Fase 3 · Integridad histórica y numeración (1–2 semanas)

**Objetivo:** que una factura emitida sea inmutable y que la numeración sea auditable.

**Cambios**
- Añadir a `facturas` la **foto fiscal** del cliente y del emisor (razón social, NIT, dirección, régimen) y rellenarla al emitir.
- Trigger que solo permita `ACTIVA → ANULADA` y bloquee cambios en importes, número, cliente y fechas; prohibir `DELETE`.
- Tabla de **resoluciones** (prefijo, rango, vigencia) y secuencia por resolución; política de huecos documentada.
- Runner de migraciones con tabla `_migraciones`; eliminar la aplicación manual de `.sql`.
- Backfill de facturas existentes.

**Qué se espera**
- Editar un cliente **ya no cambia** sus facturas anteriores.
- Ninguna vía (ni un error de código) puede alterar el total de una factura emitida.
- Numeración correlativa por resolución, con evidencia para una auditoría.
- Esquema reproducible en cualquier entorno con un comando.

**Criterio de salida:** pruebas del trigger, prueba de concurrencia de numeración, migración arriba/abajo y documentación actualizada.

**Riesgo:** datos existentes inconsistentes. Mitigación: backfill idempotente y respaldo previo obligatorio.

---

### Fase 4 · Contratos de API y datos (1–2 semanas)

**Objetivo:** que la API sea predecible, paginada y segura ante reintentos.

**Cambios**
- Paginación real (`limit`/`offset`, máximo 100, cabecera `X-Total-Count`) en todos los listados; eliminar `LIMIT 300`.
- OpenAPI 3 versionado y validación en CI.
- Validación de entrada centralizada (zod) compartida por rutas.
- **Idempotencia** en facturación y pagos: tabla de claves y middleware; el mismo `Idempotency-Key` devuelve la misma respuesta.

**Qué se espera**
- Contratos estables y documentados; integraciones que no se rompen por sorpresa.
- Reintentos de red seguros: no se duplica una factura ni un pago.
- Listados que aguantan volumen sin devolver 300 filas fijas.

**Criterio de salida:** OpenAPI valida en CI; prueba de doble POST con la misma clave; prueba de carga con 50 usuarios y p95 < 1 s.

**Riesgo:** romper el frontend. Mitigación: versión `/api/v2` o compatibilidad temporal con pruebas de contrato.

---

### Fase 5 · Frontend mantenible (2 semanas)

**Objetivo:** que las pantallas dejen de mezclar llamadas, estado y presentación.

**Cambios**
- Capa `services/api/*` por dominio y hooks (`useApi`, `usePaginacion`, `useFacturas`).
- Opcional recomendado: TanStack Query para caché y estados de carga/error.
- Dividir `Dashboard.jsx` (333 líneas), `Login.jsx` (305) y `FacturaDetalle.jsx` (296) en componentes.
- Validación de formularios, `ErrorBoundary`, estados vacíos/carga consistentes, accesibilidad y responsive.
- Pruebas de componente (Vitest + Testing Library) para formato de dinero, formularios y tabla.

**Qué se espera**
- Páginas de **menos de 150 líneas**, con responsabilidad única.
- Estados de carga y error iguales en toda la aplicación.
- Accesibilidad mínima (etiquetas, foco, contraste) y uso en móvil.
- Menos bugs de estado y de doble envío.

**Criterio de salida:** cobertura de componentes ≥ 50 %, Lighthouse de accesibilidad ≥ 90, sin `useEffect` duplicados.

**Riesgo:** regresiones visuales. Mitigación: pruebas de componente y revisión con capturas.

---

### Fase 6 · Operación y observabilidad (1–2 semanas)

**Objetivo:** enterarse de los fallos antes que el cliente.

**Cambios**
- Logging estructurado (`pino`) con `request-id` y sin datos sensibles.
- Sentry (o OpenTelemetry) para errores; endpoint `/metrics` y alertas (5xx, latencia, conexiones, disco).
- Respaldos automáticos + WAL/PITR + **prueba de restauración** programada.
- Gestor de secretos y rotación.
- CI/CD de despliegue con migraciones, smoke test y rollback.

**Qué se espera**
- Detección de incidentes en **menos de 5 minutos**.
- RPO ≤ 15 min y RTO ≤ 4 h con restauración probada.
- Despliegues repetibles y reversibles.

**Criterio de salida:** alerta de prueba disparada, restauración documentada, rollback probado.

**Riesgo:** costo y complejidad operativa. Mitigación: empezar con Sentry + UptimeRobot + respaldo diario, y crecer después.

---

### Fase 7 · Documentación viva (continuo)

**Objetivo:** que las decisiones no se pierdan y que la documentación diga la verdad.

**Cambios**
- ADRs: dinero, numeración, inmutabilidad, capas.
- Corregir la descripción “hexagonal” a la arquitectura real de 3 capas.
- OpenAPI, runbooks de incidentes y de respaldo.
- Mantener `CHANGELOG` y `SHA256SUMS`.

**Qué se espera**
- Onboarding más rápido y decisiones trazables.
- Menos discusiones repetidas sobre por qué algo está así.

**Criterio de salida:** cada decisión estructural tiene un ADR y el índice está actualizado.

---

## 4. Prioridad y cronograma

| Semana | Fase | Entregable |
|---|---|---|
| 1 | F0 | Lint, Prettier, CI y baseline |
| 2–3 | F1 | Módulo de dinero + pruebas |
| 3–5 | F2 | Servicios de pagos/facturas y rutas delgadas |
| 6–7 | F3 | Inmutabilidad, numeración y migraciones |
| 7–8 | F4 | Paginación, OpenAPI e idempotencia |
| 8–9 | F5 | Frontend por componentes |
| 9–10 | F6 | Monitoreo, respaldos y CI/CD |
| Continuo | F7 | ADRs y documentación |

**Orden por retorno:** F1 y F0 primero (máximo riesgo/beneficio), luego F2 (duplicación), después F3 (cumplimiento), F4/F5/F6 según el negocio.

---

## 5. Métricas de éxito

| Métrica | Objetivo |
|---|---|
| Cobertura backend | ≥ 70 % (dominio de dinero ≥ 90 %) |
| Cobertura frontend | ≥ 50 % en componentes críticos |
| Duplicación | < 3 % |
| Defectos de dinero en producción | 0 |
| p95 de la API con 50 usuarios | < 500 ms |
| Tiempo de CI | < 10 min |
| Migraciones aplicadas a mano | 0 |
| MTTR | < 30 min |
| Restauración de respaldo | Probada y documentada |

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El refactor cambia comportamiento | Pruebas de caracterización antes de mover código |
| Se rompe la API para el frontend | Compatibilidad temporal o `/api/v2` |
| La fase se alarga | Cada fase es independiente; se puede parar al final de cualquiera |
| Se pierde conocimiento | ADRs, pair review y pruebas como documentación |
| Datos históricos inconsistentes | Respaldo + backfill idempotente + validación |
| Tentación de reescribir | Regla explícita: no reescritura ni microservicios |

---

## 7. Qué NO se hará

- Reescribir el backend desde cero.
- Pasar a microservicios.
- Migrar todo a TypeScript de golpe (se puede hacer por módulos, más adelante).
- Introducir un framework de inyección de dependencias.
- Cambiar la UI por moda.
- Ejecutar este plan dentro de la entrega académica.

---

## 8. Definición de terminado

Una fase se considera terminada cuando:

1. El código nuevo está en `main` y el viejo se eliminó.
2. Las pruebas nuevas pasan y cubren la regla movida.
3. La documentación y el `CHANGELOG` están actualizados.
4. No hay regresiones en la suite e2e.
5. El sistema sigue desplegable al final de la fase.

---

## 9. Primeros tres pasos (cuando se apruebe ejecutar)

1. Crear la configuración de ESLint/Prettier y el workflow de CI (Fase 0).
2. Escribir las pruebas de caracterización de IVA, redondeo y pagos con los vectores de la Fase 1.
3. Crear `domain/dinero.js` y migrar primero **pedidos**, que es donde nace el cálculo.

> Este documento es un plan. No se ha modificado código de la aplicación para elaborarlo.
