import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);

/**
 * Sesión del usuario.
 *
 * El estado ya no se guarda en localStorage: al cargar la aplicación se pregunta al
 * servidor (`/auth/sesion`) quién está autenticado, leyendo la cookie HttpOnly. Así el
 * navegador nunca tiene el token en un sitio accesible para JavaScript.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    api.get('/auth/sesion')
      .then((r) => { if (vivo) setUser(r.user); })
      .catch(() => { if (vivo) setUser(null); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const login = (u) => setUser(u);
  const actualizar = (u) => setUser(u);

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* la sesión pudo expirar */ }
    setUser(null);
  };

  if (cargando) {
    return <div className="session-loading">Cargando FINAN-X…</div>;
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout, actualizar }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
