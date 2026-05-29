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

/**
 * @openapi
 * /api/bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Create a booking request
 *     description: Validates date/time rules and overlap before inserting with status PENDING.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resourceId, startAt, endAt]
 *             properties:
 *               resourceId: { type: string, format: uuid }
 *               startAt: { type: string, format: date-time, description: 'ISO 8601 with explicit offset' }
 *               endAt: { type: string, format: date-time }
 *               note: { type: string }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/Booking' } } } }
 *       400: { description: Time-of-day validation failed (past date, end<=start, ...) }
 *       409: { description: Overlapping active booking exists }
 *       422: { description: Working-hours / weekend / holiday rule violated }
 */
bookingRouter.post(
  '/',
  validate({ body: createBookingSchema }),
  asyncHandler(bookingController.create),
);

/**
 * @openapi
 * /api/bookings/me:
 *   get:
 *     tags: [Bookings]
 *     summary: List the caller's bookings
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED] }
 *       - in: query
 *         name: resourceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedBookings' } } } }
 */
bookingRouter.get(
  '/me',
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(bookingController.listMine),
);

/**
 * @openapi
 * /api/bookings/{id}/cancel:
 *   post:
 *     tags: [Bookings]
 *     summary: Cancel a booking
 *     description: Allowed for the owner of the booking or any admin. Only PENDING / APPROVED bookings can be cancelled.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Cannot cancel another user's booking }
 *       409: { description: Invalid status transition }
 */
bookingRouter.post(
  '/:id/cancel',
  validate({ params: bookingIdParamsSchema }),
  asyncHandler(bookingController.cancel),
);

/**
 * @openapi
 * /api/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List all bookings (admin)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED] }
 *       - in: query
 *         name: resourceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedBookings' } } } }
 *       403: { description: Forbidden }
 */
bookingRouter.get(
  '/',
  requireRole(UserRole.ADMIN),
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(bookingController.listAll),
);

/**
 * @openapi
 * /api/bookings/{id}/approve:
 *   post:
 *     tags: [Bookings]
 *     summary: Approve a pending booking (admin)
 *     description: Re-checks overlap at approval time and refuses if a conflict has appeared since creation.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *       409: { description: Conflict detected or invalid status }
 */
bookingRouter.post(
  '/:id/approve',
  requireRole(UserRole.ADMIN),
  validate({ params: bookingIdParamsSchema }),
  asyncHandler(bookingController.approve),
);

/**
 * @openapi
 * /api/bookings/{id}/reject:
 *   post:
 *     tags: [Bookings]
 *     summary: Reject a pending booking (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *       409: { description: Invalid status }
 */
bookingRouter.post(
  '/:id/reject',
  requireRole(UserRole.ADMIN),
  validate({ params: bookingIdParamsSchema }),
  asyncHandler(bookingController.reject),
);
