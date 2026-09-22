import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MisCompras() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-pedidos').then(setRows).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <div className="card">
      <h3>Mis compras</h3>
      {rows.length === 0 ? <Empty text="No tiene compras registradas" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pedido</th><th>Fecha</th><th className="num">Subtotal</th><th className="num">Impuestos</th><th className="num">Total</th><th>Estado</th><th>Factura</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pedido_id}>
                  <td><b>{p.numero_pedido}</b></td>
                  <td><Fecha value={p.fecha} /></td>
                  <td className="num"><Money value={p.subtotal} /></td>
                  <td className="num"><Money value={p.impuestos} /></td>
                  <td className="num"><b><Money value={p.total} /></b></td>
                  <td><Estado value={p.estado} /></td>
                  <td>{p.numero_factura || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}