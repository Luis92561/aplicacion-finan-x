import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Shell } from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import Productos from './pages/Productos.jsx';
import Pedidos from './pages/Pedidos.jsx';
import PedidoForm from './pages/PedidoForm.jsx';
import PedidoDetalle from './pages/PedidoDetalle.jsx';
import Facturas from './pages/Facturas.jsx';
import FacturaDetalle from './pages/FacturaDetalle.jsx';
import Pagos from './pages/Pagos.jsx';
import Reportes from './pages/Reportes.jsx';
import NotasCredito from './pages/NotasCredito.jsx';
import BalanceClientes from './pages/BalanceClientes.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Auditoria from './pages/Auditoria.jsx';

import MisDatos from './pages/portal/MisDatos.jsx';
import MisCompras from './pages/portal/MisCompras.jsx';
import MisFacturas from './pages/portal/MisFacturas.jsx';
import MisPagos from './pages/portal/MisPagos.jsx';
import MiSaldo from './pages/portal/MiSaldo.jsx';
import MiHistorial from './pages/portal/MiHistorial.jsx';
import MisNotasCredito from './pages/portal/MisNotasCredito.jsx';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireInternal() {
  const { user } = useAuth();
  return user?.tipo === 'interno' ? <Outlet /> : <Navigate to="/portal" replace />;
}

function RequireCliente() {
  const { user } = useAuth();
  return user?.tipo === 'cliente' ? <Outlet /> : <Navigate to="/" replace />;
}

function RequireRol({ roles }) {
  const { user } = useAuth();
  const ok = user?.tipo === 'interno' && roles.includes(user.rol);
  return ok ? <Outlet /> : <Navigate to="/" replace />;
}

function ClientPage({ title, children }) {
  return (
    <>
      <div className="topbar"><h2>{title}</h2></div>
      <div className="content">{children}</div>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          {/* Portal del cliente */}
          <Route element={<RequireCliente />}>
            <Route path="/portal" element={<ClientPage title="Mi saldo"><MiSaldo /></ClientPage>} />
            <Route path="/portal/datos" element={<ClientPage title="Mis datos"><MisDatos /></ClientPage>} />
            <Route path="/portal/compras" element={<ClientPage title="Mis compras"><MisCompras /></ClientPage>} />
            <Route path="/portal/facturas" element={<ClientPage title="Mis facturas"><MisFacturas /></ClientPage>} />
            <Route path="/portal/pagos" element={<ClientPage title="Mis pagos"><MisPagos /></ClientPage>} />
            <Route path="/portal/historial" element={<ClientPage title="Mi historial financiero"><MiHistorial /></ClientPage>} />
            <Route path="/portal/notas" element={<ClientPage title="Mis notas de crédito"><MisNotasCredito /></ClientPage>} />
          </Route>

          {/* Usuarios internos */}
          <Route element={<RequireInternal />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/pedidos/nuevo" element={<PedidoForm />} />
            <Route path="/pedidos/:id" element={<PedidoDetalle />} />
            <Route path="/facturas" element={<Facturas />} />
            <Route path="/facturas/:id" element={<FacturaDetalle />} />
            <Route path="/pagos" element={<Pagos />} />
            <Route path="/notas-credito" element={<NotasCredito />} />
            <Route path="/balance-clientes" element={<BalanceClientes />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route element={<RequireRol roles={['ADMIN']} />}>
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}