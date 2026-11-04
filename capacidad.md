# Plan de capacidad de FINAN-X

> **Documento de referencia para futuras actualizaciones por crecimiento.**
> **Versión evaluada:** 1.0.0 · **Fecha:** 4 de noviembre de 2026
> **Estado:** guía de planificación. **No se ha modificado código, configuración ni base de datos.**
> **Cubre dos escenarios:** (A) 600–1.000 clientes de una sola empresa y (B) 600–1.000 empresas usando FINAN-X como SaaS.

---

## 0. Cómo usar este documento

1. Identifica en qué escenario estás (sección 1).
2. Mide los indicadores de la sección 5 y compáralos con los umbrales.
3. Aplica la fase correspondiente del escenario A o B.
4. Revisa este documento cada trimestre o cuando se cruce un umbral.
5. Ninguna fase se ejecuta sin aprobación: aquí solo se documenta el qué, el porqué y el cuándo.

---

## 1. Supuestos y definiciones

| Término | Significado en este documento |
|---|---|
| **Cliente** | Persona o empresa a la que se le factura (tabla `clientes`). |
| **Empresa / tenant** | Negocio que usa FINAN-X para facturar a sus propios clientes (SaaS). |
| **Escenario A** | Una sola empresa facturadora con 600–1.000 clientes. |
| **Escenario B** | 600–1.000 empresas (tenants), cada una con sus clientes. |

**Supuestos del escenario A:** 600–1.000 clientes, ~3 facturas por cliente/mes, 20–50 usuarios internos, hasta 50 clientes en el portal al mismo tiempo, retención de 5 años.

**Supuestos del escenario B:** 600–1.000 empresas, 20–50 clientes por empresa, 1–2 facturas por cliente/mes, 300–500 usuarios concurrentes en horas pico, mismos 5 años de retención.

**Objetivos de servicio (SLO)**

| Métrica | Escenario A | Escenario B |
|---|---|---|
| p95 listados | < 300 ms | < 400 ms |
| p95 dashboard | < 1 s | < 1,5 s |
| p95 crear factura / pagar | < 500 ms | < 700 ms |
| Errores con carga objetivo | < 0,5 % | < 0,5 % |
| Disponibilidad mensual | ≥ 99,5 % | ≥ 99,9 % |
| RPO / RTO | ≤ 15 min / ≤ 4 h | ≤ 5 min / ≤ 1 h |

---

## 2. Diagnóstico actual (por qué hoy no aguanta)

| # | Cuello de botella | Consecuencia al crecer | Evidencia |
|---|---|---|---|
| 1 | Listados con `LIMIT 300` fijo y sin paginación | Con 1.000 clientes o 36.000 facturas, la información deja de ser visible y la búsqueda no alcanza | 10 consultas con `LIMIT 300` en `backend/src/routes/` |
| 2 | La vista `factura_saldo` agrega **todos** los pagos y notas de la tabla antes de filtrar | Cada lista de facturas, el dashboard y el balance cuestan más a medida que crece el historial | `database/init.sql:224-234` |
| 3 | El dashboard agrupa con `date_trunc('month', fecha)` sobre la columna | Impide usar el índice de fecha: hace 12 escaneos completos por carga | `routes/dashboard.js:93-97` |
| 4 | `balance-clientes` agrega todos los clientes y devuelve la lista completa | La pantalla de cartera se vuelve lenta con 1.000 clientes y años de facturas | `routes/reportes.js:82-113` |
| 5 | Una sola instancia del backend y pool de 10 conexiones | Sin failover; la concurrencia queda limitada por 10 conexiones | `db.js` (`max: 10`), `docker-compose.yml` |
| 6 | Rate limit en memoria | Con dos réplicas cada una cuenta distinto; una oficina con IP compartida puede bloquearse | `middleware/rateLimit.js` |
| 7 | Respaldos manuales y sin monitoreo | A este volumen, una pérdida de datos es irreversible | `scripts/respaldo.sh` |
| 8 | Auditoría sin retención ni partición | Crece indefinidamente y compite por espacio y consultas | `database/init.sql` (tabla `auditoria`) |

