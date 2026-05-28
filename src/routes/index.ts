import { Router } from 'express';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'resource-booking-api', version: '0.1.0' });
});
