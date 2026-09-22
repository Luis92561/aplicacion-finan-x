import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Pedidos() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/pedidos', { params: { q, estado } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <div className="topbar"><h2>Pedidos</h2><div className="crumb">Registro de operaciones comerciales</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente o identificación" style={{ width: 320 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="FACTURADO">Facturado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <Link className="btn btn-primary" to="/pedidos/nuevo">+ Nuevo pedido</Link>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay pedidos" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th className="num">Subtotal</th><th className="num">Impuestos</th><th className="num">Total</th><th>Estado</th><th>Factura</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pedido_id}>
                      <td><b>{r.numero_pedido}</b></td>
                      <td><Fecha value={r.fecha} /></td>
                      <td>{r.nombre_razon_social}<br /><small style={{ color: 'var(--muted)' }}>{r.numero_identificacion}</small></td>
                      <td className="num"><Money value={r.subtotal} /></td>
                      <td className="num"><Money value={r.impuestos} /></td>
                      <td className="num"><b><Money value={r.total} /></b></td>
                      <td><Estado value={r.estado} /></td>
                      <td>{r.numero_factura || '—'}</td>
                      <td><Link className="btn btn-ghost btn-sm" to={`/pedidos/${r.pedido_id}`}>Ver</Link></td>
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