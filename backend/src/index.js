import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import misRouter from './routes/mis.js';
import { HttpError } from './utils.js';

const app = express();

// req.ip real detrás de nginx (que reenvía X-Forwarded-For) — una sola capa de proxy.
app.set('trust proxy', 1);

// Cabeceras de seguridad (CSP, X-Content-Type-Options, X-Frame-Options, etc.).
app.use(helmet());

// CORS restringido a los orígenes permitidos (el navegador rechaza los demás).
app.use(cors({
  origin(origin, cb) {
    // Solicitudes sin cabecera Origin (curl, Node, misma-origen) se aceptan.
    if (!origin) return cb(null, true);
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    // Origen no permitido: se responde sin Access-Control-Allow-Origin → el navegador lo bloquea.
    return cb(null, false);
  },
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'FINAN-X API', hora: new Date().toISOString() }));

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
app.use('/api', misRouter); // /api/mis-*

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, () => {
  console.log(`FINAN-X API escuchando en http://localhost:${config.port}  (${config.db.database}@${config.db.host}:${config.db.port})`);
});