# 6 · Frontend

Stack: **React 18.3** + **Vite 5.4** + **React Router 6.26** + **Axios 1.7**.
Sin Redux, sin TypeScript, sin framework de CSS, sin tests.

## Estructura

```
frontend/
├── index.html            lang="es", <title>FINAN-X · Facturación y Pagos</title>
├── vite.config.js        puerto 5173, proxy /api → localhost:4000
├── nginx.conf            producción: proxy /api → backend:4000 + fallback SPA
├── Dockerfile            multi-etapa: node:22-alpine (build) → nginx:1.27-alpine
└── src/
    ├── main.jsx          StrictMode > BrowserRouter > AuthProvider > App
    ├── App.jsx           ★ mapa de rutas y guardas
    ├── auth.jsx          Context de sesión (localStorage)
    ├── api.js            cliente axios + interceptores
    ├── ui.jsx            componentes compartidos de presentación
    ├── styles.css        todo el CSS (300 líneas, plano)
    ├── components/
    │   ├── Layout.jsx        Shell (sidebar + Outlet)
    │   └── FacturaPreview.jsx previsualización imprimible de factura
    └── pages/            14 páginas internas + portal/ (8 archivos)
```

## Enrutado y guardas (`App.jsx`)

Sistema de guardas por **composición de `<Outlet />`** — el patrón limpio de React Router 6:

| Guarda | Condición | Si falla redirige a |
|---|---|---|
| `RequireAuth` | Existe `user` | `/login` |
| `RequireInternal` | `user.tipo === 'interno'` | `/portal` |
| `RequireCliente` | `user.tipo === 'cliente'` | `/` |
| `RequireRol({roles})` | interno **y** `roles.includes(user.rol)` | `/` |

Anidamiento real:

```
<Route element={<RequireAuth />}>
  <Route element={<Shell />}>                    ← sidebar + Outlet
    <Route element={<RequireCliente />}>         ← PORTAL DEL CLIENTE
      /portal, /portal/datos, /portal/compras, /portal/facturas,
      /portal/pagos, /portal/historial, /portal/notas
    </Route>
    <Route element={<RequireInternal />}>        ← PANEL INTERNO
      /, /clientes, /productos, /pedidos, /pedidos/nuevo, /pedidos/:id,
      /facturas, /facturas/:id, /pagos, /notas-credito,
      /balance-clientes, /reportes, /auditoria
      <Route element={<RequireRol roles={['ADMIN']} />}>
        /usuarios                                 ← SOLO ADMIN
      </Route>
    </Route>
  </Route>
</Route>
<Route path="*" element={<Navigate to="/" replace />} />
```

La separación entre los dos mundos se decide por **`user.tipo`** (que emite el backend en el login), no
por permisos granulares. Tras autenticar, `Login` redirige con
`navigate(user.tipo === 'cliente' ? '/portal' : '/', { replace: true })`.

> ⚠️ **Importante para el diseño de permisos:** las guardas del frontend son solo de **UX**. La
> seguridad real la aplica el backend con `requireRol` / `requireCliente`. El frontend **no** replica
> la matriz de roles del backend — y por eso hay enlaces del menú que dan 403 (ver más abajo).

## Sesión y cliente HTTP

**`auth.jsx`** (31 líneas) — Context mínimo:
- `user` se inicializa leyendo `localStorage.getItem('fx_user')` con `JSON.parse` en try/catch
  (si está corrupto → `null`, buen detalle).
- `login(u, token)` guarda `fx_user` y `fx_token` y hace `setUser`.
- `logout()` borra ambas claves.
- **No hay:** decodificación/expiración del JWT, refresh token, ni sincronización entre pestañas.

**`api.js`** (27 líneas) — dos interceptores muy bien resueltos:
1. **Petición:** lee `fx_token` de `localStorage` y añade `Authorization: Bearer <token>`.
2. **Respuesta:** `(r) => r.data` — **desenvuelve `data`**, así las páginas consumen el cuerpo
   directamente (`setRows(data)`, no `setRows(data.data)`).
