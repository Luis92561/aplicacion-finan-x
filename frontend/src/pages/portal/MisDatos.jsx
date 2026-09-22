import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api.js';
import { ErrorBox, Loading } from '../../ui.jsx';

export default function MisDatos() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/mis-datos').then(setData).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;

  const filas = [
    ['Tipo de cliente', data.tipo_cliente],
    ['Identificación', `${data.tipo_identificacion} ${data.numero_identificacion}`],
    ['Nombre o razón social', data.nombre_razon_social],
    ['Teléfono', data.telefono || '—'],
    ['Correo', data.correo || '—'],
    ['Dirección', data.direccion || '—'],
    ['Ciudad', data.ciudad || '—'],
  ];

  return (
    <>
      <div className="card">
        <h3>Mis datos</h3>
        <table style={{ maxWidth: 560 }}>
          <tbody>
            {filas.map(([k, v]) => (
              <tr key={k}><td style={{ width: 210, color: 'var(--muted)', fontWeight: 600 }}>{k}</td><td><b>{v}</b></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>
          🔒 Solo puede consultar la información asociada a su cuenta. Los datos se cargan automáticamente desde su sesión autenticada.
        </p>
      </div>
    </>
  );
}