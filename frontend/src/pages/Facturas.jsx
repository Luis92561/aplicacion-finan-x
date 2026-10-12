import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../ui.jsx';
import FacturaPreview from '../components/FacturaPreview.jsx';

export default function Facturas() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [estadoPago, setEstadoPago] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [cargandoPrev, setCargandoPrev] = useState(null);

  const load = async () => {
    try {
      const data = await api.get('/facturas', { params: { q, estado, estadoPago } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const abrirPreview = async (f) => {
    setCargandoPrev(f.factura_id);
    try {
      setPreview(await api.get(`/facturas/${f.factura_id}`));
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setCargandoPrev(null); }
  };

  return (
    <>
      <div className="topbar"><h2>Facturas</h2><div className="crumb">Consulta y anulación</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente o identificación" style={{ width: 280 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Estado factura</option>
              <option value="ACTIVA">Activa</option>
              <option value="ANULADA">Anulada</option>
            </select>
            <select value={estadoPago} onChange={(e) => { setEstadoPago(e.target.value); }}>
              <option value="">Estado de pago</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGO_PARCIAL">Pago parcial</option>
              <option value="PAGADA">Pagada</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <Link className="btn btn-primary" to="/pedidos">Facturar pedido</Link>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay facturas" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th><th>Estado</th><th>Pago</th><th>Detalle</th><th>Vista previa</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.factura_id}>
                      <td><b>{r.numero_factura}</b></td>
                      <td><Fecha value={r.fecha_emision} /></td>
                      <td>{r.nombre_razon_social}</td>
                      <td className="num"><Money value={r.total} /></td>
                      <td className="num"><Money value={r.valor_pagado} /></td>
                      <td className="num"><b><Money value={r.saldo} /></b></td>
                      <td><Estado value={r.estado} /></td>
                      <td><Estado value={r.estado_pago} /></td>
                      <td><Link className="btn btn-ghost btn-sm" to={`/facturas/${r.factura_id}`}>Ver</Link></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => abrirPreview(r)} disabled={cargandoPrev === r.factura_id}>
                        {cargandoPrev === r.factura_id ? '…' : '👁 Vista previa'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {preview && <FacturaPreview data={preview} onCerrar={() => setPreview(null)} />}
    </>
  );
}