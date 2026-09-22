import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../../ui.jsx';

export default function MisNotasCredito() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-notas-credito').then(setRows).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <>
      <div className="card">
        <h3>Mis notas de crédito</h3>
        {rows.length === 0 ? <Empty text="No tiene notas de crédito registradas" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nota</th><th>Factura</th><th>Fecha</th><th className="num">Valor</th><th>Motivo</th><th>Estado</th></tr></thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.nota_credito_id}>
                    <td><b>{n.numero_nota}</b></td>
                    <td>{n.numero_factura}</td>
                    <td><FechaHora value={n.fecha} /></td>
                    <td className="num"><Money value={n.valor} /></td>
                    <td>{n.motivo}</td>
                    <td><Estado value={n.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ opacity: 0.7, fontSize: 12.5, marginTop: 12 }}>
          Las notas de crédito corresponden a devoluciones registradas por FINAN-X sobre sus facturas pagadas.
        </p>
      </div>
    </>
  );
}