**Conclusión del diagnóstico:** con 1.000 clientes la base de datos sigue siendo pequeña (2–4 GB en 5 años). Lo que se rompe es **la forma de consultar, la concurrencia y la operación**, no PostgreSQL.

---

# Escenario A · 600–1.000 clientes de una empresa

## A.1 Volumen estimado

| Concepto | 600 clientes | 1.000 clientes |
|---|---|---|
| Facturas/mes (3 por cliente) | 1.800 | 3.000 |
| Facturas/año | 21.600 | 36.000 |
| Facturas a 5 años | 108.000 | 180.000 |
| Pagos a 5 años | ~108.000 | ~180.000 |
| Filas de auditoría a 5 años | 0,5–1 M | 1–2 M |
| Tamaño estimado de base | 1,5–2,5 GB | 2–4 GB |

## A.2 Qué se rompe primero

1. La lista de clientes/facturas deja de mostrar todo (límite 300).
2. El balance de clientes y el dashboard se vuelven lentos con el historial.
3. Dos usuarios concurrentes empiezan a notar el pool de 10 conexiones.
4. Un fallo del host deja el sistema caído sin respaldo reciente.

## A.3 Cambios necesarios

### Base de datos
- `CREATE EXTENSION pg_trgm` e índices GIN en `clientes.nombre_razon_social`, `clientes.numero_identificacion` y `facturas.numero_factura`.
- Índices compuestos: `facturas (cliente_id, fecha_emision DESC)`, `pagos (factura_id, fecha DESC)`, `notas_credito (factura_id, estado)`, `pedidos (cliente_id, fecha DESC)`.
- Reescribir `factura_saldo` con `LEFT JOIN LATERAL` por factura (usa `idx_pagos_factura` y `idx_notas_credito_factura`) o, si no alcanza, columnas `valor_pagado`/`notas_credito` mantenidas por trigger.
- Particionar o archivar `auditoria` por mes, retención 24–36 meses.
- Migración `database/migracion_escala.sql` idempotente y con índices `CONCURRENTLY`.

### Backend
- Helper de paginación (`limit` máximo 100, `offset`, `X-Total-Count`) en clientes, facturas, pagos, pedidos, notas, auditoría y balance.
- Dashboard con rangos (`>= mes AND < mes + 1 month`) en vez de `date_trunc`.
- `balance-clientes`: resumen en una consulta y detalle paginado, sin `COUNT` correlacionado por cliente.
- Pool de 20–30 conexiones, `statement_timeout` y `idle_in_transaction_session_timeout`.
- Dos réplicas detrás de nginx, *graceful shutdown* y healthchecks.
- Redis para rate limit compartido, caché de dashboard (30–60 s) e idempotencia de facturas/pagos; si Redis cae, degradar a memoria y sin caché.

### Frontend
- Paginación y búsqueda en servidor; eliminar la suposición de 300 filas.
- *Debounce* de 300 ms en búsquedas y filtros reflejados en la URL.
- Caché de consultas (TanStack Query o equivalente) y estados de carga/error uniformes.

### Operación
- PostgreSQL gestionado o propio con respaldo diario + WAL/PITR.
- `pg_stat_statements`, *slow query log*, Sentry, métricas y alertas (5xx, p95, pool, disco, respaldo).
- Límites de CPU/RAM y revisión mensual de crecimiento.

## A.4 Fases

| Fase | Duración | Resultado esperado | Criterio de salida |
|---|---|---|---|
| A1 · Paginación e índices | 1 semana | Listados completos y rápidos; dashboard con índices | 1.000 clientes y 100.000 facturas sembradas; p95 < 300 ms; `EXPLAIN` sin *seq scan* |
| A2 · Vista y balance | 1 semana | Coste por página, no por historial | p95 de facturas y balance < 300 ms con 180.000 facturas |
| A3 · Concurrencia | 1 semana | 100 usuarios concurrentes sin 429 ni saturación | k6 100 VU: error < 0,5 %; matar una réplica y seguir |
| A4 · Operación | 1 semana | Detección y recuperación | Restauración documentada; alerta de prueba |
| A5 · Carga y ajuste | 1 semana | Evidencia y margen 2× | Informe k6 + `pg_stat_statements` + SLO cumplidos |

