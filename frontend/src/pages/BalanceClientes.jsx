import { useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function BalanceClientes() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [historial, setHistorial] = useState(null);
  const [histCliente, setHistCliente] = useState(null);
  const [enviando, setEnviando] = useState(null);

  const load = async () => {
    try {
      setData(await api.get('/reportes/balance-clientes'));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const rows = useMemo(() => {
    if (!data?.clientes) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data.clientes;
    return data.clientes.filter((c) =>
      `${c.nombre_razon_social} ${c.numero_identificacion} ${c.correo || ''} ${c.ciudad || ''}`.toLowerCase().includes(t)
    );
  }, [data, q]);

  const verHistorial = async (c) => {
    setError('');
    try {
      setHistCliente(c);
      setHistorial(await api.get(`/reportes/historial/${c.cliente_id}`));
    } catch (e) { setError(errMsg(e)); }
  };

  const enviarEstado = async (c) => {
    setError(''); setMsg(''); setEnviando(c.cliente_id);
    try {
      const r = await api.get(`/clientes/${c.cliente_id}/resumen-correo`);
      if (!r.destinatario) { setError('El cliente no tiene correo registrado'); return; }
      const url = `mailto:${encodeURIComponent(r.destinatario)}?subject=${encodeURIComponent(r.asunto)}&body=${encodeURIComponent(r.cuerpo)}`;
      window.location.href = url;
      setMsg(`Se abrió su programa de correo para enviar el estado financiero de ${c.nombre_razon_social} a ${r.destinatario}`);
    } catch (e) { setError(errMsg(e)); } finally { setEnviando(null); }
  };

  if (!data) return <div className="content"><Loading /></div>;
  const R = data.resumen || {};

  return (
    <>
      <div className="topbar"><h2>Balance por cliente</h2><div className="crumb">Dashboard de saldos y cuentas por cobrar</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="grid-cards">
          <div className="stat"><div className="label">Clientes con saldo pendiente</div><div className="value warn">{R.clientes_con_saldo}</div></div>
          <div className="stat"><div className="label">Cuentas por cobrar totales</div><div className="value red"><Money value={R.saldo_total} /></div></div>
          <div className="stat"><div className="label">Total facturado</div><div className="value"><Money value={R.facturado_total} /></div></div>
          <div className="stat"><div className="label">Total pagado</div><div className="value green"><Money value={R.pagado_total} /></div></div>
        </div>

        <div className="toolbar">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nombre, documento, correo o ciudad" style={{ width: 320 }} />
          <div className="spacer" />
          <button className="btn btn-ghost" onClick={load}>⟳ Actualizar</button>
        </div>

        <div className="card">
          <h3>Clientes · balances ({rows.length})</h3>
          {rows.length === 0 ? <Empty text="Sin clientes" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Cliente</th><th>Identificación</th><th>Ciudad</th><th className="num">Facturas activas</th><th className="num">Facturado</th><th className="num">Pagado</th><th className="num">Saldo pendiente</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.cliente_id}>
                      <td><b>{c.nombre_razon_social}</b><div style={{ fontSize: 12, opacity: 0.7 }}>{c.correo || 'sin correo'}</div></td>
                      <td>{c.numero_identificacion}</td>
                      <td>{c.ciudad || '—'}</td>
                      <td className="num">{c.facturas_activas}</td>
                      <td className="num"><Money value={c.total_facturado} /></td>
                      <td className="num"><Money value={c.total_pagado} /></td>
                      <td className="num" style={{ fontWeight: 800, color: Number(c.saldo_pendiente) > 0 ? 'var(--warning)' : 'var(--success)' }}>
                        <Money value={c.saldo_pendiente} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => verHistorial(c)}>Historial</button>
                          <button className="btn btn-sm btn-primary" onClick={() => enviarEstado(c)} disabled={enviando === c.cliente_id}>
                            {enviando === c.cliente_id ? '…' : '✉ Enviar estado'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {historial && histCliente && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Historial · {histCliente.nombre_razon_social}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setHistorial(null); setHistCliente(null); }}>Cerrar historial</button>
            </div>
            <p style={{ opacity: 0.8 }}>{histCliente.numero_identificacion} · {histCliente.ciudad || '—'} · <Estado value={histCliente.estado} /></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <h4 style={{ margin: '8px 0' }}>Facturas ({historial.facturas.length})</h4>
                <table>
                  <thead><tr><th>Número</th><th>Fecha</th><th className="num">Total</th><th>Estado</th><th>Pago</th></tr></thead>
                  <tbody>
                    {historial.facturas.map((f) => (
                      <tr key={f.factura_id}>
                        <td><b>{f.numero_factura}</b></td>
                        <td><FechaHora value={f.fecha_emision} /></td>
                        <td className="num"><Money value={f.total} /></td>
                        <td><Estado value={f.estado} /></td>
                        <td><Estado value={f.estado_pago} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ margin: '8px 0' }}>Pagos ({historial.pagos.length})</h4>
                <table>
                  <thead><tr><th>Pago</th><th>Fecha</th><th>Factura</th><th className="num">Valor</th><th>Método</th></tr></thead>
                  <tbody>
                    {historial.pagos.map((p) => (
                      <tr key={p.pago_id}>
                        <td>{p.numero_pago}</td>
                        <td><FechaHora value={p.fecha} /></td>
                        <td>{p.numero_factura}</td>
                        <td className="num"><Money value={p.valor} /></td>
                        <td>{p.metodo_pago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}