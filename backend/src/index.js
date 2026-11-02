import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';
import clientesRouter from './routes/clientes.js';
import productosRouter from './routes/productos.js';
import pedidosRouter from './routes/pedidos.js';
import facturasRouter from './routes/facturas.js';
import pagosRouter from './routes/pagos.js';
import notasCreditoRouter from './routes/notas-credito.js';
import reportesRouter from './routes/reportes.js';
import auditoriaRouter from './routes/auditoria.js';
import dashboardRouter from './routes/dashboard.js';
import misRouter from './routes/mis.js';
import { HttpError } from './utils.js';
import { verificarEsquema } from './verificar-esquema.js';

const app = express();

// Detrás de nginx (una capa) y de la red interna de Docker. Nunca se confía en
// X-Forwarded-For de cualquier origen: si la petición llega directa, se ignora.
app.set('trust proxy', ['loopback', '172.16.0.0/12']);

// Cabeceras de seguridad (CSP, X-Content-Type-Options, X-Frame-Options, etc.).
app.use(helmet());

// CORS restringido a los orígenes permitidos, con credenciales (cookie de sesión).
// Nunca "*": con cookies, un comodín permitiría a cualquier sitio leer la API.
app.use(cors({
  credentials: true,
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
}));

// Límite de cuerpo explícito: una API de facturación no necesita megabytes.
app.use(express.json({ limit: '64kb' }));

// Salud sin límite (la usa el healthcheck de Docker).
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Límite global por IP: frena scraping y agotamiento de recursos. Los límites
// específicos de login y recuperación son más estrictos.
const limiteGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.limiteGlobal,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente de nuevo en unos minutos.' },
});
app.use('/api', limiteGlobal);

app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/facturas', facturasRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/notas-credito', notasCreditoRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/auditoria', auditoriaRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', misRouter); // /api/mis-*

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.codigo ? { codigo: err.codigo } : {}) });
  }
  // Errores de PostgreSQL que son culpa de la petición, no del servidor.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La petición es demasiado grande' });
  }
  if (err?.code === '22P02') return res.status(400).json({ error: 'Datos con formato inválido' });
  if (err?.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  if (err?.code === '23503') return res.status(409).json({ error: 'El registro está en uso y no se puede completar la operación' });
  if (err?.code === '23514') return res.status(400).json({ error: 'Alguno de los valores enviados no es válido' });

  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Antes de escuchar se comprueba que la base tenga el esquema esperado: si falta una
// migración, es mejor fallar con instrucciones claras que responder 500 en cada consulta.
verificarEsquema()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`FINAN-X API escuchando en http://localhost:${config.port} (${config.db.database}@${config.db.host}:${config.db.port})`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });

export default app;