**Total: 5–6 semanas.**

## A.5 Dimensionamiento

| Componente | Recomendación |
|---|---|
| PostgreSQL | 2 vCPU, 4–8 GB RAM, NVMe; 2–4 GB de datos |
| Backend | 2 réplicas × 1 vCPU / 1 GB; pool 20–30 |
| Redis | 256 MB |
| nginx | 1 vCPU / 512 MB |
| Respaldos | Diario + WAL cada 5–15 min; retención 30–90 días |

## A.6 Casos límite

- Pico de fin de mes (10× facturación).
- 50 pagos simultáneos desde el portal (`FOR UPDATE` ya protege el saldo).
- Redis caído, una réplica caída, pool agotado.
- Restauración de respaldo y *failover*.

---

# Escenario B · 600–1.000 empresas (SaaS multiempresa)

## B.1 Volumen estimado

| Concepto | 600 empresas | 1.000 empresas |
|---|---|---|
| Clientes finales (30 por empresa) | 18.000 | 30.000 |
| Facturas/mes (2 por cliente) | 36.000 | 60.000 |
| Facturas/año | 432.000 | 720.000 |
| Facturas a 5 años | 2,1 M | 3,6 M |
| Tamaño estimado de base | 40–80 GB | 80–150 GB |

> A este volumen, la conversación deja de ser “optimizar consultas” y pasa a ser **aislamiento entre empresas, particionado y operación multi-tenant**.

## B.2 Qué cambia respecto al escenario A

1. **Todas las tablas de negocio necesitan `empresa_id`** y un mecanismo de aislamiento.
2. **La numeración de facturas es por empresa** (cada una con su resolución y consecutivo).
3. **Los usuarios y roles pertenecen a una empresa**; el soporte necesita suplantación auditada.
4. **Cada empresa tiene plan, cuotas y facturación** (FINAN-X cobra a sus tenants).
5. **Operación:** métricas por empresa, exportación/borrado de datos por empresa y migraciones sin ventana.

## B.3 Modelo de datos multi-tenant

- Nueva tabla `empresas` (id, NIT, razón social, plan, estado, configuración fiscal).
- `empresa_id` en `clientes`, `productos`, `pedidos`, `facturas`, `pagos`, `notas_credito`, `usuarios`, `usuario_cliente`, `auditoria`, `resoluciones`.
- **Clave foránea compuesta** donde aplique (`empresa_id, cliente_id`) para impedir cruces.
- **Row-Level Security (RLS)** en PostgreSQL: cada sesión fija `app.empresa_id`; las políticas filtran por empresa.
- Numeración: tabla `resoluciones` por empresa y secuencia por resolución.
- Auditoría con `empresa_id` y consultas siempre filtradas.

**Estrategia recomendada:** esquema compartido + `empresa_id` + RLS hasta 1.000 empresas. Si aparece un *noisy neighbor* o una empresa muy grande, pasar a **particionado por hash de `empresa_id`** o a **base por grupo de empresas** (*sharding*).

## B.4 Aislamiento y seguridad

- El JWT incluye `empresaId`; el middleware lo valida contra el usuario y fija `app.empresa_id`.
- Prohibido aceptar `empresa_id` desde el body o query: siempre del token.
- Pruebas automáticas de **acceso cruzado** (empresa A intenta leer/escribir datos de B → 404/403).
- Suplantación de soporte: token temporal, motivo, auditoría y expiración.
- Exportación y borrado por empresa (Ley 1581), con respaldo previo.

## B.5 Onboarding, planes y cuotas

