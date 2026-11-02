# Revisión de lanzamiento · FINAN-X 1.0.0

**Comité de Revisión de Lanzamientos (Release Management Committee) — Fintech**
**Aplicación:** FINAN-X · facturación, cartera y pagos
**Fecha:** 2 de noviembre de 2026
**Versión evaluada:** 1.0.0 (commit `3916dae`)
**Stack real:** React 18 + Vite 5 + Recharts · nginx 1.27 · Node.js 22 + Express 4 · PostgreSQL 16
**Despliegue real:** Docker Compose en un único host (VPS/on-prem), nginx con TLS. **No** se usa Vercel, AWS ni Supabase.
**Evidencia base:** suite e2e de 157 comprobaciones, auditoría de seguridad de 32 hallazgos y su remediación.

> **Veredicto anticipado: NO-GO para producción fiscal.** Es un producto sólido como sistema de facturación interno y demostración, pero no cumple los requisitos mínimos de facturación electrónica, inmutabilidad histórica ni operación 24/7 de una fintech. El detalle y las condiciones para el GO están al final.

---

# 1. QA Engineer — Control de Calidad Financiero

## 1.1 Smoke tests (15–20 minutos, obligatorios en cada despliegue)

| ID | Flujo | Pasos | Resultado esperado |
|---|---|---|---|
| S-01 | Salud y TLS | `GET https://dominio/api/health` | `{"ok":true}`, HSTS presente, sin HTTP |
| S-02 | Primer ingreso | Login con cuenta temporal | 200 + pantalla de cambio; cualquier otra ruta 403 `CAMBIO_CLAVE_REQUERIDO` |
| S-03 | Cambio de clave | Clave actual + nueva de 12+ | 200; token anterior 401; nueva clave funciona |
| S-04 | Cliente | Crear cliente con NIT válido | 201; duplicado por identificación 409 |
| S-05 | Producto con IVA | Crear producto precio 100.000, IVA 19 | 201; listado muestra 19 % |
| S-06 | Pedido | 2 líneas (100.000×2 y 50.000×1) | subtotal 250.000, IVA 47.500, total 297.500 |
| S-07 | Factura | Confirmar pedido y facturar | 201, número `FAC-00000N`, estado ACTIVA |
| S-08 | Doble clic | Enviar dos `POST /facturas` simultáneos | Uno 201 y otro 409; **una sola** factura activa |
| S-09 | Pago parcial | Abonar 100.000 de 297.500 | 201, saldo 197.500, estado PAGO_PARCIAL |
| S-10 | Sobre-pago | Intentar pagar 999.999 | 400; no se registra |
| S-11 | Pago total | Pagar el saldo | 201, estado PAGADA, saldo 0 |
| S-12 | Anulación | Anular factura **sin pagos** | 200; pedido vuelve a CONFIRMADO; se puede refacturar |
| S-13 | Anulación con pagos | Anular factura pagada | 409; no se altera |
| S-14 | Nota de crédito | Devolver 50.000 con pagos de 100.000 | 201; saldo sube 50.000 |
| S-15 | Rol CAJERO | Crear/anular nota de crédito | 403 |
| S-16 | Portal | Cliente consulta solo sus facturas | 200 y ninguna ajena; IDOR 404 |
| S-17 | PDF/impresión | Abrir vista previa e imprimir | Datos fiscales, número, IVA y totales legibles, sin cortes |
| S-18 | Dashboard | Abrir Inicio con 3/6/12 meses | KPIs, series y tabla coherentes con la base |
| S-19 | Auditoría | Revisar últimas operaciones | Registra usuario, IP, operación y fecha |
| S-20 | Respaldo | Ejecutar `scripts/respaldo.sh` | Archivo `.sql.gz` no vacío |

## 1.2 Pruebas de aceptación (UAT) críticas

### UAT-01 · Cálculo de IVA y redondeo
**Datos:** producto A 4.299.000 (19 %), producto B 279.000 (19 %), producto C servicio 150.000 (0 %).

