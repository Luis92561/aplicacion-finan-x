import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';

const ID_TIPOS = ['CC', 'CE', 'NIT', 'PASAPORTE'];

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'registro' | 'recuperar'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reg, setReg] = useState({
    tipoCliente: 'PERSONA',
    tipoIdentificacion: 'CC',
    numeroIdentificacion: '',
    nombreRazonSocial: '',
    telefono: '',
    correo: '',
    direccion: '',
    ciudad: '',
    regUsername: '',
    regPassword: '',
    confirm: '',
  });
  // Recuperación de contraseña (código de un solo uso enviado por SMS o correo)
  const [recov, setRecov] = useState({ username: '', canal: 'EMAIL', codigo: '', nuevaClave: '', confirm: '' });
  const [recovStep, setRecovStep] = useState('solicitar'); // 'solicitar' | 'codigo'
  const [recovInfo, setRecovInfo] = useState(null); // { mensaje, demo_otp?, destino?, canal? }
  const [recovOk, setRecovOk] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setReg((f) => ({ ...f, [k]: e.target.value }));
  const setR = (k) => (e) => setRecov((f) => ({ ...f, [k]: e.target.value }));

  const entrar = (user, token) => {
    login(user, token);
    navigate(user.tipo === 'cliente' ? '/portal' : '/', { replace: true });
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.post('/auth/login', { username, password });
      entrar(user, token);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const submitRegistro = async (e) => {
    e.preventDefault();
    setError('');
    if (reg.regPassword !== reg.confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      const { token, user } = await api.post('/auth/registro', {
        tipoCliente: reg.tipoCliente,
        tipoIdentificacion: reg.tipoIdentificacion,
        numeroIdentificacion: reg.numeroIdentificacion,
        nombreRazonSocial: reg.nombreRazonSocial,
        telefono: reg.telefono || undefined,
        correo: reg.correo || undefined,
        direccion: reg.direccion || undefined,
        ciudad: reg.ciudad || undefined,
        username: reg.regUsername,
        password: reg.regPassword,
      });
      entrar(user, token);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const submitSolicitar = async (e) => {
    e.preventDefault();
    setError('');
    if (!recov.username) { setError('Indique su usuario o correo'); return; }
    setLoading(true);
    try {
      const resp = await api.post('/auth/recuperar-solicitar', { username: recov.username, canal: recov.canal });
      setRecovInfo(resp);
      setRecovStep('codigo');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const submitCambiar = async (e) => {
    e.preventDefault();
    setError('');
    if (recov.nuevaClave !== recov.confirm) { setError('Las contraseñas no coinciden'); return; }
    if (recov.nuevaClave.length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      const resp = await api.post('/auth/recuperar-cambiar', {
        username: recov.username,
        codigo: recov.codigo,
        nuevaClave: recov.nuevaClave,
      });
      setRecovOk(resp.mensaje || 'Contraseña actualizada.');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => { setError(''); setMode(m); };
  const abrirRecuperar = () => { setError(''); setRecov({ username, canal: 'EMAIL', codigo: '', nuevaClave: '', confirm: '' }); setRecovInfo(null); setRecovOk(''); setRecovStep('solicitar'); setMode('recuperar'); };

  return (
    <div className="login-wrap">
      {mode === 'login' ? (
        <form className="login-card" onSubmit={submitLogin}>
          <h1>FINAN·X</h1>
          <p className="sub">Ingrese a su cuenta de facturación y pagos</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Usuario o correo</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario@empresa.com" autoComplete="username" required />
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="link" onClick={abrirRecuperar}>¿Olvidaste tu contraseña?</button>
          </div>
          <div className="login-hint">
            <strong>Credenciales demo:</strong><br />
            Interno: <code>admin@finanx.test</code> / <code>admin123</code><br />
            Cliente: <code>cliente@finanx.test</code> / <code>cliente123</code>
          </div>
          <div className="login-switch">
            ¿Eres cliente nuevo?{' '}
            <button type="button" className="link" onClick={() => switchMode('registro')}>Crear cuenta</button>
          </div>
        </form>
      ) : mode === 'registro' ? (
        <form className="login-card" onSubmit={submitRegistro}>
          <h1>FINAN·X</h1>
          <p className="sub">Crea tu cuenta de cliente en minutos</p>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Tipo de cliente</label>
            <select value={reg.tipoCliente} onChange={set('tipoCliente')}>
              <option value="PERSONA">Persona natural</option>
              <option value="EMPRESA">Empresa</option>
            </select>
          </div>
          <div className="row2">
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Tipo de identificación</label>
              <select value={reg.tipoIdentificacion} onChange={set('tipoIdentificacion')}>
                {ID_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Número de identificación</label>
              <input value={reg.numeroIdentificacion} onChange={set('numeroIdentificacion')} placeholder="123456789" required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Nombre / Razón social</label>
            <input value={reg.nombreRazonSocial} onChange={set('nombreRazonSocial')} placeholder="Nombre completo o empresa" required />
          </div>
          <div className="row2">
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Correo (opcional)</label>
              <input type="email" value={reg.correo} onChange={set('correo')} placeholder="correo@ejemplo.com" />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Teléfono (opcional)</label>
              <input value={reg.telefono} onChange={set('telefono')} placeholder="3001234567" />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Ciudad (opcional)</label>
            <input value={reg.ciudad} onChange={set('ciudad')} placeholder="Bogotá" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Dirección (opcional)</label>
            <input value={reg.direccion} onChange={set('direccion')} placeholder="Calle 10 # 5-20" />
          </div>

          <div className="divider">Credenciales de acceso al portal</div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Usuario</label>
            <input value={reg.regUsername} onChange={set('regUsername')} placeholder="mi.usuario" autoComplete="username" required />
          </div>
          <div className="row2">
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Contraseña</label>
              <input type="password" value={reg.regPassword} onChange={set('regPassword')} placeholder="Mínimo 6 caracteres" autoComplete="new-password" required />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Confirmar contraseña</label>
              <input type="password" value={reg.confirm} onChange={set('confirm')} placeholder="Repítela" autoComplete="new-password" required />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta e ingresar'}
          </button>
          <div className="login-switch">
            ¿Ya tienes cuenta?{' '}
            <button type="button" className="link" onClick={() => switchMode('login')}>Iniciar sesión</button>
          </div>
        </form>
      ) : (
        <div className="login-card">
          <h1>FINAN·X</h1>
          <p className="sub">Recupera tu contraseña con un código de seguridad</p>
          {recovOk ? (
            <>
              <div className="alert alert-success">{recovOk}</div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => switchMode('login')}>
                Volver a iniciar sesión
              </button>
            </>
          ) : recovStep === 'solicitar' ? (
            <form onSubmit={submitSolicitar}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Usuario o correo</label>
                <input value={recov.username} onChange={setR('username')} placeholder="mi.usuario o correo registrado" autoComplete="username" required />
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>¿Dónde recibes tu código de seguridad?</label>
                <select value={recov.canal} onChange={setR('canal')}>
                  <option value="EMAIL">Correo electrónico</option>
                  <option value="SMS">SMS (teléfono)</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar código de seguridad'}
              </button>
              {recovInfo && (
                <div className="alert alert-info" style={{ marginTop: 12 }}>
                  {recovInfo.mensaje}
                  {recovInfo.destino ? <> Se envió a <b>{recovInfo.destino}</b></> : null}
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={submitCambiar}>
              {error && <div className="alert alert-error">{error}</div>}
              {recovInfo && (
                <div className="alert alert-info">
                  {recovInfo.mensaje}
                  {recovInfo.destino ? <> Se envió a <b>{recovInfo.destino}</b></> : null}
                </div>
              )}
              {recovInfo?.demo_otp && (
                <div className="alert alert-info">
                  <b>Entorno de demostración:</b> tu código es <b>{recovInfo.demo_otp}</b>. En producción se enviaría por {recovInfo.canal === 'SMS' ? 'SMS' : 'correo electrónico'}.
                </div>
              )}
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Código de seguridad (6 dígitos)</label>
                <input value={recov.codigo} onChange={setR('codigo')} placeholder="123456" inputMode="numeric" maxLength={6} required />
              </div>
              <div className="row2">
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Nueva contraseña</label>
                  <input type="password" value={recov.nuevaClave} onChange={setR('nuevaClave')} placeholder="Mínimo 6 caracteres" autoComplete="new-password" required />
                </div>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Confirmar contraseña</label>
                  <input type="password" value={recov.confirm} onChange={setR('confirm')} placeholder="Repítela" autoComplete="new-password" required />
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </form>
          )}
          <div className="login-switch">
            <button type="button" className="link" onClick={() => switchMode('login')}>← Volver a iniciar sesión</button>
          </div>
        </div>
      )}
    </div>
  );
}