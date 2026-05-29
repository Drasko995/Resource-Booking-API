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

/**
 * @openapi
 * /api/holidays:
 *   get:
 *     tags: [Holidays]
 *     summary: List configured holidays
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Holiday' } }
 *   post:
 *     tags: [Holidays]
 *     summary: Create a holiday (admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, name]
 *             properties:
 *               date: { type: string, format: date }
 *               name: { type: string }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Holiday for this date already exists }
 */
holidayRouter.get('/', asyncHandler(holidayController.list));

holidayRouter.post(
  '/',
  requireRole(UserRole.ADMIN),
  validate({ body: createHolidaySchema }),
  asyncHandler(holidayController.create),
);

/**
 * @openapi
 * /api/holidays/{id}:
 *   delete:
 *     tags: [Holidays]
 *     summary: Delete a holiday (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 */
holidayRouter.delete(
  '/:id',
  requireRole(UserRole.ADMIN),
  validate({ params: holidayIdParamsSchema }),
  asyncHandler(holidayController.remove),
);
