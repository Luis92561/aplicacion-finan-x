import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

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
    { label: 'Notas crédito', icon: 'notas', to: '/notas-credito' },
    { label: 'Balances por cliente', icon: 'balance', to: '/balance-clientes' },
    { label: 'Reportes', icon: 'reportes', to: '/reportes' },
    { label: 'Auditoría', icon: 'auditoria', to: '/auditoria' },
  ],
  adminExtra: [{ label: 'Usuarios', icon: 'usuarios', to: '/usuarios' }],
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { logout } = useAuth();

  if (!user) return null;

  const isCliente = user.tipo === 'cliente';
  const navs = isCliente
    ? NAVS.cliente
    : [...NAVS.interno, ...(user.rol === 'ADMIN' ? NAVS.adminExtra : [])];

  const exit = () => {
    logout();
    navigate('/login');
  };

  const rolLabel = isCliente ? 'Cliente' : user.rol;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          FINAN·X
          <small>Facturación y pagos</small>
        </div>
        <nav>
          {!isCliente && <div className="nav-label">Operación</div>}
          {isCliente && <div className="nav-label">Mi cuenta</div>}
          {navs.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/' || n.to === '/portal'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon">{ICONS[n.icon]}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <strong>{user.nombre}</strong>
          <span>{rolLabel}{isCliente ? ` · ${user.username}` : ` · ${user.correo}`}</span>
          <button className="logout" onClick={exit}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function Topbar({ title, crumb }) {
  const { user } = useAuth();
  return (
    <div className="topbar">
      <div>
        <h2>{title}</h2>
        {crumb && <div className="crumb">{crumb}</div>}
      </div>
      <div>
        {user?.tipo === 'interno' && <EntityPill />}
      </div>
    </div>
  );
}

function EntityPill() {
  return null;
}