- Registro de empresa con verificación de NIT/correo y aceptación de términos.
- Planes: límite de usuarios, clientes, facturas/mes y almacenamiento.
- Medición de consumo por empresa y facturación del SaaS (Stripe/Wompi u otro).
- Bloqueo suave al superar cuota (avisos) y duro (solo lectura) según plan.
- Panel de administración de plataforma separado del panel de cada empresa.

## B.6 Rendimiento y escala

- Índices compuestos que empiecen por `empresa_id` en las tablas grandes.
- Particionado por rango de fecha en `facturas`, `pagos` y `auditoria`; evaluación de partición por hash de `empresa_id`.
- PgBouncer delante de PostgreSQL; pool por réplica 20–30.
- Réplica de lectura para reportes y dashboard.
- Caché por empresa (clave `empresaId:reporte:periodo`), invalidación por evento.
- Límites de tasa **por empresa** además de por IP.
- Consultas lentas: `statement_timeout` por transacción y *slow query log*.

## B.7 Operación

- Migraciones una sola vez (esquema compartido) y *backfill* por lotes.
- Observabilidad con etiqueta `empresa_id` (sin exponer datos personales).
- Respaldos compartidos + exportación por empresa.
- Coste por empresa (almacenamiento, facturas, consultas) para pricing.
- Runbook de incidentes con impacto por empresa.

## B.8 Fases

| Fase | Duración | Resultado esperado | Criterio de salida |
|---|---|---|---|
| B1 · Multi-tenancy base | 3–4 semanas | `empresa_id`, RLS, auth con empresa, numeración por empresa | Pruebas de aislamiento A↔B en verde |
| B2 · Onboarding y planes | 2 semanas | Registro de empresas, cuotas y facturación SaaS | Alta de empresa y cobro de prueba |
| B3 · Escala de datos | 3–4 semanas | Particionado, PgBouncer, réplica de lectura, caché por empresa | 1.000 empresas simuladas; p95 < 400 ms |
| B4 · Operación y seguridad | 2 semanas | Exportación/borrado, suplantación auditada, métricas por empresa | Auditoría y pruebas de fuga en verde |

**Total: 10–12 semanas adicionales al escenario A.**

## B.9 Dimensionamiento estimado

| Componente | Recomendación |
|---|---|
| PostgreSQL | 8–16 vCPU, 32–64 GB RAM, NVMe; 100–150 GB |
| PgBouncer | 2 instancias pequeñas |
| Backend | 4–6 réplicas × 2 vCPU / 2 GB |
| Redis | 2–4 GB (caché, rate limit, idempotencia) |
| Réplica de lectura | 1 (reportes) |
| Respaldos | PITR + retención 90 días + copia externa |

## B.10 Riesgos específicos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Fuga de datos entre empresas | Crítico | RLS + `empresa_id` obligatorio + pruebas de acceso cruzado |
| Migración con 1.000 empresas | Alto | Migraciones por lotes, ventana y respaldo |
| *Noisy neighbor* | Alto | Cuotas, timeouts, particionado y límites por empresa |
| Coste de infraestructura | Medio | Medición por empresa y plan de precios |
| Complejidad operativa | Alto | Runbooks, observabilidad y automatización |

---

# 5. Marco de capacidad y umbrales

## 5.1 Niveles

| Nivel | Alcance | Infraestructura típica |
|---|---|---|
| **T1** | Hasta 100 clientes | 1 instancia, PostgreSQL local, respaldo diario |
| **T2** | 100–1.000 clientes | 2 réplicas, pool 20–30, Redis, PostgreSQL gestionado |
| **T3** | 1.000–10.000 clientes o 100–500 empresas | Réplica de lectura, PgBouncer, particionado por fecha |
| **T4** | 500–1.000 empresas | Particionado por empresa, *sharding* por grupos, equipo de guardia |

## 5.2 Métricas y umbrales

