import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, FechaHora, DatosPago, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Pagos() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/pagos', { params: { q, desde, hasta } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const total = (rows || []).reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <>
      <div className="topbar"><h2>Pagos</h2><div className="crumb">Consulta de pagos realizados</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por pago, factura o referencia" style={{ width: 260 }} />
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <button className="btn btn-ghost" type="submit">Filtrar</button>
          </form>
          <div className="spacer" />
          <div className="stat" style={{ padding: '8px 16px' }}><span className="label">Total en la vista: </span><b><Money value={total} /></b></div>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay pagos" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Pago</th><th>Fecha</th><th>Factura</th><th>Cliente</th><th className="num">Valor</th><th>Método</th><th>Referencia</th><th>Observaciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pago_id}>
                      <td><b>{r.numero_pago}</b></td>
                      <td><FechaHora value={r.fecha} /></td>
                      <td>{r.numero_factura}</td>
                      <td>{r.nombre_razon_social}</td>
                      <td className="num"><b><Money value={r.valor} /></b></td>
                      <td>{r.metodo_pago}<div style={{ fontSize: 12, color: 'var(--muted)' }}><DatosPago p={r} /></div></td>
                      <td>{r.referencia || '—'}</td>
                      <td>{r.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}