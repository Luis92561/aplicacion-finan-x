import { Money, Estado, Fecha } from '../ui.jsx';

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(v || 0));

/**
 * FacturaPreview — previsualización imprimible de una factura (detalle completo).
 * Props: data (objeto de GET /facturas/:id), onCerrar().
 * Incluye: impresión (window.print con CSS @media print) y envío por correo (mailto).
 */
export default function FacturaPreview({ data, onCerrar }) {
  const to = data.correo || '';

  const cuerpoLineas = () => {
    const L = [];
    L.push(`FACTURA ${data.numero_factura} — FINAN-X`);
    L.push(`Pedido: ${data.numero_pedido || '—'}`);
    L.push('');
    L.push('DATOS DEL CLIENTE');
    L.push(`Cliente: ${data.nombre_razon_social}`);
    L.push(`Identificación: ${data.numero_identificacion}`);
    if (data.direccion) L.push(`Dirección: ${data.direccion}`);
    if (data.ciudad) L.push(`Ciudad: ${data.ciudad}`);
    if (data.correo) L.push(`Correo: ${data.correo}`);
    if (data.telefono) L.push(`Teléfono: ${data.telefono}`);
    L.push('');
    L.push('DETALLE');
    for (const l of data.lineas || []) {
      L.push(`  ${l.codigo} · ${l.producto_nombre} · ${l.cantidad} × ${fmt(l.precio_unitario)} = ${fmt(l.subtotal)}`);
    }
    L.push('');
    L.push(`Subtotal: ${fmt(data.subtotal)}`);
    L.push(`Impuestos: ${fmt(data.impuestos)}`);
    L.push(`TOTAL: ${fmt(data.total)}`);
    L.push('');
    L.push(`Pagado: ${fmt(data.valor_pagado)}`);
    L.push(`Saldo pendiente: ${fmt(data.saldo)}`);
    L.push(`Estado: ${data.estado} / ${data.estado_pago}`);
    if (data.notas_credito?.length) {
      L.push('');
      L.push('NOTAS DE CRÉDITO');
      for (const n of data.notas_credito) {
        if (n.estado === 'ACTIVA') L.push(`  ${n.numero_nota} · ${fmt(n.valor)} · ${n.motivo}`);
      }
    }
    L.push('');
    L.push('FINAN-X — Facturación y pagos');
    return L.join('\n');
  };

  const mailto = to
    ? `mailto:${to}?subject=${encodeURIComponent(`Factura ${data.numero_factura} · FINAN-X`)}&body=${encodeURIComponent(cuerpoLineas())}`
    : null;

  return (
    <div className="overlay" style={{ zIndex: 60 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal" style={{ maxWidth: 760, width: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head no-print">
          <h3>Vista previa · {data.numero_factura}</h3>
          <button className="btn-close" onClick={onCerrar}>×</button>
        </div>

        <div className="modal-body" style={{ overflow: 'auto', padding: 0 }}>
          <div className="print-area" style={{ padding: 26, fontSize: 13.5 }}>
            {/* Encabezado */}
            <table style={{ width: '100%', borderBottom: '2px solid #000', marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>FINAN·X</div>
                    <div style={{ opacity: 0.7 }}>Facturación y pagos</div>
                    <div style={{ opacity: 0.7, marginTop: 2 }}>NIT 900.000.000-1 · Bogotá, Colombia</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{data.numero_factura}</div>
                    <div style={{ opacity: 0.7 }}>Emisión: <Fecha value={data.fecha_emision} /></div>
                    <div style={{ opacity: 0.7 }}>Vencimiento: <Fecha value={data.fecha_vencimiento} /></div>
                    <div style={{ marginTop: 4 }}><Estado value={data.estado_pago} /></div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td style={{ width: '55%', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>FACTURAR A</div>
                    <div>{data.nombre_razon_social}</div>
                    <div>{data.numero_identificacion}</div>
                    {data.direccion && <div>{data.direccion}</div>}
                    {data.ciudad && <div>{data.ciudad}</div>}
                    {data.correo && <div>{data.correo}</div>}
                    {data.telefono && <div>{data.telefono}</div>}
                  </td>
                  <td style={{ width: '45%', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>PEDIDO</div>
                    <div>{data.numero_pedido || '—'}</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>CONDICIÓN DE PAGO</div>
                    <div>Contado / Crédito a {fechaVenc(data)}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Líneas */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
              <thead>
                <tr style={{ background: '#f1f3f5' }}>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'left' }}>Código</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'left' }}>Descripción</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>Cant.</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>Precio unitario</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>IVA</th>
                  <th style={{ border: '1px solid #ccc', padding: '7px 9px', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(data.lineas || []).map((l, i) => (
                  <tr key={i}>
                    <td style={td}>{l.codigo}</td>
                    <td style={td}>{l.producto_nombre}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.cantidad}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(l.precio_unitario)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.impuesto}%</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td />
                  <td style={{ width: 230, padding: '3px 6px' }}>Subtotal</td>
                  <td style={{ width: 130, padding: '3px 6px', textAlign: 'right' }}>{fmt(data.subtotal)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px' }}>Impuestos</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(data.impuestos)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px', fontWeight: 800 }}>TOTAL</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800 }}>{fmt(data.total)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px' }}>Pagado</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(data.valor_pagado)}</td>
                </tr>
                <tr><td />
                  <td style={{ padding: '3px 6px', fontWeight: 700 }}>Saldo pendiente</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>{fmt(data.saldo)}</td>
                </tr>
              </tbody>
            </table>

            {(data.notas_credito || []).length > 0 && (
              <table style={{ width: '100%', marginTop: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left', background: '#f1f3f5' }} colSpan={4}>Notas de crédito</th></tr>
                </thead>
                <tbody>
                  {(data.notas_credito || []).map((n) => (
                    <tr key={n.nota_credito_id}>
                      <td style={{ ...td, width: 130 }}>{n.numero_nota}</td>
                      <td style={td}>{n.estado}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmt(n.valor)}</td>
                      <td style={td}>{n.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 18, fontSize: 11.5, opacity: 0.65, textAlign: 'center' }}>
              Documento generado por FINAN-X · Pedido {data.numero_pedido || '—'} · {new Date().toLocaleString('es-CO')}
            </div>
          </div>
        </div>

        <div className="modal-foot no-print" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {mailto && (
            <a className="btn btn-primary" href={mailto} style={{ textDecoration: 'none' }}>✉ Enviar por correo</a>
          )}
          <button className="btn btn-success" onClick={() => window.print()}>🖨 Imprimir</button>
          <button className="btn btn-ghost" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function fechaVenc(data) {
  if (!data.fecha_vencimiento) return '—';
  return new Date(data.fecha_vencimiento).toLocaleDateString('es-CO');
}

const td = { border: '1px solid #ccc', padding: '6px 9px', textAlign: 'left' };