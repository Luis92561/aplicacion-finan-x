import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, FechaHora, Estado, ErrorBox, Section, Loading } from '../ui.jsx';

export default function Reportes() {
  const nav = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [range, setRange] = useState({ desde: '', hasta: '' });
  const [reporte, setReporte] = useState(null);
  const [clienteId, setClienteId] = useState('');
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reportes/resumen').then(setResumen).catch((e) => setError(errMsg(e)));
  }, []);

  const genReporte = async (e) => {
    e.preventDefault();
    try {
      setReporte(await api.get('/reportes/facturacion', { params: range }));
      setError('');
    } catch (err) { setError(errMsg(err)); }
  };

  const generarHistorial = async (e) => {
    e.preventDefault();
    try {
      setHistorial(await api.get(`/reportes/historial/${clienteId}`));
      setError('');
    } catch (err) { setError(errMsg(err)); }
  };

  if (!resumen) return <div className="content"><Loading /></div>;

  return (
    <>
      <div className="topbar"><h2>Reportes</h2><div className="crumb">Facturación e historial financiero</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="grid-cards">
          <div className="stat"><div className="label">Pagos recibidos (general)</div><div className="value green"><Money value={resumen.pagos_recibidos} /></div></div>
          <div className="stat"><div className="label">Cuentas por cobrar</div><div className="value red"><Money value={resumen.saldo_pendiente_total} /></div></div>
          <div className="stat"><div className="label">Facturas activas</div><div className="value">{resumen.facturas_activas}</div></div>
          <div className="stat"><div className="label">Pedidos por facturar</div><div className="value warn">{resumen.pedidos_por_facturar}</div></div>
        </div>

        <Section title="Reporte de facturación por rango de fechas">
          <form onSubmit={genReporte} className="form-grid" style={{ maxWidth: 560 }}>
            <div className="field"><label>Desde</label>
              <input type="date" value={range.desde} onChange={(e) => setRange({ ...range, desde: e.target.value })} /></div>
            <div className="field"><label>Hasta</label>
              <input type="date" value={range.hasta} onChange={(e) => setRange({ ...range, hasta: e.target.value })} /></div>
            <div style={{ display: 'flex', alignItems: 'end' }}><button className="btn btn-primary" type="submit">Generar</button></div>
          </form>
          {reporte && (
            <div className="grid-cards" style={{ marginTop: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))' }}>
              <div className="stat"><div className="label">Facturas</div><div className="value">{reporte.total_facturas}</div></div>
              <div className="stat"><div className="label">Activas</div><div className="value">{reporte.activas}</div></div>
              <div className="stat"><div className="label">Total facturado</div><div className="value"><Money value={reporte.total_facturado} /></div></div>
              <div className="stat"><div className="label">Pagos recibidos</div><div className="value green"><Money value={reporte.total_pagado} /></div></div>
              <div className="stat"><div className="label">Saldo pendiente</div><div className="value red"><Money value={reporte.saldo_pendiente} /></div></div>
              <div className="stat"><div className="label">Por método</div>
                <div className="value" style={{ fontSize: 13 }}>EFE {reporte.efectivo} · TRA {reporte.transferencia} · TAR {reporte.tarjeta}</div></div>
            </div>
          )}
        </Section>

        <Section title="Historial financiero de un cliente">
          <form onSubmit={generarHistorial} className="form-grid" style={{ maxWidth: 560 }}>
            <div className="field"><label>ID de cliente</label>
              <input type="number" min="1" value={clienteId} onChange={(e) => setClienteId(e.target.value)} placeholder="Ej.: 1" /></div>
            <div style={{ display: 'flex', alignItems: 'end' }}><button className="btn btn-primary" type="submit">Consultar</button></div>
          </form>
          {historial && (
            <>
              <p><b>{historial.cliente.nombre_razon_social}</b> · {historial.cliente.numero_identificacion} · {historial.cliente.ciudad} · <Estado value={historial.cliente.estado} /></p>
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
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => nav(`/clientes`)}>Ir a clientes</button>
            </>
          )}
        </Section>
      </div>
    </>
  );
}