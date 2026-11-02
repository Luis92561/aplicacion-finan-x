import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import api, { errMsg } from '../api.js';
import { Money, Section, Fecha, Estado, ErrorBox, Empty } from '../ui.jsx';

const COLORES = ['#2563eb', '#15803d', '#b45309', '#6d28d9', '#0891b2'];
const fmtMoneda = (v) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(Number(v || 0));

const fmtCompacto = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
};

function TooltipMoneda({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <b>{fmtMoneda(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

/** Columnas de la tabla según el tipo de dato que devuelve el servidor. */
const COLUMNAS = {
  facturas: [
    { k: 'numero_factura', label: 'Factura' },
    { k: 'cliente', label: 'Cliente' },
    { k: 'fecha_emision', label: 'Emisión', fecha: true },
    { k: 'total', label: 'Total', num: true },
    { k: 'saldo', label: 'Saldo', num: true },
    { k: 'estado_pago', label: 'Estado', estado: true },
  ],
  pagos: [
    { k: 'numero_pago', label: 'Pago' },
    { k: 'fecha', label: 'Fecha', fecha: true },
    { k: 'numero_factura', label: 'Factura' },
    { k: 'cliente', label: 'Cliente' },
    { k: 'valor', label: 'Valor', num: true },
    { k: 'metodo_pago', label: 'Método' },
  ],
};

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [meses, setMeses] = useState(12);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ campo: null, dir: 'desc' });
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    api.get('/dashboard', { params: { meses } })
      .then((d) => { if (vivo) { setData(d); setError(''); setFiltro(null); setPagina(1); } })
      .catch((e) => { if (vivo) setError(errMsg(e)); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [meses]);

  const filas = data?.tabla?.filas || [];
  const tipo = data?.tabla?.tipo || 'facturas';
  const columnas = COLUMNAS[tipo] || [];

  const filtradas = useMemo(() => {
    let r = [...filas];
    if (filtro?.tipo === 'metodo') r = r.filter((f) => f.metodo_pago === filtro.valor);
    if (filtro?.tipo === 'cliente') r = r.filter((f) => f.cliente === filtro.valor);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      r = r.filter((f) => Object.values(f).some((v) => String(v ?? '').toLowerCase().includes(q)));
    }
    if (orden.campo) {
      r.sort((a, b) => {
        const x = a[orden.campo]; const y = b[orden.campo];
        const nx = typeof x === 'number'; const ny = typeof y === 'number';
        const cmp = nx && ny ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
        return orden.dir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [filas, filtro, busqueda, orden]);

  const POR_PAGINA = 10;
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visibles = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const ordenar = (campo) => {
    setOrden((o) => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }));
  };

  const exportarCsv = () => {
    const cab = columnas.map((c) => c.label).join(';');
    const cuerpo = filtradas.map((f) => columnas.map((c) => String(f[c.k] ?? '').replaceAll(';', ',')).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${cab}\n${cuerpo}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanx-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error && !data) {
    return (
      <div className="content">
        <ErrorBox msg={error} />
        <button className="btn btn-primary" onClick={() => setMeses((m) => m)}>Reintentar</button>
      </div>
    );
  }
  if (!data) return <div className="content"><div className="skeleton-grid">Cargando panel…</div></div>;

  const k = data.kpis || {};
  const esCajero = data.rol === 'CAJERO';

  return (
    <>
      <div className="topbar">
        <h2>Inicio</h2>
        <div className="crumb">Panel de control</div>
      </div>
      <div className="content">
        {error && <ErrorBox msg={error} />}

        <div className="panel-toolbar">
          <div className="segmented" role="group" aria-label="Periodo">
            {[3, 6, 12].map((m) => (
              <button key={m} className={meses === m ? 'active' : ''} onClick={() => setMeses(m)}>
                {m} meses
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setMeses((m) => m)}>Actualizar</button>
        </div>

        <div className="grid-cards">
          {esCajero ? (
            <>
              <div className="stat"><div className="label">Recaudado hoy</div><div className="value green"><Money value={k.pagos_hoy} /></div></div>
              <div className="stat"><div className="label">Pagos de hoy</div><div className="value">{k.cantidad_pagos_hoy ?? 0}</div></div>
              <div className="stat"><div className="label">Recaudado del mes</div><div className="value"><Money value={k.pagos_mes} /></div></div>
            </>
          ) : (
            <>
              <div className="stat">
                <div className="label">Facturado del mes</div>
                <div className="value"><Money value={k.facturado_mes} /></div>
                {k.variacion !== null && k.variacion !== undefined && (
                  <div className={`stat-trend ${k.variacion >= 0 ? 'up' : 'down'}`}>
                    {k.variacion >= 0 ? '▲' : '▼'} {Math.abs(k.variacion)}% vs mes anterior
                  </div>
                )}
              </div>
              <div className="stat"><div className="label">Recaudado del mes</div><div className="value green"><Money value={k.recaudado_mes} /></div></div>
              <div className="stat"><div className="label">Cartera pendiente</div><div className="value red"><Money value={k.cartera} /></div></div>
              <div className="stat"><div className="label">Facturas con saldo</div><div className="value warn">{k.facturas_pendientes ?? 0}</div></div>
              <div className="stat"><div className="label">Pagos de hoy</div><div className="value"><Money value={k.pagos_hoy} /></div></div>
            </>
          )}
        </div>

        {data.serie && (
          <Section title="Facturación y recaudo por mes">
            <div className="chart-box" role="img" aria-label="Gráfica de área con lo facturado y lo recaudado por mes">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.serie} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gFact" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#15803d" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#15803d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={fmtCompacto} width={64} />
                  <Tooltip content={<TooltipMoneda />} />
                  <Legend />
                  <Area type="monotone" dataKey="facturado" name="Facturado" stroke="#2563eb" fill="url(#gFact)" strokeWidth={2} />
                  <Area type="monotone" dataKey="recaudado" name="Recaudado" stroke="#15803d" fill="url(#gRec)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        <div className="grid-2">
          <Section title="Pagos por método">
            {data.metodos?.length ? (
              <div className="chart-box" role="img" aria-label="Gráfica circular de pagos por método">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data.metodos}
                      dataKey="total"
                      nameKey="metodo"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(d) => setFiltro({ tipo: 'metodo', valor: d.metodo })}
                    >
                      {data.metodos.map((m, i) => (
                        <Cell key={m.metodo} fill={COLORES[i % COLORES.length]}
                          opacity={filtro?.tipo === 'metodo' && filtro.valor !== m.metodo ? 0.35 : 1} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipMoneda />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <p className="chart-hint">Haz clic en un método para filtrar la tabla.</p>
              </div>
            ) : <Empty text="Sin pagos en el periodo" />}
          </Section>

          {data.topClientes && (
            <Section title="Top 5 clientes por saldo">
              {data.topClientes.length ? (
                <div className="chart-box" role="img" aria-label="Gráfica de barras de clientes con mayor saldo">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.topClientes} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={fmtCompacto} />
                      <YAxis type="category" dataKey="nombre" width={130} tick={{ fontSize: 12 }} />
                      <Tooltip content={<TooltipMoneda />} />
                      <Bar dataKey="saldo" name="Saldo" fill="#b45309" radius={[0, 6, 6, 0]} cursor="pointer"
                        onClick={(d) => setFiltro({ tipo: 'cliente', valor: d.nombre })} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="chart-hint">Haz clic en una barra para filtrar la tabla.</p>
                </div>
              ) : <Empty text="Sin cartera pendiente" />}
            </Section>
          )}
        </div>

        <Section
          title={tipo === 'pagos' ? 'Pagos de hoy' : 'Facturas con saldo'}
          actions={<button className="btn btn-ghost btn-sm" onClick={exportarCsv}>Exportar CSV</button>}
        >
          {filtro && (
            <div className="filter-chip">
              Filtro: {filtro.tipo === 'metodo' ? `método ${filtro.valor}` : `cliente ${filtro.valor}`}
              <button className="link" onClick={() => setFiltro(null)}>Quitar filtro</button>
            </div>
          )}
          <div className="table-toolbar">
            <input
              className="search"
              placeholder="Buscar en la tabla…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              aria-label="Buscar"
            />
            <span className="muted">{filtradas.length} registros</span>
          </div>

          {visibles.length === 0 ? <Empty text="Sin movimientos que coincidan" /> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {columnas.map((c) => (
                        <th key={c.k} className={c.num ? 'num' : ''}>
                          <button className="th-sort" onClick={() => ordenar(c.k)}>
                            {c.label}{orden.campo === c.k ? (orden.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((f) => (
                      <tr
                        key={f.factura_id || f.pago_id}
                        className="row-click"
                        onClick={() => nav(tipo === 'pagos' ? '/pagos' : `/facturas/${f.factura_id}`)}
                      >
                        {columnas.map((c) => (
                          <td key={c.k} className={c.num ? 'num' : ''}>
                            {c.estado ? <Estado value={f[c.k]} />
                              : c.fecha ? <Fecha value={f[c.k]} />
                                : c.num ? <Money value={f[c.k]} />
                                  : <b>{f[c.k] ?? '—'}</b>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <button className="btn btn-ghost btn-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
                <span>Página {pagina} de {totalPaginas}</span>
                <button className="btn btn-ghost btn-sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
              </div>
            </>
          )}
        </Section>

        <div className="quick-links">
          <Link className="btn btn-primary" to="/pedidos/nuevo">+ Nuevo pedido</Link>
          <Link className="btn btn-ghost" to="/clientes">Clientes</Link>
          <Link className="btn btn-ghost" to="/facturas">Facturas</Link>
          <Link className="btn btn-ghost" to="/pagos">Pagos</Link>
        </div>
      </div>
    </>
  );
}
