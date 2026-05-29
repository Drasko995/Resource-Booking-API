import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller';
import {
  bookingIdParamsSchema,
  createBookingSchema,
  listBookingsQuerySchema,
} from '../dtos/booking.dto';
import { UserRole } from '../entities/User';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/require-auth';
import { requireRole } from '../middleware/require-role';
import { validate } from '../middleware/validate';

export const bookingRouter = Router();

bookingRouter.use(requireAuth);

bookingRouter.post(
  '/',
  validate({ body: createBookingSchema }),
  asyncHandler(bookingController.create),
);

bookingRouter.get(
  '/me',
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(bookingController.listMine),
);

bookingRouter.post(
  '/:id/cancel',
  validate({ params: bookingIdParamsSchema }),
  asyncHandler(bookingController.cancel),
);

bookingRouter.get(
  '/',
  requireRole(UserRole.ADMIN),
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(bookingController.listAll),
);

bookingRouter.post(
  '/:id/approve',
  requireRole(UserRole.ADMIN),
  validate({ params: bookingIdParamsSchema }),
  asyncHandler(bookingController.approve),
);

bookingRouter.post(
  '/:id/reject',
  requireRole(UserRole.ADMIN),
  validate({ params: bookingIdParamsSchema }),
  asyncHandler(bookingController.reject),
);
