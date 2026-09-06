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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

app.use(helmet());
// CORS_ORIGIN admite una lista separada por comas (ej: "https://yesyes.cl,http://localhost:5173")
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
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

if (!isVercel) {
  app.listen(PORT, () => {
    logger.info(`YESYES Backend running on port ${PORT}`);
  });
}

export default app;
