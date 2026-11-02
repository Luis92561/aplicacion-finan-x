import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Money, Estado, Badge, FechaHora, ErrorBox, Loading, Empty } from '../ui.jsx';

const EMPTY = { tipoCliente: 'PERSONA', tipoIdentificacion: 'CC', numeroIdentificacion: '', nombreRazonSocial: '', telefono: '', correo: '', direccion: '', ciudad: '' };

export default function Clientes() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [cuenta, setCuenta] = useState({ username: '' });
  const [cuentaPara, setCuentaPara] = useState(null);
  const [temporal, setTemporal] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/clientes', { params: { q, estado } });
      setRows(data);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const search = (e) => { e.preventDefault(); load(); };

  const openNew = () => { setEdit(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (r) => {
    setEdit(r.cliente_id);
    setForm({
      tipoCliente: r.tipo_cliente, tipoIdentificacion: r.tipo_identificacion,
      numeroIdentificacion: r.numero_identificacion, nombreRazonSocial: r.nombre_razon_social,
      telefono: r.telefono || '', correo: r.correo || '', direccion: r.direccion || '', ciudad: r.ciudad || '',
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      if (edit) await api.put(`/clientes/${edit}`, form);
      else await api.post('/clientes', form);
      setShowForm(false);
      setMsg(edit ? 'Cliente actualizado' : 'Cliente registrado');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggleEstado = async (r) => {
    try {
      await api.patch(`/clientes/${r.cliente_id}/estado`, { estado: r.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const crearCuenta = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setTemporal(null);
    try {
      const res = await api.post(`/clientes/${cuentaPara}/cuenta`, cuenta);
      setCuentaPara(null); setCuenta({ username: '' });
      setMsg('Cuenta de acceso creada. El cliente debe cambiar la contraseña al entrar.');
      if (res.clave_temporal) setTemporal({ usuario: res.username, clave: res.clave_temporal });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const enviarEstado = async (r) => {
    setError(''); setMsg('');
    try {
      const res = await api.get(`/clientes/${r.cliente_id}/resumen-correo`);
      if (!res.destinatario) { setError(`${r.nombre_razon_social} no tiene correo registrado`); return; }
      window.location.href = `mailto:${encodeURIComponent(res.destinatario)}?subject=${encodeURIComponent(res.asunto)}&body=${encodeURIComponent(res.cuerpo)}`;
      setMsg(`Se abrió su programa de correo con el estado financiero de ${r.nombre_razon_social} (${res.destinatario})`);
    } catch (err) { setError(errMsg(err)); }
  };

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="topbar"><h2>Clientes</h2><div className="crumb">Gestión de clientes y cuentas de acceso</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <form onSubmit={search} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o NIT" style={{ width: 300 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo cliente</button>
        </div>

        {showForm && (
          <div className="card">
            <h3>{edit ? 'Editar cliente' : 'Registrar cliente'}</h3>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field"><label>Tipo de cliente</label>
                  <select value={form.tipoCliente} onChange={upd('tipoCliente')}>
                    <option value="PERSONA">Persona</option><option value="EMPRESA">Empresa</option>
                  </select></div>
                <div className="field"><label>Tipo de identificación</label>
                  <select value={form.tipoIdentificacion} onChange={upd('tipoIdentificacion')}>
                    <option value="CC">Cédula</option><option value="NIT">NIT</option>
                    <option value="CE">Cédula extranjería</option><option value="PASAPORTE">Pasaporte</option>
                  </select></div>
                <div className="field"><label>N.º de identificación *</label>
                  <input value={form.numeroIdentificacion} onChange={upd('numeroIdentificacion')} required /></div>
                <div className="field"><label>Nombre o razón social *</label>
                  <input value={form.nombreRazonSocial} onChange={upd('nombreRazonSocial')} required /></div>
                <div className="field"><label>Teléfono</label>
                  <input value={form.telefono} onChange={upd('telefono')} /></div>
                <div className="field"><label>Correo</label>
                  <input type="email" value={form.correo} onChange={upd('correo')} /></div>
                <div className="field"><label>Dirección</label>
                  <input value={form.direccion} onChange={upd('direccion')} /></div>
                <div className="field"><label>Ciudad</label>
                  <input value={form.ciudad} onChange={upd('ciudad')} /></div>
              </div>
              <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay clientes" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Identificación</th><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Ciudad</th><th>Estado</th><th>Cuenta</th><th className="num">Saldo pendiente</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cliente_id}>
                      <td>{r.tipo_identificacion} {r.numero_identificacion}</td>
                      <td><b>{r.nombre_razon_social}</b></td>
                      <td>{r.telefono || '—'}</td>
                      <td>{r.correo || '—'}</td>
                      <td>{r.ciudad || '—'}</td>
                      <td><Estado value={r.estado} /></td>
                      <td>{r.tiene_cuenta ? <Badge tone="green">Cuenta</Badge> : (user?.rol === 'ADMIN'
                        ? <button className="btn btn-ghost btn-sm" onClick={() => { setCuentaPara(r.cliente_id); setCuenta({ username: '' }); }}>Crear cuenta</button>
                        : <span className="muted">—</span>)}</td>
                      <td className="num"><Money value={r.saldo_pendiente} /></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => enviarEstado(r)} disabled={!r.correo} title={!r.correo ? 'El cliente no tiene correo' : 'Enviar estado financiero por correo'}>
                            ✉ Estado
                          </button>
                          <button className={`btn btn-sm ${r.estado === 'ACTIVO' ? 'btn-warn' : 'btn-success'}`} onClick={() => toggleEstado(r)}>
                            {r.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {temporal && (
          <div className="alert alert-info">
            <div><b>Contraseña temporal de {temporal.usuario}:</b> <code>{temporal.clave}</code></div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              Se muestra una sola vez. El cliente deberá cambiarla en su primer ingreso.
            </div>
          </div>
        )}

        {cuentaPara != null && (
          <div className="card">
            <h3>Crear cuenta de acceso del cliente</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
              Se generará una contraseña temporal que se muestra una sola vez. El cliente
              deberá cambiarla al entrar al portal.
            </p>
            <form onSubmit={crearCuenta} className="form-grid">
              <div className="field"><label>Usuario *</label>
                <input value={cuenta.username} onChange={(e) => setCuenta({ ...cuenta, username: e.target.value })}
                  pattern="[a-zA-Z0-9._-]{3,32}" placeholder="nombre.apellido" required /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" type="submit">Crear</button>
                <button className="btn btn-ghost" type="button" onClick={() => setCuentaPara(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}