| Caso | Cálculo esperado | Criterio |
|---|---|---|
| A×1 | IVA 816.810 · total 5.115.810 | Exacto a 2 decimales |
| B×3 | subtotal 837.000 · IVA 159.030 · total 996.030 | Exacto |
| A×1 + C×2 | subtotal 4.599.000 · IVA 816.810 · total 5.415.810 | Mezcla de tarifas |
| 333,33×3 | subtotal 999,99 · IVA 189,9981 → **189,99** · total 1.189,98 | Redondeo definido |
| 10,05×0,19 | 1,9095 → **1,91** | Sin error binario |
| Cantidad 1,5 | subtotal proporcional y IVA proporcional | 2 decimales |

**Debe verificarse además:** que la suma de las líneas coincida con el total de la factura; que el IVA mostrado en el PDF sea el mismo que el persistido; y que el redondeo sea **siempre el mismo** (política única, no una por pantalla).

### UAT-02 · Numeración correlativa
- Emitir 10 facturas seguidas: `FAC-00000N` consecutivos, sin repetir y sin saltos.
- Forzar un fallo a mitad de emisión (p. ej. pedido inexistente) y verificar el comportamiento del consecutivo.
- Verificar que dos usuarios emitiendo a la vez no reciben el mismo número.
- **Criterio:** número único, trazable y con política de huecos documentada.

### UAT-03 · PDF / comprobante
- Verificar: razón social y NIT del emisor, datos del cliente, número, fecha, líneas, subtotal, IVA discriminado, total, forma de pago y leyenda.
- Probar factura de 1 línea y de 25 líneas (saltos de página).
- Verificar que el PDF no se corta, que los importes llevan separador de miles y que la fecha es la de emisión (no la de impresión).
- **Criterio:** el documento impreso coincide 100 % con los datos persistidos.

### UAT-04 · Pagos y conciliación
- Pago parcial, pago total, sobre-pago, pago desde portal y pago desde caja.
- Dos pagos simultáneos por el total: solo uno debe pasar.
- Verificar que el saldo del dashboard, la factura y el portal coinciden tras cada pago.

### UAT-05 · Devoluciones
- Nota de crédito por valor menor, igual y mayor a lo pagado.
- Dos notas simultáneas: la segunda debe fallar.
- Anulación de nota: el saldo debe volver al estado anterior.

### UAT-06 · Roles y aislamiento
- Matriz: ADMIN, FACTURADOR, CAJERO, SUPERVISOR contra cada módulo.
- Cliente A intenta leer factura de B: 404.
- Usuario desactivado: su token deja de servir de inmediato.

### UAT-07 · Operación
- Restaurar un respaldo en una base limpia y verificar 10 facturas al azar.
- Reiniciar el stack y comprobar que los datos y las sesiones se comportan como se espera.

## 1.3 Pruebas de concurrencia (obligatorias)

| Prueba | Método | Criterio |
|---|---|---|
| Factura duplicada | 2 `POST /facturas` simultáneos al mismo pedido | 1 éxito, 1 conflicto |
| Pago duplicado | 2 pagos por el total | 1 éxito, 1 rechazo |
| Nota de crédito duplicada | 2 notas por el total pagado | 1 éxito, 1 rechazo |
| Edición + facturación | Editar pedido mientras se factura | El pedido no puede quedar inconsistente |

## 1.4 Pruebas que hoy **no existen** y deben añadirse
- Pruebas unitarias de IVA/redondeo (hoy solo hay e2e).
- Pruebas de PDF (contenido y paginación).
- Pruebas de carga (50 usuarios concurrentes, p95 < 1 s).
- Prueba de restauración de respaldo automatizada.
- Pruebas de accesibilidad y de navegadores móviles.

---

# 2. DevOps / Cloud Engineer

## 2.1 Checklist de despliegue (estado real del proyecto)

