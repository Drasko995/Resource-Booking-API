import { Router } from 'express';
import * as holidayController from '../controllers/holiday.controller';
import {
  createHolidaySchema,
  holidayIdParamsSchema,
} from '../dtos/holiday.dto';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/require-auth';
import { requireRole } from '../middleware/require-role';
import { validate } from '../middleware/validate';
import { UserRole } from '../entities/User';

export const holidayRouter = Router();

holidayRouter.use(requireAuth);

holidayRouter.get('/', asyncHandler(holidayController.list));

holidayRouter.post(
  '/',
  requireRole(UserRole.ADMIN),
  validate({ body: createHolidaySchema }),
  asyncHandler(holidayController.create),
);

holidayRouter.delete(
  '/:id',
  requireRole(UserRole.ADMIN),
  validate({ params: holidayIdParamsSchema }),
  asyncHandler(holidayController.remove),
);
