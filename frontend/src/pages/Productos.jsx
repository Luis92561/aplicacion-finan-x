import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';
import { Money, Estado, ErrorBox, Loading, Empty } from '../ui.jsx';

const EMPTY = { codigo: '', nombre: '', descripcion: '', categoria: '', precio: '', impuesto: 0, unidadMedida: 'UND' };

export default function Productos() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const data = await api.get('/productos', { params: { q, estado } });
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (r) => {
    setEdit(r.producto_id);
    setForm({
      codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion || '', categoria: r.categoria || '',
      precio: r.precio, impuesto: r.impuesto, unidadMedida: r.unidad_medida,
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      if (edit) await api.put(`/productos/${edit}`, form);
      else await api.post('/productos', form);
      setShowForm(false);
      setMsg(edit ? 'Producto actualizado' : 'Producto registrado');
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggleEstado = async (r) => {
    try {
      await api.patch(`/productos/${r.producto_id}/estado`, { estado: r.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' });
      await load();
    } catch (err) { setError(errMsg(err)); }
  };

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="topbar"><h2>Productos</h2><div className="crumb">Catálogo de productos</div></div>
      <div className="content">
        <ErrorBox msg={error} />
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="toolbar">
          <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nombre o descripción" style={{ width: 300 }} />
            <select value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Todos</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option>
            </select>
            <button className="btn btn-ghost" type="submit">Buscar</button>
          </form>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo producto</button>
        </div>

        {showForm && (
          <div className="card">
            <h3>{edit ? 'Editar producto' : 'Registrar producto'}</h3>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field"><label>Código *</label>
                  <input value={form.codigo} onChange={upd('codigo')} required disabled={!!edit} /></div>
                <div className="field"><label>Nombre *</label>
                  <input value={form.nombre} onChange={upd('nombre')} required /></div>
                <div className="field"><label>Categoría</label>
                  <input value={form.categoria} onChange={upd('categoria')} /></div>
                <div className="field"><label>Precio *</label>
                  <input type="number" min="0" step="0.01" value={form.precio} onChange={upd('precio')} required /></div>
                <div className="field"><label>Impuesto (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.impuesto} onChange={upd('impuesto')} /></div>
                <div className="field"><label>Unidad de medida</label>
                  <select value={form.unidadMedida} onChange={upd('unidadMedida')}>
                    <option value="UND">Unidad</option><option value="HORA">Hora</option>
                    <option value="KG">Kilogramo</option><option value="M">Metro</option><option value="CAJA">Caja</option>
                  </select></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Descripción</label>
                  <textarea value={form.descripcion} onChange={upd('descripcion')} /></div>
              </div>
              <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          {rows === null ? <Loading /> : rows.length === 0 ? <Empty text="No hay productos" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th className="num">Precio</th><th className="num">Impuesto</th><th>Unidad</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.producto_id}>
                      <td>{r.codigo}</td>
                      <td><b>{r.nombre}</b></td>
                      <td>{r.categoria || '—'}</td>
                      <td className="num"><Money value={r.precio} /></td>
                      <td className="num">{r.impuesto}%</td>
                      <td>{r.unidad_medida}</td>
                      <td><Estado value={r.estado} /></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Editar</button>
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
      </div>
    </>
  );
}