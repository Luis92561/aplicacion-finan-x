import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, FechaHora, DatosPago, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MisPagos() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-pagos').then(setRows).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <div className="card">
      <h3>Mis pagos</h3>
      {rows.length === 0 ? <Empty text="No tiene pagos registrados" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pago</th><th>Fecha</th><th>Factura</th><th className="num">Valor</th><th>Método</th><th>Registrado por</th><th>Referencia</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pago_id}>
                  <td><b>{p.numero_pago}</b></td>
                  <td><FechaHora value={p.fecha} /></td>
                  <td>{p.numero_factura}</td>
                  <td className="num"><b><Money value={p.valor} /></b></td>
                  <td>{p.metodo_pago}<div style={{ fontSize: 12, color: 'var(--muted)' }}><DatosPago p={p} /></div></td>
                  <td>{p.registrado_por_tipo === 'CLIENTE' ? 'Yo (portal)' : (p.registrado_por || 'Oficina')}</td>
                  <td>{p.referencia || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}