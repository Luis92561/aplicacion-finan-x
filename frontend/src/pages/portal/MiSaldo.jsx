import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money, Estado, Fecha, ErrorBox, Loading, Empty } from '../../ui.jsx';
import PagarModal from './PagarModal.jsx';

export default function MiSaldo() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pagar, setPagar] = useState(null); // { facturaId, numero, saldo }

  const cargar = () => api.get('/mi-saldo').then(setData).catch((e) => setError(errMsg(e)));
  useEffect(() => { cargar(); }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <div className="balance-hero">
        <div className="lbl">Mi saldo pendiente</div>
        <div className="big"><Money value={data.saldo_pendiente} /></div>
        <div className="balance-chips">
          <div className="chip"><b><Money value={data.total_activo} /></b><span>Total en facturas activas</span></div>
          <div className="chip"><b><Money value={data.total_pagado} /></b><span>Total pagado</span></div>
          <div className="chip"><b>{data.facturas_pendientes}</b><span>Facturas con saldo</span></div>
          <div className="chip"><b>{data.facturas_pagadas}</b><span>Facturas pagadas</span></div>
        </div>
      </div>

      <div className="card">
        <h3>Facturas pendientes</h3>
        {data.facturas.length === 0 ? <Empty text="¡No tiene saldos pendientes!" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Factura</th><th>Fecha</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {data.facturas.map((f) => (
                  <tr key={f.factura_id}>
                    <td><b>{f.numero_factura}</b></td>
                    <td><Fecha value={f.fecha_emision} /></td>
                    <td className="num"><Money value={f.total} /></td>
                    <td className="num"><Money value={f.valor_pagado} /></td>
                    <td className="num"><b><Money value={f.saldo} /></b></td>
                    <td><Estado value={f.estado_pago} /></td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => setPagar({ facturaId: f.factura_id, numero: f.numero_factura, saldo: f.saldo })}>
                        Pagar / Abonar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagar && (
        <PagarModal
          facturaId={pagar.facturaId}
          numeroFactura={pagar.numero}
          saldoMax={pagar.saldo}
          onCerrar={() => setPagar(null)}
          onPagado={cargar}
        />
      )}
    </>
  );
}