3. **Error:** si `err.response?.status === 401`, limpia `fx_token` y `fx_user` y hace
   `window.location.href = '/login'` (recarga dura, salvo que ya estés en `/login`).

`baseURL: '/api'` — **no hay URLs absolutas ni variables `VITE_*` en el frontend**. En desarrollo lo
resuelve el proxy de Vite; en producción lo resuelve nginx. Mismo código en los dos entornos.

Helper `errMsg(err)`: `err?.response?.data?.error || err?.message || 'Error inesperado'` — asume el
contrato `{ error: string }` del backend.

> ⚠️ Solo se maneja **401**. Un **403** no desautentica: se muestra como alerta de error. Eso está bien,
> pero combinado con los desajustes de rol produce pantallas de error confusas.

## Páginas internas

| Página | Propósito | Endpoints que consume |
|---|---|---|
| `Login.jsx` | 3 modos en un componente: login, autoregistro de cliente, recuperación OTP en 2 pasos | `POST /auth/login`, `POST /auth/registro`, `POST /auth/recuperar-solicitar`, `POST /auth/recuperar-cambiar` |
| `Dashboard.jsx` | Inicio: 7 tarjetas + acciones rápidas + auditoría reciente | `GET /reportes/resumen`, `GET /auditoria?limit=8` |
| `Clientes.jsx` | CRUD de clientes + cuentas de portal + envío de estado por correo | `GET/POST/PUT /clientes`, `PATCH /clientes/:id/estado`, `POST /clientes/:id/cuenta`, `GET /clientes/:id/resumen-correo` |
| `Productos.jsx` | Catálogo (código deshabilitado al editar) | `GET/POST/PUT /productos`, `PATCH /productos/:id/estado` |
| `Pedidos.jsx` | Listado con filtro de estado | `GET /pedidos` |
| `PedidoForm.jsx` | Alta de pedido con líneas dinámicas; totales de **vista previa** (`useMemo`) | `GET /clientes?estado=ACTIVO`, `GET /productos?estado=ACTIVO`, `POST /pedidos` |
| `PedidoDetalle.jsx` | Detalle + confirmar/cancelar + **generar factura** | `GET /pedidos/:id`, `PATCH /pedidos/:id/estado`, `POST /facturas` |
| `Facturas.jsx` | Listado con filtros + vista previa | `GET /facturas`, `GET /facturas/:id` |
| `FacturaDetalle.jsx` | **La más compleja (296 líneas).** Saldo, líneas, pagos, notas, registrar pago, anular, imprimir | `GET /facturas/:id`, `POST /pagos`, `POST /facturas/:id/anular`, `POST /notas-credito` |
| `Pagos.jsx` | Consulta global de pagos con rango de fechas | `GET /pagos` |
| `NotasCredito.jsx` | Gestión de devoluciones con 2 modales | `GET /notas-credito`, `GET /facturas?estado=ACTIVA`, `POST /notas-credito`, `POST /notas-credito/:id/anular` |
| `BalanceClientes.jsx` | Cuentas por cobrar por cliente + historial + correo | `GET /reportes/balance-clientes`, `GET /reportes/historial/:clienteId`, `GET /clientes/:id/resumen-correo` |
| `Reportes.jsx` | Facturación por rango + historial por ID de cliente | `GET /reportes/resumen`, `GET /reportes/facturacion`, `GET /reportes/historial/:clienteId` |
| `Auditoria.jsx` | Bitácora con filtros (tope 200, sin paginación) | `GET /auditoria` |
| `Usuarios.jsx` | Gestión de usuarios internos (doble protección ADMIN) | `GET /usuarios`, `GET /usuarios/roles`, `POST /usuarios`, `PATCH /usuarios/:id` |

`FacturaDetalle.jsx` calcula banderas de acción:
```js
puedePagar  = estado === 'ACTIVA' && saldo > 0
puedeAnular = estado === 'ACTIVA'
puedeNota   = estado === 'ACTIVA' && devolvible > 0    // devolvible = max(0, valor_pagado − Σ notas ACTIVA)
```

## Portal del cliente (`pages/portal/`)

