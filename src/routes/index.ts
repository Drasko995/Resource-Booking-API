import { Router } from 'express';
import { authRouter } from './auth.routes';
import { bookingRouter } from './booking.routes';
import { holidayRouter } from './holiday.routes';
import { resourceRouter } from './resource.routes';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'resource-booking-api', version: '0.1.0' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/resources', resourceRouter);
apiRouter.use('/holidays', holidayRouter);
apiRouter.use('/bookings', bookingRouter);
