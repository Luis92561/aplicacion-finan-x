import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Rol } from '../ui.jsx';

const ICONS = {
  inicio: '📊', clientes: '👥', productos: '📦', pedidos: '🧾', facturas: '📄',
  pagos: '💳', notas: '🔖', balance: '⚖️', reportes: '📈', usuarios: '🔐', auditoria: '🛡️',
  saldo: '💰', datos: '👤', compras: '🛒', historial: '🗂️',
};

const NAVS = {
  interno: [
    { label: 'Inicio', icon: 'inicio', to: '/' },
    { label: 'Clientes', icon: 'clientes', to: '/clientes' },
    { label: 'Productos', icon: 'productos', to: '/productos' },
    { label: 'Pedidos', icon: 'pedidos', to: '/pedidos' },
    { label: 'Facturas', icon: 'facturas', to: '/facturas' },
    { label: 'Pagos', icon: 'pagos', to: '/pagos' },
    { label: 'Notas crédito', icon: 'notas', to: '/notas-credito', roles: ['ADMIN', 'SUPERVISOR'] },
    { label: 'Balances por cliente', icon: 'balance', to: '/balance-clientes', roles: ['ADMIN', 'SUPERVISOR', 'FACTURADOR'] },
    { label: 'Reportes', icon: 'reportes', to: '/reportes', roles: ['ADMIN', 'SUPERVISOR', 'FACTURADOR'] },
    { label: 'Auditoría', icon: 'auditoria', to: '/auditoria', roles: ['ADMIN', 'SUPERVISOR'] },
  ],
  cliente: [
    { label: 'Mi saldo', icon: 'saldo', to: '/portal' },
    { label: 'Mis datos', icon: 'datos', to: '/portal/datos' },
    { label: 'Mis compras', icon: 'compras', to: '/portal/compras' },
    { label: 'Mis facturas', icon: 'facturas', to: '/portal/facturas' },
    { label: 'Mis pagos', icon: 'pagos', to: '/portal/pagos' },
    { label: 'Mis notas de crédito', icon: 'notas', to: '/portal/notas' },
    { label: 'Mi historial', icon: 'historial', to: '/portal/historial' },
  ],
};

export function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const esCliente = user.tipo === 'cliente';
  const base = esCliente ? NAVS.cliente : NAVS.interno;
  // El menú oculta lo que el rol no puede usar. Es solo presentación: el backend
  // vuelve a comprobar el rol en cada endpoint.
  const navs = base.filter((n) => !n.roles || n.roles.includes(user.rol));
  if (!esCliente && user.rol === 'ADMIN') {
    navs.push({ label: 'Usuarios', icon: 'usuarios', to: '/usuarios' });
  }

  const exit = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          FINAN·X
          <small>Facturación y pagos</small>
        </div>
        <nav>
          <div className="nav-label">{esCliente ? 'Mi cuenta' : 'Operación'}</div>
          {navs.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/' || n.to === '/portal'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon">{ICONS[n.icon]}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <strong>{user.nombre}</strong>
          <span className="user-rol">
            {esCliente ? <Rol value="CLIENTE" /> : <Rol value={user.rol} />}
            <span>{esCliente ? user.username : user.correo}</span>
          </span>
          <button className="logout" onClick={exit}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
