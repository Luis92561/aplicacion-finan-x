import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Estado, Fecha, FechaHora, ErrorBox, Loading } from '../ui.jsx';
import FacturaPreview from '../components/FacturaPreview.jsx';

const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE'];

export default function FacturaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  // Pago
  const [pago, setPago] = useState({ valor: '', metodoPago: 'EFECTIVO', referencia: '', observaciones: '' });
  // Datos de pago en línea (tarjeta/transferencia/cheque) — se limpian al cambiar de método
  const EMPTY_CARD = { numeroTarjeta: '', codigoSeguridad: '', vencimientoTarjeta: '', banco: '', titularTarjeta: '' };
  const [card, setCard] = useState(EMPTY_CARD);
  const [transfer, setTransfer] = useState({ numeroCuenta: '' });
  const setCardF = (k) => (e) => setCard((f) => ({ ...f, [k]: e.target.value }));
  const setTransferF = (k) => (e) => setTransfer((f) => ({ ...f, [k]: e.target.value }));
  // Anulación
  const [motivo, setMotivo] = useState('');
  const [confirmAnular, setConfirmAnular] = useState(false);
  // Vista previa
  const [showPreview, setShowPreview] = useState(false);
  // Nota de crédito
  const [showNota, setShowNota] = useState(false);
  const [nota, setNota] = useState({ valor: '', motivo: '' });
  const [notaMsg, setNotaMsg] = useState('');
  const [creandoNota, setCreandoNota] = useState(false);

  const load = async () => {
    try {
      setData(await api.get(`/facturas/${id}`));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const registrarPago = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      const body = { facturaId: Number(id), ...pago, valor: Number(pago.valor) };
      if (pago.metodoPago === 'TARJETA') {
        body.numeroTarjeta = card.numeroTarjeta;
        body.codigoSeguridad = card.codigoSeguridad;
        body.vencimientoTarjeta = card.vencimientoTarjeta;
        body.banco = card.banco;
        body.titularTarjeta = card.titularTarjeta;
      } else if (pago.metodoPago === 'TRANSFERENCIA' || pago.metodoPago === 'CHEQUE') {
        body.banco = card.banco;
      }
      if (pago.metodoPago === 'TRANSFERENCIA') body.numeroCuenta = transfer.numeroCuenta;
      const r = await api.post('/pagos', body);
      setMsg(`Pago ${r.numero_pago} registrado · saldo ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(r.saldo)}`);
      setPago({ valor: '', metodoPago: 'EFECTIVO', referencia: '', observaciones: '' });
      setCard(EMPTY_CARD);
      setTransfer({ numeroCuenta: '' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const anular = async () => {
    setError(''); setMsg('');
    try {
      await api.post(`/facturas/${id}/anular`, { motivo });
      setMsg('Factura anulada (se conserva para historial y auditoría)');
      setConfirmAnular(false); setMotivo('');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const registrarNota = async (e) => {
    e.preventDefault();
    setError(''); setNotaMsg(''); setCreandoNota(true);
    try {
      const r = await api.post('/notas-credito', { facturaId: Number(id), valor: Number(nota.valor), motivo: nota.motivo });
      setNotaMsg(`Nota ${r.numero_nota} creada por ${cpu(r.valor)}`);
      setShowNota(false); setNota({ valor: '', motivo: '' });
      await load();
    } catch (err) { setError(errMsg(err)); } finally { setCreandoNota(false); }
  };

  const cpu = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(v || 0));

  if (error && !data) return <div className="content"><ErrorBox msg={error} /></div>;
  if (!data) return <div className="content"><Loading /></div>;

  const puedePagar = data.estado === 'ACTIVA' && Number(data.saldo) > 0;
  const puedeAnular = data.estado === 'ACTIVA';
  const notasActivas = (data.notas_credito || []).filter((n) => n.estado === 'ACTIVA');
  const devolvible = Math.max(0, Number(data.valor_pagado) - notasActivas.reduce((s, n) => s + Number(n.valor), 0));
  const puedeNota = data.estado === 'ACTIVA' && devolvible > 0;

  return (
    <>
      <div className="topbar"><h2>{data.numero_factura}</h2><div className="crumb">Detalle de factura</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="balance-hero">
          <div className="lbl">Total de la factura</div>
          <div className="big">{cpu(data.total)}</div>
          <div className="balance-chips">
            <div className="chip"><b>{cpu(data.valor_pagado)}</b><span>Pagado</span></div>
            <div className="chip"><b>{cpu(data.saldo)}</b><span>Saldo pendiente</span></div>
            <div className="chip"><b><Estado value={data.estado} /></b><span>Estado factura</span></div>
            <div className="chip"><b><Estado value={data.estado_pago} /></b><span>Estado de pago</span></div>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: -6 }}>
          <button className="btn btn-primary" onClick={() => setShowPreview(true)}>👁 Vista previa · Imprimir</button>
          {data.correo && (
            <a className="btn btn-ghost" style={{ textDecoration: 'none' }}
              href={`mailto:${data.correo}?subject=${encodeURIComponent(`Factura ${data.numero_factura} · FINAN-X`)}&body=${encodeURIComponent(`Estimado(a) ${data.nombre_razon_social}:\n\nAdjuntamos su factura ${data.numero_factura} por ${cpu(data.total)}. Saldo pendiente: ${cpu(data.saldo)}.\n\nDescargue el detalle en el portal FINAN-X.\n\nAtentamente,\nFINAN-X`)}`}>
              ✉ Enviar por correo
            </a>
          )}
          <div className="spacer" />
        </div>

        <div className="card">
          <h3>Información</h3>
          <div className="form-grid">
            <div className="field"><label>Cliente</label><div style={{ padding: '8px 0' }}>{data.nombre_razon_social} · {data.numero_identificacion}</div></div>
            <div className="field"><label>Pedido asociado</label><div style={{ padding: '8px 0' }}>{data.numero_pedido}</div></div>
            <div className="field"><label>Emisión</label><div style={{ padding: '8px 0' }}><FechaHora value={data.fecha_emision} /></div></div>
            <div className="field"><label>Vencimiento</label><div style={{ padding: '8px 0' }}><Fecha value={data.fecha_vencimiento} /></div></div>
          </div>
        </div>

        <div className="card">
          <h3>Líneas</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Producto</th><th className="num">Cantidad</th><th className="num">Precio unitario</th><th className="num">Impuesto</th><th className="num">Subtotal</th></tr></thead>
              <tbody>
                {data.lineas.map((l, i) => (
                  <tr key={i}>
                    <td>{l.codigo}</td><td>{l.producto_nombre}</td>
                    <td className="num">{l.cantidad}</td>
                    <td className="num"><Money value={l.precio_unitario} /></td>
                    <td className="num">{l.impuesto}%</td>
                    <td className="num"><Money value={l.subtotal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <table style={{ maxWidth: 380, marginLeft: 'auto' }}>
            <tbody>
              <tr><td>Subtotal</td><td className="num">{cpu(data.subtotal)}</td></tr>
              <tr><td>Impuestos</td><td className="num">{cpu(data.impuestos)}</td></tr>
              <tr><td><b>Total</b></td><td className="num"><b>{cpu(data.total)}</b></td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Pagos registrados</h3>
          {data.pagos.length === 0 ? <div className="empty">Sin pagos — factura pendiente</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Pago</th><th>Fecha</th><th className="num">Valor</th><th>Método</th><th>Referencia</th><th>Observaciones</th></tr></thead>
                <tbody>
                  {data.pagos.map((p) => (
                    <tr key={p.pago_id}>
                      <td>{p.numero_pago}</td><td><FechaHora value={p.fecha} /></td>
                      <td className="num"><Money value={p.valor} /></td>
                      <td>{p.metodo_pago}</td><td>{p.referencia || '—'}</td><td>{p.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Notas de crédito {notasActivas.length > 0 && <span style={{ opacity: 0.6, fontSize: 13 }}>({notasActivas.length} activas · {cpu(devolvible)} devolvible)</span>}</h3>
          {notaMsg && <div className="alert alert-success">{notaMsg}</div>}
          {(data.notas_credito || []).length === 0 ? <div className="empty">Sin notas de crédito en esta factura</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nota</th><th>Fecha</th><th className="num">Valor</th><th>Motivo</th><th>Estado</th></tr></thead>
                <tbody>
                  {(data.notas_credito || []).map((n) => (
                    <tr key={n.nota_credito_id}>
                      <td><b>{n.numero_nota}</b></td>
                      <td><FechaHora value={n.fecha} /></td>
                      <td className="num"><Money value={n.valor} /></td>
                      <td style={{ maxWidth: 260 }}>{n.motivo}</td>
                      <td><Estado value={n.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {puedeNota && !showNota && (
            <button className="btn btn-warn" style={{ marginTop: 12 }} onClick={() => setShowNota(true)}>↩ Registrar devolución (nota de crédito)</button>
          )}
          {puedeNota && showNota && (
            <form onSubmit={registrarNota} className="form-grid" style={{ marginTop: 12 }}>
              <div className="field"><label>Valor a devolver * (máx. {cpu(devolvible)})</label>
                <input type="number" min="0.01" step="any" max={devolvible} value={nota.valor} onChange={(e) => setNota({ ...nota, valor: e.target.value })} required /></div>
              <div className="field"><label>Motivo de la devolución *</label>
                <input value={nota.motivo} onChange={(e) => setNota({ ...nota, motivo: e.target.value })} placeholder="Ej.: devolución de mercancía" required /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <button className="btn btn-success" type="submit" disabled={creandoNota || !(Number(nota.valor) > 0) || Number(nota.valor) > devolvible}>
                  {creandoNota ? 'Procesando…' : 'Registrar nota'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowNota(false)}>Cancelar</button>
              </div>
            </form>
          )}
        </div>

        {puedePagar && (
          <div className="card">
            <h3>Registrar pago</h3>
            <form onSubmit={registrarPago} className="form-grid">
              <div className="field"><label>Valor *</label>
                <input type="number" min="0.01" step="any" value={pago.valor} onChange={(e) => setPago({ ...pago, valor: e.target.value })} placeholder={String(data.saldo)} required /></div>
              <div className="field"><label>Método de pago</label>
                <select value={pago.metodoPago} onChange={(e) => { setPago({ ...pago, metodoPago: e.target.value }); setCard(EMPTY_CARD); setTransfer({ numeroCuenta: '' }); }}>
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select></div>
              {pago.metodoPago === 'TARJETA' && (
                <>
                  <div className="field"><label>Número de tarjeta *</label>
                    <input inputMode="numeric" maxLength={19} value={card.numeroTarjeta} onChange={setCardF('numeroTarjeta')} placeholder="4111 1111 1111 1111" required /></div>
                  <div className="field"><label>CVV *</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={card.codigoSeguridad} onChange={setCardF('codigoSeguridad')} placeholder="123" required /></div>
                  <div className="field"><label>Vencimiento (MM/AA) *</label>
                    <input inputMode="numeric" maxLength={5} value={card.vencimientoTarjeta} onChange={setCardF('vencimientoTarjeta')} placeholder="12/30" required /></div>
                  <div className="field"><label>Banco emisor *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Bancolombia" required /></div>
                  <div className="field"><label>Titular de la tarjeta *</label>
                    <input value={card.titularTarjeta} onChange={setCardF('titularTarjeta')} placeholder="Nombre en la tarjeta" required /></div>
                </>
              )}
              {pago.metodoPago === 'TRANSFERENCIA' && (
                <>
                  <div className="field"><label>Banco destino *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Davivienda" required /></div>
                  <div className="field"><label>N.º de cuenta *</label>
                    <input inputMode="numeric" value={transfer.numeroCuenta} onChange={setTransferF('numeroCuenta')} placeholder="4 a 20 dígitos" required /></div>
                </>
              )}
              {pago.metodoPago === 'CHEQUE' && (
                <div className="field"><label>Banco del cheque *</label>
                  <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Banco Popular" required /></div>
              )}
              <div className="field"><label>Referencia{pago.metodoPago === 'TRANSFERENCIA' || pago.metodoPago === 'CHEQUE' ? ' *' : ''}</label>
                <input value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} required={pago.metodoPago === 'TRANSFERENCIA' || pago.metodoPago === 'CHEQUE'} placeholder={pago.metodoPago === 'TRANSFERENCIA' ? 'N.º de comprobante' : pago.metodoPago === 'CHEQUE' ? 'N.º de cheque' : ''} /></div>
              <div className="field"><label>Observaciones</label>
                <input value={pago.observaciones} onChange={(e) => setPago({ ...pago, observaciones: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-success" type="submit">Registrar pago</button>
              </div>
              <div className="field"><label>Saldo disponible</label>
                <div style={{ padding: '9px 0', fontWeight: 800, color: Number(data.saldo) > 0 ? 'var(--warning)' : 'var(--success)' }}>{cpu(data.saldo)}</div></div>
            </form>
          </div>
        )}

        {puedeAnular && (
          <div className="card">
            <h3>Anulación</h3>
            {!confirmAnular ? (
              <button className="btn btn-danger" onClick={() => setConfirmAnular(true)}>Anular factura</button>
            ) : (
              <div className="form-grid" style={{ alignItems: 'end' }}>
                <div className="field"><label>Motivo de anulación *</label>
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: error en el pedido" /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-danger" onClick={anular} disabled={!motivo.trim()}>Confirmar anulación</button>
                  <button className="btn btn-ghost" onClick={() => setConfirmAnular(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-ghost" onClick={() => navigate('/facturas')}>Volver</button>
      </div>
      {showPreview && <FacturaPreview data={data} onCerrar={() => setShowPreview(false)} />}
    </>
  );
}