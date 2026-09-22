import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Estado, ErrorBox, Loading, FechaHora, Empty } from '../ui.jsx';

const EMPTY = { nombre: '', correo: '', rol: 'FACTURADOR', password: '' };

export default function Usuarios() {
  const [roles, setRoles] = useState([]);
  const [rows, setRows] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const [u, r] = await Promise.all([api.get('/usuarios'), api.get('/usuarios/roles')]);
      setRows(u); setRoles(r);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.post('/usuarios', form);
      setShowForm(false); setForm(EMPTY);
      setMsg('Usuario creado');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggle = async (u) => {
    try {
      await api.patch(`/usuarios/${u.usuario_id}`, { estado: u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <div className="topbar"><h2>Usuarios internos</h2><div className="crumb">Solo administrador</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <div className="spacer" />
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Nuevo usuario</button>
        </div>

        {showForm && (
          <div className="card">
            <h3>Crear usuario interno</h3>
            <form onSubmit={crear} className="form-grid">
              <div className="field"><label>Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
              <div className="field"><label>Correo *</label>
                <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} required /></div>
              <div className="field"><label>Rol *</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {roles.map((r) => <option key={r.rol_id} value={r.nombre}>{r.nombre}</option>)}
                </select></div>
              <div className="field"><label>Contraseña *</label>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.usuario_id}>
                      <td><b>{u.nombre}</b></td>
                      <td>{u.correo}</td>
                      <td><Estado value={u.rol === 'ADMIN' ? 'CONFIRMADO' : u.rol === 'SUPERVISOR' ? 'FACTURADO' : u.rol === 'CAJERO' ? 'PAGO_PARCIAL' : 'ACTIVO'} /> {u.rol}</td>
                      <td><Estado value={u.estado} /></td>
                      <td><FechaHora value={u.fecha_creacion} /></td>
                      <td><button className={`btn btn-sm ${u.estado === 'ACTIVO' ? 'btn-warn' : 'btn-success'}`} onClick={() => toggle(u)}>{u.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}</button></td>
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