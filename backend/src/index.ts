import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';
import { rateLimiter } from './middlewares/rateLimiter';
import routes from './routes';
import { env } from './config/env';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

app.use(helmet());
const corsOrigins = env.corsOrigins;
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(morgan('combined', {
  // OAuth callback URLs contain a one-use code. Never log these requests or their referrers.
  skip: req => req.path.startsWith('/api/admin/aliexpress/oauth/'),
  stream: { write: message => logger.info(message.trim()) },
}));
// 1mb: el flujo de publicación AliExpress envía la preview completa (con variantes
// y snapshot del proveedor) y con el límite anterior (10kb) los jobs masivos
// recibían 413 al publicar. No es un límite global "grande": 1mb sigue siendo
// razonable y solo las rutas admin autenticadas reciben payloads así.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(rateLimiter);

const isVercel = process.env.VERCEL === '1';

app.use('/api', routes);

if (isVercel) {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

app.use(errorHandler);

// E §14 — Una excepción en un handler async no debe tumbar la API. Express 4 no
// captura rechazos de handlers async, así que un error puntual (pool de base de
// datos, tiempo de espera) se convertía en un `unhandledRejection` y mataba el
// proceso, dejando al editor sin servidor. Se registra y se sigue sirviendo.
// Solo `unhandledRejection`: un `uncaughtException` sí indica estado indefinido
// y debe terminar el proceso (por ejemplo, un puerto ocupado al escuchar).
if (!isVercel) {
  process.on('unhandledRejection', (reason) => {
    logger.error(`Rechazo no manejado: ${reason instanceof Error ? reason.message : String(reason)}`);
  });
}

if (!isVercel) {
  app.listen(PORT, () => {
    logger.info(`YESYES Backend running on port ${PORT}`);
  });
}

export default app;
