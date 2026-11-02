import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CampoClave } from '../ui.jsx';

/**
 * Cambio de contraseña obligatorio del primer ingreso.
 *
 * El backend bloquea cualquier otro endpoint mientras `debe_cambiar_clave` esté activo,
 * así que esta pantalla es el único camino posible tras un login con clave temporal.
 */
export default function CambiarClave() {
  const { user, actualizar } = useAuth();
  const nav = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/auth/cambiar-clave', { claveActual: actual, claveNueva: nueva });
      actualizar(r.user);
      setOk(true);
      const destino = r.user.tipo === 'cliente' ? '/portal' : '/';
      setTimeout(() => nav(destino, { replace: true }), 900);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={enviar}>
        <h1>FINAN·X</h1>
        <p className="sub">Cambio de contraseña obligatorio</p>

        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          Hola, <b>{user.nombre}</b>. Por seguridad, debe reemplazar la contraseña temporal
          antes de usar la aplicación. Después de cambiarla, las sesiones anteriores se cierran.
        </div>

        {ok && <div className="alert alert-success">Contraseña actualizada. Redirigiendo…</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <CampoClave
            label="Contraseña actual (temporal) *"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <CampoClave
            label="Nueva contraseña *"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="Mínimo 12 caracteres"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CampoClave
            label="Confirmar nueva contraseña *"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 0 }}>
          Mínimo 12 caracteres. No puede ser una contraseña común, ni contener su usuario,
          su correo o su nombre, ni el nombre de la aplicación.
        </p>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || ok}>
          {loading ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  );
}
