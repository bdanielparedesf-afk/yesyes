import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';
import { rateLimiter } from './middlewares/rateLimiter';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(rateLimiter);

const isVercel = process.env.VERCEL === '1';

app.use('/api', routes);

app.use(errorHandler);

if (!isVercel) {
  app.listen(PORT, () => {
    logger.info(`YESYES Backend running on port ${PORT}`);
  });
}

export default app;
