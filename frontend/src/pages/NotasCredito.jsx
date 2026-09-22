import { useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, Estado, FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

const CPU = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(v || 0));

export default function NotasCredito() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Crear
  const [showCrear, setShowCrear] = useState(false);
  const [facturas, setFacturas] = useState(null);
  const [form, setForm] = useState({ facturaId: '', valor: '', motivo: '' });
  const [creando, setCreando] = useState(false);

  // Anular
  const [anularNota, setAnularNota] = useState(null);
  const [motivoAnul, setMotivoAnul] = useState('');

  const load = async () => {
    try {
      setRows(await api.get('/notas-credito', { params: { q, estado } }));
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const abrirCrear = async () => {
    setError(''); setMsg(''); setForm({ facturaId: '', valor: '', motivo: '' });
    try {
      const fs = await api.get('/facturas', { params: { estado: 'ACTIVA' } });
      // Solo facturas con algo pagado disponible para devolver
      setFacturas(fs.filter((f) => Number(f.valor_pagado) - Number(f.notas_credito || 0) > 0));
      setShowCrear(true);
    } catch (e) { setError(errMsg(e)); }
  };

  const facturaSel = useMemo(
    () => facturas?.find((f) => String(f.factura_id) === String(form.facturaId)),
    [facturas, form.facturaId]
  );
  const disponible = facturaSel ? Math.max(0, Number(facturaSel.valor_pagado) - Number(facturaSel.notas_credito || 0)) : 0;

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setCreando(true);
    try {
      const r = await api.post('/notas-credito', { facturaId: Number(form.facturaId), valor: Number(form.valor), motivo: form.motivo });
      setMsg(`Nota ${r.numero_nota} creada por ${CPU(r.valor)} · disponible para devolver ${CPU(r.saldo_restante_devolver)}`);
      setShowCrear(false);
      await load();
    } catch (err) { setError(errMsg(err)); } finally { setCreando(false); }
  };

  const anular = async () => {
    setError(''); setMsg('');
    try {
      await api.post(`/notas-credito/${anularNota.nota_credito_id}/anular`, { motivo: motivoAnul });
      setMsg(`Nota ${anularNota.numero_nota} anulada (queda en historial para auditoría)`);
      setAnularNota(null); setMotivoAnul('');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <div className="topbar"><h2>Notas de crédito</h2><div className="crumb">Devoluciones sobre facturas</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nota, factura o cliente" style={{ width: 260 }} />
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Estado</option>
              <option value="ACTIVA">Activa</option>
              <option value="ANULADA">Anulada</option>
            </select>
            <button className="btn" type="submit">Filtrar</button>
          </form>
          <div className="spacer" />
          <button className="btn btn-success" onClick={abrirCrear}>+ Nueva nota de crédito</button>
        </div>

        <div className="card">
          <h3>Notas de crédito</h3>
          {!rows ? <Loading /> : rows.length === 0 ? <Empty text="Sin notas de crédito" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nota</th><th>Factura</th><th>Cliente</th><th>Fecha</th><th className="num">Valor</th><th>Motivo</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((n) => (
                    <tr key={n.nota_credito_id}>
                      <td><b>{n.numero_nota}</b></td>
                      <td>{n.numero_factura}</td>
                      <td>{n.nombre_razon_social} · {n.numero_identificacion}</td>
                      <td><FechaHora value={n.fecha} /></td>
                      <td className="num"><Money value={n.valor} /></td>
                      <td style={{ maxWidth: 220 }}>{n.motivo}</td>
                      <td><Estado value={n.estado} /></td>
                      <td>
                        {n.estado === 'ACTIVA' && (
                          <button className="btn btn-sm btn-danger" onClick={() => { setAnularNota(n); setMotivoAnul(''); }}>Anular</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCrear && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCrear(false); }}>
          <div className="modal">
            <div className="modal-head">
              <h3>Nueva nota de crédito (devolución)</h3>
              <button className="btn-close" onClick={() => setShowCrear(false)}>×</button>
            </div>
            <div className="modal-body">
              {!facturas ? <Loading /> : facturas.length === 0 ? (
                <div className="empty">No hay facturas activas con pagos que devolver.</div>
              ) : (
                <form onSubmit={crear}>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="field">
                      <label>Factura a devolver *</label>
                      <select value={form.facturaId} onChange={(e) => setForm({ ...form, facturaId: e.target.value })} required>
                        <option value="">Seleccione…</option>
                        {facturas.map((f) => (
                          <option key={f.factura_id} value={f.factura_id}>
                            {f.numero_factura} · {f.nombre_razon_social} · total {CPU(f.total)} · pagado {CPU(f.valor_pagado)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {facturaSel && (
                      <div className="field">
                        <label>Disponible para devolver</label>
                        <div style={{ padding: '9px 0', fontWeight: 800, color: disponible > 0 ? 'var(--success)' : 'var(--danger)' }}>{CPU(disponible)}</div>
                      </div>
                    )}
                    <div className="field">
                      <label>Valor a devolver *</label>
                      <input type="number" min="0.01" step="any" max={disponible || undefined}
                        value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label>Motivo de la devolución *</label>
                      <textarea rows={3} value={form.motivo}
                        onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                        placeholder="Ej.: mercancía devuelta en mal estado, cambio de producto…" required />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button className="btn btn-ghost" type="button" onClick={() => setShowCrear(false)}>Cancelar</button>
                    <button className="btn btn-success" type="submit" disabled={creando || Number(form.valor) > disponible || !(Number(form.valor) > 0)}>
                      {creando ? 'Creando…' : 'Registrar nota de crédito'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {anularNota && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setAnularNota(null); }}>
          <div className="modal">
            <div className="modal-head">
              <h3>Anular {anularNota.numero_nota}</h3>
              <button className="btn-close" onClick={() => setAnularNota(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ opacity: 0.8, marginBottom: 12 }}>
                Se anulará la nota de crédito de <b>{CPU(anularNota.valor)}</b> ({anularNota.numero_factura}).
                Quedará conservada en el historial y la auditoría; el valor vuelve a quedar disponible en la factura.
              </p>
              <div className="field"><label>Motivo de anulación *</label>
                <input value={motivoAnul} onChange={(e) => setMotivoAnul(e.target.value)} placeholder="Ej.: error en el registro de la devolución" /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setAnularNota(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={anular} disabled={!motivoAnul.trim()}>Confirmar anulación</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}