| Control | Estado | Observación |
|---|---|---|
| TLS 1.2/1.3 y redirección 80→443 | ✅ | `deploy/nginx-tls.conf` |
| HSTS, CSP, X-Frame-Options, no-store | ✅ | nginx y helmet |
| Solo 80/443 publicados | ✅ | 5432 y 4000 no se publican |
| Base de datos en red privada | ✅ | servicio `db` sin `ports` |
| Rol de aplicación sin DDL ni superusuario | ✅ | `finanx_app` |
| Secretos fuera de Git | ✅ | `.env` ignorado |
| Gestor de secretos (Vault/SM/SOPS) | ❌ | Hoy es un `.env` en el host |
| Rotación de JWT y claves de BD | ⚠️ | Manual, sin procedimiento |
| Respaldos automáticos | ❌ | Solo script manual `scripts/respaldo.sh` |
| PITR / WAL archiving | ❌ | No configurado |
| Prueba de restauración documentada | ❌ | No hay evidencia |
| Monitoreo de errores (Sentry/OTel) | ❌ | Solo logs de Docker |
| Métricas y alertas (5xx, latencia, disco, BD) | ❌ | No existen |
| CI/CD con pruebas y escaneo | ❌ | No hay pipeline |
| Escaneo de imágenes (Trivy) y SBOM | ❌ | Imágenes por tag, no por digest |
| Límites de recursos (CPU/RAM) | ❌ | Sin `deploy.resources` |
| Backend no-root | ✅ | `USER node` |
| Frontend no-root | ⚠️ | nginx corre como root |
| Cifrado en reposo de la BD | ❌ | Volumen sin cifrar |
| TLS hacia PostgreSQL | ❌ | Red interna, sin SSL |
| WAF / protección DDoS | ⚠️ | Rate limit de app, sin WAF |
| Firewall, SSH por clave, parches | ⚠️ | Responsabilidad del host, no documentado |
| Runbook de incidentes y rollback | ⚠️ | Parcial (hay guía de despliegue) |

## 2.2 Requisitos mínimos antes de producción

1. **Secretos:** migrar `.env` a un gestor (AWS Secrets Manager, Vault, SOPS+age) y montar solo lo necesario; rotar `JWT_SECRET`, `POSTGRES_PASSWORD` y `APP_DB_PASSWORD` al desplegar.
2. **Respaldos:** `pg_dump` diario + WAL archiving (PITR), cifrado en reposo, retención 30–90 días y **prueba de restauración mensual**. RPO ≤ 15 min, RTO ≤ 4 h.
3. **Monitoreo:** Sentry (o OpenTelemetry) para errores; Prometheus/Grafana o el proveedor para métricas; alertas a 5xx > 1 %, p95 > 2 s, conexiones a BD > 80 %, fallo de respaldo, disco > 80 %.
4. **CI/CD:** pipeline que ejecute `npm audit`, tests e2e, SAST (Semgrep/CodeQL), escaneo de imagen (Trivy) y bloqueo si hay críticos. Despliegue con migración previa y smoke test posterior.
5. **Infraestructura:** firewall (solo 80/443 y SSH restringido), fail2ban, SSH por clave, parches automáticos, imágenes fijadas por digest, límites de CPU/RAM y healthchecks (ya existen).
6. **Base de datos:** cifrado en reposo, conexión TLS, backups verificados, usuario de app sin DDL (ya), y plan de capacidad.
7. **Continuidad:** runbook de incidentes, plan de rollback a la imagen anterior y contacto de guardia.

---

# 3. Tech Lead — Código y arquitectura

## 3.1 Concurrencia y duplicados

**Lo que está bien:** `POST /facturas` bloquea el pedido con `FOR UPDATE` y la base impone `uq_factura_activa_por_pedido`; los pagos usan `FOR UPDATE`; las notas de crédito también. La doble facturación simultánea está cubierta a nivel de base de datos.

**Riesgos pendientes:**

| ID | Riesgo | Severidad | Corrección |
|---|---|---|---|
| T-01 | Sin clave de idempotencia en facturación/pagos: un reintento de red puede generar un 409 confuso o un doble intento | Media | `Idempotency-Key` + tabla de claves |
| T-02 | La numeración se deriva del `SERIAL`; una transacción fallida **consume** el número y deja huecos | Alta | Secuencia por resolución/año o política de huecos documentada |
| T-03 | El total de la factura se copia del pedido, no se recalcula al emitir; una modificación directa del pedido deja totales divergentes | Media | Recalcular y comparar al emitir; trigger de consistencia |

## 3.2 Precisión del dinero

