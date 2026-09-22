import { useState } from 'react';
import api, { errMsg } from '../../api.js';
import { Money } from '../../ui.jsx';

const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE'];

/** Modal de abono/pago desde el portal del cliente (con datos según método: tarjeta/transferencia/cheque). */
export default function PagarModal({ facturaId, numeroFactura, saldoMax, onCerrar, onPagado }) {
  const [valor, setValor] = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  // Datos de pago en línea (se limpian al cambiar de método)
  const [card, setCard] = useState({ numeroTarjeta: '', codigoSeguridad: '', vencimientoTarjeta: '', banco: '', titularTarjeta: '' });
  const [transfer, setTransfer] = useState({ numeroCuenta: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);
  const [loading, setLoading] = useState(false);
  // Código de pago Efecty (efectivo): se genera para pagar en un punto Efecty, no se registra aquí
  const [codigoEfecty, setCodigoEfecty] = useState(null);
  const [genLoading, setGenLoading] = useState(false);

  const setCardF = (k) => (e) => setCard((f) => ({ ...f, [k]: e.target.value }));
  const setTransferF = (k) => (e) => setTransfer((f) => ({ ...f, [k]: e.target.value }));

  const cambiarMetodo = (m) => {
    setMetodoPago(m);
    setCard({ numeroTarjeta: '', codigoSeguridad: '', vencimientoTarjeta: '', banco: '', titularTarjeta: '' });
    setTransfer({ numeroCuenta: '' });
    setReferencia('');
    setCodigoEfecty(null);
  };

  const generarCodigoEfecty = async () => {
    setError('');
    const v = Number(valor);
    if (!(v > 0)) { setError('Indica el valor a pagar para generar el código Efecty'); return; }
    setGenLoading(true);
    try {
      const resp = await api.get('/mis-pagos/efecty-codigo', { params: { facturaId, valor: v } });
      setCodigoEfecty(resp);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setGenLoading(false);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    // Efectivo: no se registra el pago aquí; se genera el código de pago Efecty
    if (metodoPago === 'EFECTIVO') { generarCodigoEfecty(); return; }
    setError('');
    setLoading(true);
    try {
      const body = {
        facturaId,
        valor: Number(valor),
        metodoPago,
        referencia: referencia || undefined,
        observaciones: observaciones || undefined,
      };
      if (metodoPago === 'TARJETA') {
        body.numeroTarjeta = card.numeroTarjeta;
        body.codigoSeguridad = card.codigoSeguridad;
        body.vencimientoTarjeta = card.vencimientoTarjeta;
        body.banco = card.banco;
        body.titularTarjeta = card.titularTarjeta;
      } else if (metodoPago === 'TRANSFERENCIA' || metodoPago === 'CHEQUE') {
        body.banco = card.banco;
      }
      if (metodoPago === 'TRANSFERENCIA') body.numeroCuenta = transfer.numeroCuenta;
      const resp = await api.post('/mis-pagos', body);
      setOk(resp);
      onPagado && onPagado(resp);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const tarjeta = metodoPago === 'TARJETA';
  const transferencia = metodoPago === 'TRANSFERENCIA';
  const cheque = metodoPago === 'CHEQUE';
  const efectivo = metodoPago === 'EFECTIVO';
  const refObligatoria = transferencia || cheque;

  return (
    <div className="overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Pagar factura {numeroFactura || ''}</h3>
          <button type="button" className="btn-close" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>

        {ok ? (
          <div className="modal-body">
            <div className="alert alert-success">
              Pago <b>{ok.numero_pago}</b> registrado por <b><Money value={ok.valor} /></b>.
              <br />Saldo pendiente: <b><Money value={ok.saldo} /></b> ({ok.estado_pago}).
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        ) : (
          <form className="modal-body" onSubmit={enviar}>
            <div className="saldo-hint">
              Saldo pendiente de esta factura: <b><Money value={saldoMax} /></b>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Valor a abonar (COP)</label>
              <input
                type="number" min="1" step="0.01" value={valor} required
                onChange={(e) => setValor(e.target.value)} placeholder="0"
              />
              <button type="button" className="link" onClick={() => setValor(Number(saldoMax || 0))}>
                Pagar saldo completo (${Number(saldoMax || 0).toLocaleString('en-US')})
              </button>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Método de pago</label>
              <select value={metodoPago} onChange={(e) => cambiarMetodo(e.target.value)}>
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {tarjeta && (
              <>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Número de tarjeta *</label>
                  <input inputMode="numeric" autoComplete="cc-number" value={card.numeroTarjeta} onChange={setCardF('numeroTarjeta')} placeholder="4111 1111 1111 1111" required />
                </div>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Código de seguridad (CVV) *</label>
                    <input type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.codigoSeguridad} onChange={setCardF('codigoSeguridad')} placeholder="123" required />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Vencimiento (MM/AA) *</label>
                    <input inputMode="numeric" autoComplete="cc-exp" maxLength={5} value={card.vencimientoTarjeta} onChange={setCardF('vencimientoTarjeta')} placeholder="12/30" required />
                  </div>
                </div>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Banco emisor *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Bancolombia" required />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Titular de la tarjeta *</label>
                    <input autoComplete="cc-name" value={card.titularTarjeta} onChange={setCardF('titularTarjeta')} placeholder="Nombre como sale en la tarjeta" required />
                  </div>
                </div>
                <div className="alert alert-info" style={{ marginBottom: 12, fontSize: 13 }}>
                  🔒 El CVV y el número completo nunca se almacenan: solo se guardan los últimos 4 dígitos para identificar el pago.
                </div>
              </>
            )}

            {transferencia && (
              <>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Banco destino *</label>
                    <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Davivienda" required />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>N.º de cuenta *</label>
                    <input inputMode="numeric" value={transfer.numeroCuenta} onChange={setTransferF('numeroCuenta')} placeholder="4 a 20 dígitos" required />
                  </div>
                </div>
              </>
            )}

            {cheque && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Banco del cheque *</label>
                <input value={card.banco} onChange={setCardF('banco')} placeholder="Ej. Banco Popular" required />
              </div>
            )}

            {efectivo ? (
              <div className="panel-inline" style={{ border: '1.5px dashed #d97706', background: '#fffbeb', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#92400e' }}>💵 Efectivo · Pago en punto Efecty</div>
                <p style={{ fontSize: 12.5, margin: '0 0 10px', color: '#44403c' }}>
                  El efectivo no se registra aquí. Genera tu <b>código de pago Efecty</b> y cancela en
                  cualquier punto Efecty del país (vigencia <b>24 horas</b>). Al confirmarse, el pago
                  se aplica automáticamente a tu factura.
                </p>
                {codigoEfecty ? (
                  <div style={{ background: '#fff', border: '1.5px dashed #d97706', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#92400e', marginBottom: 6 }}>Tu código de pago Efecty</div>
                    <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 21, fontWeight: 800, color: '#b45309', letterSpacing: '.04em', wordBreak: 'break-all' }}>
                      {codigoEfecty.codigo}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#78716c', marginTop: 6 }}>
                      Factura {codigoEfecty.numero_factura} · <Money value={codigoEfecty.valor} /> ·
                      válido hasta {new Date(Date.now() + 24 * 3600e3).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
                      <button type="button" className="btn" onClick={() => { try { navigator.clipboard?.writeText(codigoEfecty.codigo); } catch { /* sin portapapeles */ } }}>
                        📋 Copiar código
                      </button>
                      <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={() => setCodigoEfecty(null)}>
                        Generar otro código
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={genLoading} onClick={generarCodigoEfecty}>
                    {genLoading ? 'Generando código…' : 'Generar código de pago Efecty'}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>
                    Referencia{refObligatoria ? ' (n.º de comprobante / cheque) *' : ' (opcional)'}
                  </label>
                  <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={refObligatoria ? 'N.º de comprobante o cheque' : 'N.º de recibo, comprobante o giro'} required={refObligatoria} />
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Observaciones (opcional)</label>
                  <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del cliente" />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Procesando pago…' : 'Registrar pago'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}