Todas consumen endpoints `/mis-*`, que **no aceptan un `clienteId` por parámetro** — el aislamiento es
por token:

| Página | Endpoint |
|---|---|
| `MiSaldo.jsx` | `GET /mi-saldo` + botón "Pagar / Abonar" |
| `MisDatos.jsx` | `GET /mis-datos` (solo lectura, no editable) |
| `MisCompras.jsx` | `GET /mis-pedidos` |
| `MisFacturas.jsx` | `GET /mis-facturas` + `PagarModal` |
| `MisPagos.jsx` | `GET /mis-pagos` |
| `MiHistorial.jsx` | `GET /mi-historial` |
| `MisNotasCredito.jsx` | `GET /mis-notas-credito` (solo lectura) |
| `PagarModal.jsx` | Compartido por `MiSaldo` y `MisFacturas` |

**`PagarModal.jsx`** (239 líneas) es interesante. Con props
`{ facturaId, numeroFactura, saldoMax, onCerrar, onPagado }`:
- Para **TARJETA / TRANSFERENCIA / CHEQUE** → `POST /mis-pagos`. La referencia es obligatoria para
  transferencia y cheque.
- Para **EFECTIVO** → **no registra ningún pago**. Llama a
  `GET /mis-pagos/efecty-codigo?facturaId&valor` y muestra el código con botón "Copiar código"
  (`navigator.clipboard`), porque el pago en efectivo se hace físicamente en un punto Efecty.

> 🐛 Dos detalles aquí: `className="btn primary"` en la línea 212 (**debería ser `btn-primary`**; la
> clase `.primary` no existe, así que el botón queda sin estilo), y la vigencia del código se calcula
> **en el cliente** con `Date.now() + 24h` en vez de usar una fecha del servidor.

## Sistema visual (`styles.css`, 300 líneas)

**CSS plano escrito a mano**, sin framework, sin CSS Modules, sin Tailwind. Un único archivo importado
globalmente por `main.jsx`, con clases globales: `.card`, `.stat`, `.badge`, `.btn`, `.field`,
`.table-wrap`, `.overlay`, `.modal`, `.balance-hero`, `.topbar`, `.content`, `.grid-cards`.

Tema claro corporativo con tokens en `:root`:

| Token | Valor | Uso |
|---|---|---|
| `--primary` / `--primary-dark` | `#1e3a8a` / `#172554` | Azul corporativo, sidebar con degradado |
| `--accent` | `#2563eb` | Acentos y enlaces |
| `--success` / `--warning` / `--danger` / `--purple` | (+ sus `-light`) | Estados semánticos |
| `--bg` / `--card` / `--text` / `--muted` / `--border` | `#f1f5f9`, … | Neutros |
| `--radius` / `--shadow` | `10px`, … | Formas |

Convenciones: sidebar con degradado azul oscuro, `th` en mayúsculas, hover de fila, badges tipo
píldora, grid responsive con `auto-fit`/`minmax`, **una única media query a 900 px** (el sidebar pasa a
bloque) y un bloque `@media print` que aísla `.print-area` y oculta `.no-print`.

> ⚠️ Hay **estilos inline abundantes** en el JSX mezclados con el CSS (dos enfoques a la vez), y una
> clase suelta `.panel-inline` usada en `PagarModal` que **no está definida** en el CSS.

## Componentes compartidos (`ui.jsx`)

| Componente | Para qué |
|---|---|
| `Badge` | Píldora con clase `badge-{tone}` |
| `Estado` | Traduce un estado a color con el mapa `TONES` (reemplaza `_` por espacio) |
| `Money` | Formato monetario `Intl` **es-CO / COP** |
| `Fecha` / `FechaHora` | Formato de fechas |
| `DatosPago` | Muestra el método de pago **enmascarando** tarjeta/cuenta |
| `Loading` / `ErrorBox` / `Empty` / `Section` | Estados de UI y contenedores |

## `FacturaPreview.jsx`

Previsualización imprimible dentro de un `overlay` + `modal` (maxWidth 760). Genera el documento
completo: encabezado FINAN-X, datos del cliente, número de pedido, condición de pago, tabla de líneas
con IVA, totales, pagado/saldo y tabla de notas de crédito.