- El backend usa `Number` (doble IEEE-754) y `round2` en cada paso (`Math.round(x*100)/100`). Para COP con 2 decimales el error suele ser invisible, pero **no es exacto** y puede fallar en casos como `1.005`.
- PostgreSQL guarda `NUMERIC(14,2)` (correcto), pero la API convierte a `float8` para responder (`::float8`), lo que reintroduce binario en el cliente.
- El IVA se calcula **por línea** y luego se suma; hay que definir y documentar la política (por línea vs por total) y el modo de redondeo (medio hacia arriba, no bancario).

**Corrección recomendada:** trabajar en **centavos enteros** o con `decimal.js` en todo el backend, mantener `NUMERIC` hasta el formateo y añadir pruebas de propiedad con vectores de redondeo. Es un cambio de bajo costo y alto impacto para una app de facturación.

## 3.3 Inmutabilidad de los datos históricos

**Hallazgo crítico:** una factura emitida no guarda una **foto** de los datos fiscales del cliente ni del emisor. La pantalla y la API leen `clientes` en vivo (`facturas.js:104-118`). Si se edita el nombre o el NIT del cliente, **las facturas anteriores cambian** en pantalla y en el PDF.

Además, la base permite `UPDATE` sobre `facturas` al rol de la aplicación (necesario para anular); no hay trigger que impida alterar `subtotal`, `impuestos`, `total`, `numero_factura` o `cliente_id`.

**Corrección:**
1. Guardar en `facturas` la foto fiscal (razón social, NIT, dirección, régimen) y la del emisor.
2. Trigger que solo permita `ACTIVA → ANULADA` y bloquee cambios en importes/número.
3. Registro append-only con hash encadenado (o CUFE) para detectar alteraciones.
4. Prohibir `DELETE` de facturas (hoy no hay endpoint, pero la base lo permite).

## 3.4 PDF y archivo

El comprobante se genera con `window.print()` en el navegador (`FacturaPreview.jsx:185`); **no hay PDF del lado del servidor ni copia archivada**. El NIT del emisor está escrito a mano (`FacturaPreview.jsx:72`), no sale de una configuración fiscal. Para una fintech esto es un bloqueante: el documento entregado al cliente debe ser reproducible y verificable.

## 3.5 Otros riesgos técnicos

| ID | Riesgo | Severidad |
|---|---|---|
| T-04 | Sin pruebas unitarias de cálculo; solo e2e | Alta |
| T-05 | `factura_saldo` expone `float8` y el frontend opera con `Number` | Media |
| T-06 | Sin versionado de la API; cambios futuros pueden romper integraciones | Baja |
| T-07 | Sin cola/outbox para correo, PDF o integraciones DIAN | Media |
| T-08 | Auditoría sin hash ni WORM; el superusuario puede alterarla | Media |
| T-09 | Sin paginación completa en listados (`LIMIT 300`) | Baja |
| T-10 | Dependencias sin escaneo continuo | Media |

---

# 4. Product Owner — Negocio y cumplimiento

## 4.1 Riesgos de experiencia de usuario

| ID | Riesgo | Impacto |
|---|---|---|
| P-01 | No hay configuración de la empresa emisora (razón social, NIT, dirección, régimen, resolución) | El comprobante sale con datos fijos y posiblemente falsos |
| P-02 | El primer ingreso obliga a cambiar la clave y el mensaje no siempre es claro | Abandono en el onboarding |
| P-03 | No hay vista previa antes de emitir ni confirmación del consecutivo | Errores irreversibles |
| P-04 | El envío al cliente es `mailto:` (abre el correo del operador), no un envío real con PDF adjunto | Mala experiencia y nula trazabilidad |
| P-05 | Listados sin búsqueda avanzada ni paginación completa | Difícil operar con volumen |
| P-06 | Sin diseño móvil ni accesibilidad declarada | Excluye usuarios y dispositivos |
| P-07 | El dashboard no explica las métricas | Decisiones equivocadas |

## 4.2 Cumplimiento normativo (Colombia)

| Requisito | Estado |
|---|---|
| Factura electrónica DIAN (XML UBL 2.1, CUFE, transmisión, contingencia) | ❌ No implementado |
| Datos fiscales del emisor y resolución de numeración | ❌ No existen |
| Datos fiscales del adquiriente congelados en la factura | ❌ No se guardan |
| Inmutabilidad y conservación (5 años) | ❌ Sin archivo inmutable |
| Ley 1581 de 2012: aviso de privacidad, consentimiento, derechos del titular | ❌ No hay política ni mecanismo |
| Retención y eliminación de datos personales | ❌ No definida |
| PCI-DSS | ✅ No se almacena PAN ni CVV |
| Registro de auditoría | ✅ Con IP y user-agent; inmutabilidad parcial |

