import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../../ui.jsx';
import PagarModal from './PagarModal.jsx';

export default function MisFacturas() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [pagar, setPagar] = useState(null); // { facturaId, numero, saldo }

  const cargar = () => api.get('/mis-facturas').then(setRows).catch((e) => setError(errMsg(e)));
  useEffect(() => { cargar(); }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!rows) return <Loading />;

  return (
    <div className="card">
      <h3>Mis facturas</h3>
      {rows.length === 0 ? <Empty text="No tiene facturas" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Factura</th><th>Emisión</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th><th>Estado</th><th>Pago</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.factura_id}>
                  <td><b>{f.numero_factura}</b></td>
                  <td><Fecha value={f.fecha_emision} /></td>
                  <td className="num"><Money value={f.total} /></td>
                  <td className="num"><Money value={f.valor_pagado} /></td>
                  <td className="num"><b><Money value={f.saldo} /></b></td>
                  <td><Estado value={f.estado} /></td>
                  <td><Estado value={f.estado_pago} /></td>
                  <td>
                    {f.estado === 'ACTIVA' && f.saldo > 0 && (
                      <button className="btn btn-primary btn-sm" onClick={() => setPagar({ facturaId: f.factura_id, numero: f.numero_factura, saldo: f.saldo })}>
                        Pagar / Abonar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagar && (
        <PagarModal
          facturaId={pagar.facturaId}
          numeroFactura={pagar.numero}
          saldoMax={pagar.saldo}
          onCerrar={() => setPagar(null)}
          onPagado={cargar}
        />
      )}
    </div>
  );
}