Acciones: `window.print()` (el CSS `@media print` hace el resto) y "Enviar por correo" como `mailto:`.

> **No es un documento fiscal.** Lleva el **NIT y la ciudad hardcodeados**
> (`NIT 900.000.000-1 · Bogotá, Colombia`). No hay CUFE ni integración con la DIAN. Es una
> representación informativa, no una factura electrónica válida.

## Desajustes conocidos entre frontend y backend

Estos son los puntos donde la UI no coincide con lo que la API realmente permite. Son los que más
confusión generan al usar la aplicación:

| # | Problema | Efecto |
|---|---|---|
| 1 | **`Dashboard` inutilizable para CAJERO y FACTURADOR.** Hace `Promise.all([GET /reportes/resumen, GET /auditoria])`. `/api/reportes` excluye a CAJERO y `/api/auditoria` excluye a CAJERO **y** FACTURADOR | Como `Promise.all` **rechaza en el primer fallo**, el `catch` pinta un `ErrorBox` y **ninguna** de las 7 tarjetas se muestra. El rol CAJERO ve la pantalla de inicio rota |
| 2 | El **menú lateral** (`Layout.jsx`, `NAVS.interno`) ofrece "Reportes", "Balances por cliente" y "Auditoría" a **todos** los roles internos | Un CAJERO ve enlaces que solo devuelven 403 |
| 3 | `Facturas.jsx`: 9 `<th>` en la cabecera pero 10 `<td>` en el cuerpo (la columna de acciones no tiene encabezado) | Tabla desalineada |
| 4 | `Clientes.jsx:159`: `<Estado value="ACTIVO" tone="green">Cuenta</Estado>` — `Estado` **ignora `tone` y los `children`** | Renderiza la insignia "ACTIVO" en lugar de "Cuenta" |
| 5 | `styles.css:243`: `.alert-info` usa `var(--brand-light)` y `var(--brand)`, **variables que no existen** en `:root` | Los avisos informativos (OTP en Login, aviso PCI en PagarModal) salen sin color ni fondo |
| 6 | `PagarModal.jsx:212`: `className="btn primary"` (debería ser `btn-primary`) | El botón "Generar código Efecty" pierde el estilo |
| 7 | `Dashboard.jsx:58` reutiliza el mapa de **estados** para pintar **operaciones** de auditoría (`operacion === 'REGISTRAR' ? 'PAGO_PARCIAL' : ...`) | Mezcla semántica; las operaciones que no son estados caen a `badge-gray` |
| 8 | `Usuarios.jsx` pinta el rol con el mapa de estados (`ADMIN→CONFIRMADO`, `SUPERVISOR→FACTURADO`, …) | Otro "préstamo" de semántica que confunde |
| 9 | `Reportes.jsx` pide el historial con **entrada manual del ID numérico de cliente** (sin selector) | UX pobre comparada con `BalanceClientes`, que sí tiene selector |
| 10 | Código muerto: `Topbar` se exporta pero **ninguna página lo usa** (todas pintan `<div className="topbar">` a mano); `EntityPill()` siempre devuelve `null` | Deuda de limpieza |
| 11 | Formato de dinero duplicado: `Money` (ui.jsx) convive con `fmt`/`cpu`/`CPU` redefinidos en `FacturaPreview`, `FacturaDetalle` y `NotasCredito` | Duplicación |
| 12 | Endpoints que el frontend **nunca** consume: `PUT /pedidos/:id`, `GET /facturas/:id/pagos`, `GET /facturas/:id/saldo`, `GET /clientes/:id`, `GET /mis-pedidos/:id`, `GET /mis-facturas/:id` | Superficie de API sin uso |
| 13 | `/* eslint-disable-next-line react-hooks/exhaustive-deps */` repetido en casi todas las páginas para cargar solo al montar | Los filtros quedan dependientes del botón "Buscar" |

---

*Siguiente: [`07-LEVANTAR-Y-PROBAR.md`](07-LEVANTAR-Y-PROBAR.md).*
