# 1 · Visión general de FINAN-X

## Qué es

FINAN-X es una **aplicación web de facturación y pagos**. El propio README lo define así:

> "Aplicación independiente de **facturación y pagos** — Frontend React, Backend Node.js/Express y
> base de datos PostgreSQL."

Es importante calibrar el alcance: **no es un ERP**. Es un sistema de **ciclo de venta y cobro**
con dos caras (panel interno + portal del cliente). No tiene contabilidad, ni inventario, ni nómina,
ni compras a proveedores.

## El flujo de negocio

```
   CLIENTE                INTERNO (Facturador/Cajero)              SISTEMA
      │                            │                                 │
      │                            ├─ 1. Crea CLIENTE ──────────────►│
      │                            ├─ 2. Crea PRODUCTOS ────────────►│
      │                            │                                 │
      │                            ├─ 3. Crea PEDIDO (BORRADOR) ────►│  totales
      │                            │       └─ líneas de detalle      │  calculados
      │                            ├─ 4. CONFIRMA el pedido ────────►│  en servidor
      │                            │                                 │
      │                            ├─ 5. FACTURA el pedido ─────────►│  1 pedido →
      │                            │                                 │  1 factura
      │                            │                                 │
      │ ◄── 6. Ve su factura ──────┤                                 │
      │                            │                                 │
      ├─ 7. PAGA desde el portal ─►│  (o el Cajero registra el pago) │  no puede
      │       (efectivo, tarjeta,  │                                 │  superar el
      │        transferencia…)     │                                 │  saldo
      │                            │                                 │
      │                            ├─ 8. Si hay devolución:         │
      │                            │     NOTA DE CRÉDITO ───────────►│  no devuelve
      │                            │                                 │  más de lo
      │                            │                                 │  pagado
      │                            │                                 │
      │                            └─ 9. REPORTES / BALANCE ────────►│  saldos por
      │                                   AUDITORÍA                  │  cliente
```

Estados que va tomando un pedido: `BORRADOR → CONFIRMADO → FACTURADO` (o `CANCELADO`).
Estado de pago de una factura, **calculado**: `PENDIENTE / PAGO_PARCIAL / PAGADA` (o `ANULADA`).

## Los dos mundos de la aplicación

FINAN-X tiene **dos interfaces separadas dentro de la misma SPA**, y esa separación es una de las
decisiones de diseño más importantes del proyecto:

### A) Panel interno
Para los **4 roles de la empresa**. Rutas en la raíz (`/`, `/clientes`, `/pedidos`, `/facturas`,
`/pagos`, `/reportes`, `/auditoria`…). Es donde se opera el negocio de punta a punta.

### B) Portal del cliente
Para el **cliente final**. Todas las rutas viven bajo `/portal/*`. El cliente solo ve **sus propios**
datos: `Mis datos`, `Mis compras`, `Mis facturas`, `Mis pagos`, `Mi saldo`, `Mi historial`,
`Mis notas de crédito`.

**El aislamiento es la clave de seguridad aquí:** el `clienteId` **nunca** se toma del navegador, se
toma del **token JWT autenticado** (`requireCliente` + filtros `WHERE cliente_id = $1`). Un cliente
no puede pedir los datos de otro ni manipulando la URL ni el body de la petición.

## Roles del sistema

| Rol | Credencial demo | Qué puede hacer |
|---|---|---|
| **ADMIN** (Administrador) | `admin@finanx.test` / `admin123` | Todo, incluida la **gestión de usuarios internos** (`/usuarios`, única ruta restringida a ADMIN) |
| **FACTURADOR** | `facturador@finanx.test` / `facturador123` | Clientes, productos, pedidos y **generar/anular facturas** |
| **CAJERO** | `cajero@finanx.test` / `cajero123` | **Registrar pagos**, notas de crédito |
| **SUPERVISOR** | `supervisor@finanx.test` / `supervisor123` | Consulta, reportes, balance, auditoría |
| **CLIENTE** | `cliente@finanx.test` / `cliente123` | Solo el **portal**: sus pedidos, facturas, pagos, saldo, historial |

> Las credenciales están en el `README.md` del proyecto y en `backend/src/seed.js`. Son **datos
> demo** generados por el seed.