| Métrica | Umbral de alerta | Acción |
|---|---|---|
| p95 de listados | > 300 ms durante 3 días | Revisar índices y consultas; pasar a T2 |
| p95 del dashboard | > 1 s | Caché y reescritura de consultas |
| Error rate | > 0,5 % en 15 min | Alerta e investigación |
| Pool de conexiones | > 80 % durante 10 min | Subir pool o PgBouncer |
| Crecimiento de base | > 20 % mensual | Plan de particionado/archivado |
| Tamaño de una tabla | > 5 GB | Particionar o archivar |
| Consultas > 1 s | > 10 por hora | `pg_stat_statements` y ajuste |
| Tiempo de respaldo | > 30 min | Revisar estrategia (incremental/WAL) |
| Filas de auditoría | > 5 M | Particionar/archivar |
| CPU sostenida | > 70 % | Escalar vertical u horizontal |

## 5.3 Rutina trimestral

1. Revisar el crecimiento de clientes, facturas y almacenamiento.
2. Ejecutar la prueba de carga con el volumen actual y 2× el esperado.
3. Revisar `pg_stat_statements`, índices no usados y consultas lentas.
4. Probar una restauración de respaldo.
5. Actualizar este documento con las cifras reales.

---

# 6. Checklist de actualización futura

- [ ] ¿Cuántos clientes/empresas hay y cuántos se esperan en 12 meses?
- [ ] ¿Facturas por mes y tamaño de la base?
- [ ] ¿p95 de listados, dashboard y creación de factura?
- [ ] ¿Porcentaje de uso del pool y conexiones máximas?
- [ ] ¿Consultas lentas repetidas? ¿Faltan índices?
- [ ] ¿La prueba de carga con 2× el volumen cumple el SLO?
- [ ] ¿El respaldo se restauró correctamente este trimestre?
- [ ] ¿La auditoría está creciendo sin control?
- [ ] Si hay empresas: ¿las pruebas de aislamiento están en verde?
- [ ] ¿El coste por cliente/empresa sigue siendo rentable?

---

# 7. Roadmap resumido

| Escenario | Trabajo | Duración |
|---|---|---|
| A · 1.000 clientes | Paginación, índices, vista, concurrencia, operación, carga | 5–6 semanas |
| B · 1.000 empresas | A + multi-tenancy, planes/cuotas, particionado, operación SaaS | +10–12 semanas |

**Orden recomendado:** completar A (deja el sistema sano para una empresa) y, solo si el negocio SaaS se confirma, iniciar B.

---

# 8. Qué NO hacer

- Microservicios, Kafka o Kubernetes para 1.000 clientes: complejidad sin retorno.
- *Sharding* antes de tener 500–1.000 empresas.
- Caché de todo: solo dashboard, catálogos y reportes pesados.
- Índices “por si acaso”: solo los que respondan a consultas reales.
- Aceptar `empresa_id` desde el cliente en el escenario B.

---

# 9. Decisiones pendientes

1. **¿Una empresa con 1.000 clientes o 1.000 empresas?** Determina si se ejecuta el escenario B.
2. **¿PostgreSQL gestionado o propio?** Afecta respaldos, PITR y esfuerzo operativo.
3. **¿Redis disponible en el proveedor?** Si no, empezar con una réplica y rate limit en memoria.
4. **¿Se acepta cambiar la respuesta de los listados** (paginación con `limit/offset` y `X-Total-Count`) o se requiere compatibilidad total?
5. **¿Modelo de precios del SaaS?** Sin cuotas y medición, el escenario B no es sostenible.

---

# 10. Referencias

- `refactor.md` — plan de refactor por fases (calidad de código y deuda técnica).
- `documentacion/04-seguridad/05-Revision-Lanzamiento-GO-NO-GO.md` — revisión del comité y bloqueantes de producción.
- `documentacion/04-seguridad/04-Estado-de-Remediacion.md` — estado de la auditoría de seguridad.
- `documentacion/03-operacion/CHECKLIST-DESPLIEGUE.md` — verificación previa a producción.
