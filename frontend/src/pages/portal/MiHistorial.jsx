import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MiHistorial() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mi-historial').then(setData).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="card">
        <h3>Mi historial financiero</h3>
        {data.facturas.length === 0 && data.pagos.length === 0 ? <Empty text="Sin movimientos financieros" /> : null}

        {data.facturas.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 18 }}>
            <h4 style={{ margin: '6px 0' }}>Facturas emitidas ({data.facturas.length})</h4>
            <table>
              <thead><tr><th>Factura</th><th>Fecha</th><th className="num">Total</th><th>Estado</th><th>Pago</th></tr></thead>
              <tbody>
                {data.facturas.map((f, i) => (
                  <tr key={i}>
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
        )}

        {data.pagos.length > 0 && (
          <div className="table-wrap">
            <h4 style={{ margin: '6px 0' }}>Pagos realizados ({data.pagos.length})</h4>
            <table>
              <thead><tr><th>Pago</th><th>Fecha</th><th>Factura</th><th className="num">Valor</th><th>Método</th></tr></thead>
              <tbody>
                {data.pagos.map((p, i) => (
                  <tr key={i}>
                    <td>{p.numero_pago}</td>
                    <td><FechaHora value={p.fecha} /></td>
                    <td>{p.numero_factura}</td>
                    <td className="num"><b><Money value={p.valor} /></b></td>
                    <td>{p.metodo_pago}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}