import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

export default function Auditoria() {
  const [rows, setRows] = useState(null);
  const [filtros, setFiltros] = useState({ modulo: '', usuario: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/auditoria', { params: { ...filtros, limit: 200 } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <div className="topbar"><h2>Auditoría</h2><div className="crumb">Trazabilidad de operaciones</div></div>
      <div className="content">
        <ErrorBox msg={error} />

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={filtros.modulo} onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value })} placeholder="Módulo (Clientes, Pagos…)" />
            <input value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} placeholder="Usuario" />
            <button className="btn btn-ghost" type="submit">Filtrar</button>
          </form>
        </div>

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Fecha/hora</th><th>Usuario</th><th>Tipo</th><th>Módulo</th><th>Operación</th><th>Registro</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.auditoria_id}>
                      <td><FechaHora value={a.fecha_hora} /></td>
                      <td>{a.usuario || '—'}</td>
                      <td>{a.usuario_tipo}</td>
                      <td>{a.modulo}</td>
                      <td><b>{a.operacion}</b></td>
                      <td>{a.registro_afectado || '—'}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 260 }}>{a.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}