> Si el despliegue es **solo académico o interno con datos ficticios**, estos puntos no bloquean la demo. Si FINAN-X va a emitir facturas reales en Colombia, son obligatorios.

## 4.3 Tres métricas para medir desde el día 1

1. **Activación:** porcentaje de empresas que emiten su **primera factura en 24 h** desde el registro. Objetivo inicial: > 60 %.
2. **Tasa de emisión exitosa:** facturas emitidas / intentos de emisión (con desglose de errores por causa). Objetivo: > 99 %.
3. **Eficiencia de recaudo:** recaudado / facturado a 30 días (o DSO). Objetivo inicial: > 85 %.

Complementarias: tiempo medio hasta la primera factura, tickets de soporte por cada 100 facturas y porcentaje de facturas pagadas por el portal.

---

# 5. Conclusión del comité: **NO-GO (Retenido)**

**Para producción fiscal real: NO-GO.** Para demostración académica o piloto interno con datos ficticios: **GO condicionado**, dejando claro que no emite facturas válidas fiscalmente.

## 5.1 Bloqueantes obligatorios para el GO

| # | Criterio | Responsable | Evidencia actual |
|---|---|---|---|
| B-01 | Facturación electrónica DIAN (XML, CUFE, transmisión, contingencia) | Producto + Backend | No existe |
| B-02 | Perfil fiscal del emisor configurable (NIT, régimen, resolución, pie de factura) | Backend + Frontend | NIT fijo en `FacturaPreview.jsx:72` |
| B-03 | Foto fiscal del cliente/emisor en cada factura + trigger de inmutabilidad | Backend + BD | `facturas` sin snapshot |
| B-04 | PDF generado y archivado en servidor, con hash verificable | Backend | Solo `window.print()` |
| B-05 | Numeración por resolución, sin ambigüedad de huecos | Backend | `FAC-` + `SERIAL` |
| B-06 | Respaldos automáticos + PITR + restauración probada | DevOps | Script manual |
| B-07 | Monitoreo de errores y alertas 24/7 | DevOps | No existe |
| B-08 | MFA para ADMIN/SUPERVISOR y gestor de secretos | Seguridad | Pendiente |
| B-09 | Cifrado en reposo y política de retención (Ley 1581) | DevOps + Legal | No existe |
| B-10 | UAT firmada + prueba de carga + re-test de seguridad | QA | Suite e2e 157/157, sin UAT formal |
| B-11 | CI/CD con SAST, dependencias e imágenes escaneadas | DevOps | Sin pipeline |
| B-12 | Runbook de incidentes y rollback probado | DevOps | Parcial |

## 5.2 Lo que sí está listo (no rehacer)

- Autenticación con cookie HttpOnly, cambio obligatorio, bloqueo por cuenta y roles separados.
- Consultas parametrizadas, sin SQL injection; aislamiento por cliente en el portal.
- Bloqueos `FOR UPDATE` y unicidad de factura activa por pedido.
- TLS, HSTS, CSP y puertos de base/API cerrados.
- Rol de aplicación sin privilegios de administrador.
- Auditoría con IP, user-agent y sin permiso de reescritura para la app.
- Suite e2e de 157 comprobaciones y documentación operativa.

## 5.3 Recomendación del comité

1. **Mantener el GO solo para demo** con datos sintéticos; rotular la aplicación como "demostración, no válida fiscalmente".
2. Ejecutar el plan de QA de la sección 1 y firmar UAT.
3. Cerrar B-01 a B-05 (producto) y B-06 a B-09 (operación) antes de cualquier cliente real.
4. Volver a este comité con: UAT firmada, informe de restauración, tablero de monitoreo activo y evidencia de la numeración/DIAN.

**Esfuerzo estimado para el GO fiscal:** 6 a 10 semanas de trabajo adicional, dependiendo de la integración DIAN y del proveedor de facturación electrónica.