## Módulos funcionales

| Módulo | Qué cubre |
|---|---|
| **Autenticación** | Login interno y de cliente, **autoregistro público** de clientes, **recuperación de contraseña con OTP** de 6 dígitos |
| **Clientes** | Alta, edición, búsqueda (nombre / documento / NIT), activar-inactivar, crear cuenta de acceso |
| **Productos** | Alta, edición, código único, precio e impuesto (%), activar-inactivar |
| **Pedidos** | Creación con líneas, totales calculados en servidor, confirmar, cancelar, detalle |
| **Facturación** | Generar factura desde pedido, listar, detalle, saldo, anular (con motivo) |
| **Pagos** | Registrar pago (efectivo, tarjeta, transferencia, cheque), listar |
| **Notas de crédito** | Devoluciones sobre facturas, con motivo, anulación lógica |
| **Reportes** | Resumen del dashboard, facturación por rango de fechas, historial por cliente, **balance / cuentas por cobrar por cliente** |
| **Auditoría** | Registro de todas las operaciones sensibles |
| **Usuarios** | Gestión de usuarios internos (solo ADMIN) |
| **Portal cliente** | Los 7 endpoints `mis-*` aislados por token |

## Stack tecnológico

| Capa | Tecnología | Detalle |
|---|---|---|
| **Frontend** | React **18.3** + Vite **5.4** + React Router **6.26** + Axios **1.7** | SPA, `react-router-dom`, sin Redux (estado de sesión en un Context + `localStorage`) |
| **Backend** | Node.js + Express **4.19** | ESM (`"type": "module"`), sin ORM |
| **Base de datos** | PostgreSQL **16** (alpine) | SQL parametrizado con `pg` **8.13**, pool de conexiones (máx. 10) |
| **Auth** | `jsonwebtoken` **9.0** + `bcryptjs` **2.4** | JWT con expiración de **8 h**, hash bcrypt |
| **Seguridad** | `helmet` **8.3** + `cors` **2.8** + `express-rate-limit` **7.5** | Cabeceras de seguridad, CORS con lista blanca, límites por IP |
| **Infra** | Docker + Docker Compose | 3 servicios: `db`, `backend`, `frontend` (nginx) |

**Node.js 20+** es el requisito declarado (en esta máquina hay Node **v24.21.0** y npm **11.19.0**,
así que cumple de sobra).

## Método de desarrollo declarado

El README documenta **metodología ágil con entregas semanales**: 6 sprints entre el **21 de agosto y
el 28 de septiembre de 2026**, con entregas los viernes (28 ago · 4 · 11 · 18 · 25 sep) y cierre final
el lunes 28 sep. Cada sprint se cerraba con "una versión ejecutable y verificada", y la **suite e2e en
verde es la definición de terminado**. El cronograma está en
`documentacion/diagrams/FINAN_X_Diagrama_Gantt.svg`.

> 📌 Dato a tener en cuenta: las fechas del proyecto son de **2026** (el Gantt también). Es coherente
> con un trabajo académico de semestre; la fecha que aparece en `documentacion/LEEME.md` es
> "Septiembre de 2026".

## Trazabilidad

El README incluye tablas de trazabilidad **requisito ↔ implementación**:
`RF-01 … RF-11` (requisitos funcionales), `RF-C01..C06` (clientes), `RF-P01..P05` (productos),
`RF-PD01..PD08` (pedidos), `RF-U01..U03` (usuarios/seguridad), `RF-A01/A02` (auditoría), y los
**casos de uso CU-09 … CU-30**. Es un proyecto con documentación inusualmente completa: PDFs, HTMLs,
specs en Markdown, diagramas PlantUML (casos de uso, clases, secuencias, arquitectura hexagonal,
Gantt) y 14 mockups wireframe en HTML.

## Backlog

**22 historias de usuario** en formato "Como…, quiero…, para…", con criterios de aceptación y
trazabilidad a fases, en `documentacion/SPEC_Funcional.md` §2.3.

---

*Siguiente: [`02-ARQUITECTURA.md`](02-ARQUITECTURA.md) para ver cómo está armado por dentro.*
