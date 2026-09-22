import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Money, Section, FechaHora, Estado, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Dashboard() {
  const [resumen, setResumen] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [r, a] = await Promise.all([api.get('/reportes/resumen'), api.get('/auditoria', { params: { limit: 8 } })]);
        setResumen(r);
        setRecientes(a);
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, []);

  if (error) return <div className="content"><ErrorBox msg={error} /></div>;
  if (!resumen) return <div className="content"><Loading /></div>;

  return (
    <>
      <div className="topbar"><h2>Inicio</h2></div>
      <div className="content">
        <div className="grid-cards">
          <div className="stat"><div className="label">Clientes activos</div><div className="value">{resumen.clientes_activos}</div></div>
          <div className="stat"><div className="label">Productos activos</div><div className="value">{resumen.productos_activos}</div></div>
          <div className="stat"><div className="label">Pedidos totales</div><div className="value">{resumen.total_pedidos}</div></div>
          <div className="stat"><div className="label">Por facturar</div><div className="value warn">{resumen.pedidos_por_facturar}</div></div>
          <div className="stat"><div className="label">Facturas activas</div><div className="value">{resumen.facturas_activas}</div></div>
          <div className="stat"><div className="label">Cuentas por cobrar</div><div className="value red"><Money value={resumen.saldo_pendiente_total} /></div></div>
          <div className="stat"><div className="label">Pagos recibidos</div><div className="value green"><Money value={resumen.pagos_recibidos} /></div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Section title="Acciones rápidas">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" to="/pedidos/nuevo">+ Nuevo pedido</Link>
              <Link className="btn btn-ghost" to="/clientes">Clientes</Link>
              <Link className="btn btn-ghost" to="/productos">Productos</Link>
              <Link className="btn btn-ghost" to="/facturas">Facturas</Link>
            </div>
          </Section>
          <Section title="Operaciones recientes (auditoría)">
            {recientes.length === 0 ? <Empty /> : (
              <table>
                <thead><tr><th>Fecha</th><th>Módulo</th><th>Operación</th><th>Descripción</th></tr></thead>
                <tbody>
                  {recientes.map((a) => (
                    <tr key={a.auditoria_id}>
                      <td><FechaHora value={a.fecha_hora} /></td>
                      <td>{a.modulo}</td>
                      <td><Estado value={a.operacion === 'REGISTRAR' ? 'PAGO_PARCIAL' : a.operacion} /></td>
                      <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}