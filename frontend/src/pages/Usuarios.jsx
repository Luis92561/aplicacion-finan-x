import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Estado, Rol, ErrorBox, Loading, FechaHora, Empty, Badge } from '../ui.jsx';

const EMPTY = { nombre: '', correo: '', username: '', rol: 'FACTURADOR', password: '', generar: true };

export default function Usuarios() {
  const [roles, setRoles] = useState([]);
  const [rows, setRows] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [temporal, setTemporal] = useState(null);

  const load = async () => {
    try {
      const [u, r] = await Promise.all([api.get('/usuarios'), api.get('/usuarios/roles')]);
      setRows(u); setRoles(r);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setTemporal(null);
    try {
      const r = await api.post('/usuarios', form);
      setShowForm(false);
      setForm(EMPTY);
      setMsg('Usuario creado. Debe cambiar la contraseña en el primer ingreso.');
      if (r.clave_temporal) setTemporal({ usuario: r.username, clave: r.clave_temporal });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const restablecer = async (u) => {
    setError(''); setMsg(''); setTemporal(null);
    try {
      const r = await api.patch(`/usuarios/${u.usuario_id}`, { generar: true });
      setMsg(`Contraseña temporal generada para ${u.username}. Se muestra una sola vez.`);
      setTemporal({ usuario: u.username, clave: r.clave_temporal });
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

        {temporal && (
          <div className="alert alert-info">
            <div><b>Contraseña temporal de {temporal.usuario}:</b> <code>{temporal.clave}</code></div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              Cópiela y entréguela por un canal seguro. El usuario deberá cambiarla al entrar y
              no se volverá a mostrar.
            </div>
          </div>
        )}

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
              <div className="field"><label>Usuario *</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="nombre.apellido" pattern="[a-zA-Z0-9._-]{3,32}" required /></div>
              <div className="field"><label>Rol *</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {roles.map((r) => <option key={r.rol_id} value={r.nombre}>{r.nombre}</option>)}
                </select></div>
              <div className="field">
                <label>Contraseña</label>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={form.generar} placeholder="Mínimo 12 caracteres" minLength={12} />
              </div>
              <div className="field" style={{ justifyContent: 'end' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={form.generar} onChange={(e) => setForm({ ...form, generar: e.target.checked })} />
                  Generar contraseña temporal
                </label>
              </div>
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
                <thead>
                  <tr>
                    <th>Nombre</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th>
                    <th>Contraseña</th><th>Creado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.usuario_id}>
                      <td><b>{u.nombre}</b></td>
                      <td>{u.username || '—'}</td>
                      <td>{u.correo}</td>
                      <td><Rol value={u.rol} /></td>
                      <td><Estado value={u.estado} /></td>
                      <td>
                        {u.debe_cambiar_clave
                          ? <Badge tone="orange">Debe cambiarla</Badge>
                          : <Badge tone="green">Actualizada</Badge>}
                      </td>
                      <td><FechaHora value={u.fecha_creacion} /></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => restablecer(u)}>Restablecer clave</button>
                        <button className={`btn btn-sm ${u.estado === 'ACTIVO' ? 'btn-warn' : 'btn-success'}`} onClick={() => toggle(u)}>
                          {u.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                        </button>
                      </td>
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
