const TONES = {
  ACTIVO: 'green', INACTIVO: 'red',
  BORRADOR: 'gray', CONFIRMADO: 'blue', CANCELADO: 'red', FACTURADO: 'purple',
  ACTIVA: 'blue', ANULADA: 'red',
  PENDIENTE: 'gray', PAGO_PARCIAL: 'orange', PAGADA: 'green',
};

export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Estado({ value }) {
  const label = String(value || '').replaceAll('_', ' ');
  return <Badge tone={TONES[value] || 'gray'}>{label}</Badge>;
}

/**
 * Rol del usuario. Antes la pantalla de Usuarios pintaba el rol con el componente de
 * estado y aparecían cosas como "ADMIN → CONFIRMADO" o "CAJERO → PAGO PARCIAL".
 */
const ROLES = {
  ADMIN: { tone: 'purple', label: 'ADMIN' },
  SUPERVISOR: { tone: 'blue', label: 'SUPERVISOR' },
  FACTURADOR: { tone: 'green', label: 'FACTURADOR' },
  CAJERO: { tone: 'orange', label: 'CAJERO' },
  CLIENTE: { tone: 'gray', label: 'CLIENTE' },
};

export function Rol({ value }) {
  const cfg = ROLES[value] || { tone: 'gray', label: String(value || '—') };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

/** Operación de auditoría, con su propio color (no es un estado del negocio). */
const OPERACIONES = {
  LOGIN: 'green',
  LOGOUT: 'gray',
  LOGIN_FALLIDO: 'red',
  LOGIN_BLOQUEADO: 'red',
  CAMBIO_CLAVE: 'orange',
  CAMBIO_CLAVE_FALLIDO: 'red',
  CLAVE: 'orange',
  CLAVE_RECUPERADA: 'orange',
  CREAR: 'blue',
  ACTUALIZAR: 'blue',
  ESTADO: 'blue',
  GENERAR: 'purple',
  REGISTRAR: 'green',
  PAGO: 'green',
  PAGO_PORTAL: 'green',
  CODIGO_EFECTY: 'gray',
  ANULAR: 'red',
  RECUPERAR_SOLICITAR: 'gray',
  AUTORREGISTRO: 'gray',
};

export function Operacion({ value }) {
  const v = String(value || '—');
  const tone = OPERACIONES[v] || (/(ANULAR|FALLID)/.test(v) ? 'red' : 'gray');
  return <Badge tone={tone}>{v.replaceAll('_', ' ')}</Badge>;
}

export function Money({ value, decimals = false }) {
  const fmt = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: decimals ? 2 : 0,
    minimumFractionDigits: 0,
  });
  return <>{fmt.format(Number(value || 0))}</>;
}

export function Fecha({ value }) {
  if (!value) return <span className="empty">—</span>;
  return <>{new Date(value).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}</>;
}

export function FechaHora({ value }) {
  if (!value) return <span className="empty">—</span>;
  return <>{new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</>;
}

/** Detalle legible del medio de pago (tarjeta enmascarada, transferencia, cheque, efectivo). */
export function DatosPago({ p }) {
  if (p?.metodo_pago === 'TARJETA') {
    const tipo = p.tipo_tarjeta ? `${p.tipo_tarjeta} ` : '';
    return (
      <>
        {tipo}···{p.ultimos_digitos_tarjeta || '····'}
        {p.vencimiento_tarjeta ? ` · vence ${p.vencimiento_tarjeta}` : ''}
        {p.banco ? ` · ${p.banco}` : ''}
      </>
    );
  }
  if (p?.metodo_pago === 'TRANSFERENCIA') {
    return <>Banco {p.banco || '—'}{p.numero_cuenta ? ` · cuenta ···${p.numero_cuenta.slice(-4)}` : ''}</>;
  }
  if (p?.metodo_pago === 'CHEQUE') {
    return p.banco ? `Cheque · ${p.banco}` : 'Cheque';
  }
  return null;
}

export function Loading() {
  return <div className="empty">Cargando…</div>;
}

export function ErrorBox({ msg }) {
  if (!msg) return null;
  return <div className="alert alert-error">{msg}</div>;
}

export function Empty({ text = 'Sin registros' }) {
  return <div className="empty">{text}</div>;
}

export function Section({ title, children, actions }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}