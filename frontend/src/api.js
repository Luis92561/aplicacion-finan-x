import axios from 'axios';

/**
 * Cliente HTTP de la SPA.
 *
 * La sesión viaja en una cookie HttpOnly (`fx_session`): JavaScript no puede leerla, así
 * que un XSS no puede robar el token. `withCredentials` hace que el navegador la envíe.
 */
export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    const status = err.response?.status;
    const codigo = err.response?.data?.codigo;

    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    // Primer ingreso: el backend bloquea todo salvo el cambio de contraseña.
    if (status === 403 && codigo === 'CAMBIO_CLAVE_REQUERIDO' && window.location.pathname !== '/cambiar-clave') {
      window.location.href = '/cambiar-clave';
    }
    return Promise.reject(err);
  }
);

export function errMsg(err) {
  return err?.response?.data?.error || err?.message || 'Error inesperado';
}

export default api;
