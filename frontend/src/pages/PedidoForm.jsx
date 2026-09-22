import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, ErrorBox } from '../ui.jsx';

export default function PedidoForm() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lines, setLines] = useState([{ productoId: '', cantidad: 1 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, p] = await Promise.all([
          api.get('/clientes', { params: { estado: 'ACTIVO' } }),
          api.get('/productos', { params: { estado: 'ACTIVO' } }),
        ]);
        setClientes(c);
        setProductos(p);
      } catch (e) { setError(errMsg(e)); }
    })();
  }, []);

  const precioDe = (id) => productos.find((p) => p.producto_id === Number(id));

  const calc = useMemo(() => {
    let subtotal = 0; let imp = 0;
    for (const l of lines) {
      const p = precioDe(l.productoId);
      if (!p) continue;
      const qty = Number(l.cantidad) || 0;
      const st = p.precio * qty;
      subtotal += st;
      imp += st * (Number(p.impuesto) / 100);
    }
    return { subtotal, impuestos: imp, total: subtotal + imp };
  }, [lines, productos]);

  const addLine = () => setLines((ls) => [...ls, { productoId: '', cantidad: 1 }]);
  const rmLine = (i) => setLines((ls) => ls.filter((_, ix) => ix !== i));
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, ix) => (ix === i ? { ...l, [k]: v } : l)));

  const save = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const items = lines.filter((l) => l.productoId && Number(l.cantidad) > 0);
      if (items.length === 0) throw new Error('Debe agregar al menos un producto con cantidad válida');
      const r = await api.post('/pedidos', { clienteId, observaciones, items });
      navigate(`/pedidos/${r.pedido_id}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="topbar"><h2>Nuevo pedido</h2><div className="crumb">Los valores se calculan en el servidor</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        <form onSubmit={save}>
          <div className="card">
            <h3>Datos del pedido</h3>
            <div className="form-grid">
              <div className="field"><label>Cliente *</label>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
                  <option value="">Seleccione un cliente activo…</option>
                  {clientes.map((c) => <option key={c.cliente_id} value={c.cliente_id}>{c.nombre_razon_social} ({c.numero_identificacion})</option>)}
                </select></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>Observaciones</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></div>
            </div>
          </div>

          <div className="card">
            <h3>Productos</h3>
            {lines.map((l, i) => (
              <div key={i} className="form-grid" style={{ marginBottom: 12 }}>
                <div className="field"><label>Producto</label>
                  <select value={l.productoId} onChange={(e) => setLine(i, 'productoId', e.target.value)}>
                    <option value="">Seleccione…</option>
                    {productos.map((p) => <option key={p.producto_id} value={p.producto_id}>{p.nombre} — <Money value={p.precio} /></option>)}
                  </select></div>
                <div className="field"><label>Cantidad *</label>
                  <input type="number" min="0.01" step="any" value={l.cantidad} onChange={(e) => setLine(i, 'cantidad', e.target.value)} required /></div>
                <div className="field"><label>Subtotal línea</label>
                  <div style={{ padding: '9px 0', fontWeight: 700 }}>
                    <Money value={precioDe(l.productoId) ? precioDe(l.productoId).precio * (Number(l.cantidad) || 0) : 0} />
                  </div></div>
                {lines.length > 1 && (
                  <div className="field" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => rmLine(i)} style={{ marginTop: 24 }}>Quitar</button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={addLine}>+ Agregar producto</button>
          </div>

          <div className="card">
            <h3>Resumen</h3>
            <table style={{ maxWidth: 420 }}>
              <tbody>
                <tr><td>Subtotal</td><td className="num"><Money value={calc.subtotal} /></td></tr>
                <tr><td>Impuestos</td><td className="num"><Money value={calc.impuestos} /></td></tr>
                <tr><td><b>Total</b></td><td className="num"><b><Money value={calc.total} /></b></td></tr>
              </tbody>
            </table>
            <div className="toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar pedido'}</button>
              <button className="btn btn-ghost" type="button" onClick={() => navigate('/pedidos')}>Cancelar</button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}