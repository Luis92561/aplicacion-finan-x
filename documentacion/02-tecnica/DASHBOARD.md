# Panel de control (dashboard) · FINAN-X

Documento de referencia de la pantalla de Inicio. Explica **qué mide cada indicador**,
de dónde salen los datos y cómo se comporta según el rol.

Endpoint: `GET /api/dashboard?meses=12` (valor permitido: 3 a 24).
El servidor decide qué bloques entrega según el rol; el frontend solo pinta lo que recibe.

---

## 1. Indicadores (`kpis`)

| Indicador | Cálculo | Roles |
|---|---|---|
| `facturado_mes` | `SUM(facturas.total)` con `estado = 'ACTIVA'` y `fecha_emision` en el mes actual. | ADMIN, FACTURADOR, SUPERVISOR |
| `facturado_mes_anterior` | Igual, en el mes anterior (para la variación). | Ídem |
| `variacion` | Variación porcentual del facturado respecto al mes anterior; `null` si el mes anterior fue 0. | Ídem |
| `recaudado_mes` | `SUM(pagos.valor)` del mes actual. | ADMIN, FACTURADOR, SUPERVISOR |
| `cartera` | `SUM(factura_saldo.saldo)` de facturas ACTIVAS (incluye notas de crédito). | ADMIN, FACTURADOR, SUPERVISOR |
| `facturas_pendientes` | Facturas ACTIVAS con `saldo > 0`. | ADMIN, FACTURADOR, SUPERVISOR |
| `pagos_hoy` | `SUM(pagos.valor)` desde la medianoche. | Todos |
| `cantidad_pagos_hoy` | Número de pagos de hoy. | CAJERO |
| `pagos_mes` | `SUM(pagos.valor)` del mes actual. | CAJERO |

> **Nota contable:** lo facturado se mide por `fecha_emision` y lo recaudado por
> `pagos.fecha`. Una factura anulada no cuenta como facturada; las notas de crédito
> activas reducen el saldo, no lo facturado.

---

## 2. Series y gráficas

| Bloque | Cálculo | Visualización |
|---|---|---|
| `serie` | Últimos N meses: facturado (facturas ACTIVAS por mes) y recaudado (pagos por mes). | Área con dos series; la leyenda permite ocultar cada una. |
| `metodos` | Pagos agrupados por `metodo_pago` en el periodo: total y cantidad. | Dona; al hacer clic en un segmento se filtra la tabla. |
| `topClientes` | Los 5 clientes con mayor saldo pendiente (`factura_saldo` ACTIVA). | Barras horizontales; al hacer clic se filtra la tabla. |
| `tabla` | ADMIN/FACTURADOR/SUPERVISOR: facturas ACTIVAS con saldo (50 más recientes). CAJERO: pagos de hoy (50 más recientes). | Tabla con búsqueda, orden, paginación y exportación CSV. |

Los importes se muestran en COP. Las gráficas usan formato compacto en los ejes
(`$1,2M`) y el detalle completo en el tooltip.

---

## 3. Comportamiento por rol

| Rol | Ve |
|---|---|
| **ADMIN** | Todos los indicadores, series, métodos, top de clientes y facturas con saldo. |
| **FACTURADOR** | Igual que ADMIN (sin auditoría, que es otra pantalla). |
| **SUPERVISOR** | Igual que ADMIN. |
| **CAJERO** | Recuadro de caja del día, métodos de pago del mes y pagos de hoy. **No** recibe cartera global ni top de clientes (segregación de funciones). |

El servidor omite los bloques no permitidos; el frontend no los inventa.

---

## 4. Interacción

- Selector de periodo (3, 6, 12 meses) que vuelve a consultar.
- Clic en un método o en una barra de cliente → filtra la tabla; un *chip* muestra el
  filtro y permite quitarlo.
- Búsqueda libre dentro de la tabla.
- Orden ascendente/descendente por cualquier columna.
- Paginación de 10 filas.
- Exportación a CSV de lo filtrado.
- Estados de carga, vacío y error con botón de reintento.
- Etiquetas ARIA en gráficas y controles; los colores no son el único indicador.

---

## 5. Rendimiento

- Una consulta por bloque, en paralelo.
- Índices `idx_facturas_fecha_emision` y `idx_pagos_fecha`.
- Límite de 50 filas para la tabla y de 5 para el top de clientes.
