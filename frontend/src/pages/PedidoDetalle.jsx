import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading } from '../ui.jsx';

export default function PedidoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      setData(await api.get(`/pedidos/${id}`));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const transition = async (estado) => {
    setError(''); setMsg('');
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado });
      setMsg(`Pedido ${estado}`);
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const facturar = async () => {
    setError(''); setMsg('');
    try {
      const r = await api.post('/facturas', { pedidoId: Number(id) });
      setMsg(`Factura generada: ${r.numero_factura}`);
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  if (error && !data) return <div className="content"><ErrorBox msg={error} /></div>;
  if (!data) return <div className="content"><Loading /></div>;

  const st = data.estado;

  return (
    <>
      <div className="topbar"><h2>{data.numero_pedido}</h2><div className="crumb">Detalle del pedido</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="grid-cards">
          <div className="stat"><div className="label">Estado</div><div className="value" style={{ fontSize: 18 }}><Estado value={st} /></div></div>
          <div className="stat"><div className="label">Cliente</div><div className="value" style={{ fontSize: 18 }}>{data.nombre_razon_social}</div></div>
          <div className="stat"><div className="label">Fecha</div><div className="value" style={{ fontSize: 18 }}><FechaHora value={data.fecha} /></div></div>
          <div className="stat"><div className="label">Total</div><div className="value" style={{ fontSize: 18 }}><Money value={data.total} /></div></div>
        </div>

        <div className="card">
          <h3>Líneas del pedido</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Producto</th><th className="num">Cantidad</th><th className="num">Precio unitario</th><th className="num">Impuesto</th><th className="num">Subtotal</th></tr></thead>
              <tbody>
                {data.lineas.map((l) => (
                  <tr key={l.detalle_id}>
                    <td>{l.codigo}</td>
                    <td>{l.producto_nombre}</td>
                    <td className="num">{l.cantidad}</td>
                    <td className="num"><Money value={l.precio_unitario} decimals /></td>
                    <td className="num">{l.impuesto}%</td>
                    <td className="num"><Money value={l.subtotal} decimals /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <table style={{ maxWidth: 380, marginLeft: 'auto' }}>
            <tbody>
              <tr><td>Subtotal</td><td className="num"><Money value={data.subtotal} /></td></tr>
              <tr><td>Impuestos</td><td className="num"><Money value={data.impuestos} /></td></tr>
              <tr><td><b>Total</b></td><td className="num"><b><Money value={data.total} /></b></td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Acciones</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {st === 'BORRADOR' && <button className="btn btn-success" onClick={() => transition('CONFIRMADO')}>Confirmar pedido</button>}
            {st === 'BORRADOR' && <button className="btn btn-warn" onClick={() => transition('CANCELADO')}>Cancelar pedido</button>}
            {st === 'CONFIRMADO' && <button className="btn btn-primary" onClick={facturar}>Generar factura</button>}
            {st === 'CONFIRMADO' && <button className="btn btn-warn" onClick={() => transition('CANCELADO')}>Cancelar pedido</button>}
            {data.numero_factura && data.factura_id && <Link className="btn btn-ghost" to={`/facturas/${data.factura_id}`}>Ver factura: {data.numero_factura}</Link>}
            <button className="btn btn-ghost" onClick={() => navigate('/pedidos')}>Volver</button>
          </div>
        </div>
      </div>
    </>
  );
}