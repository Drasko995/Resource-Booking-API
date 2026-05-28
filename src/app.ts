import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/error-handler';
import { apiRouter } from './routes';
import { HttpError } from './utils/http-error';

export const buildApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', apiRouter);

  app.use((_req, _res, next) => {
    next(HttpError.notFound('Endpoint not found'));
  });

  app.use(errorHandler);

  return app;
};
