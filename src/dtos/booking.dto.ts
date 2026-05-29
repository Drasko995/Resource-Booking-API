import { z } from 'zod';
import { BookingStatus } from '../entities/Booking';

const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO 8601 datetime with timezone offset' });

export const createBookingSchema = z
  .object({
    resourceId: z.string().uuid(),
    startAt: isoDateTime,
    endAt: isoDateTime,
    note: z.string().max(2000).optional(),
  })
  .refine((value) => new Date(value.endAt) > new Date(value.startAt), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

export const bookingIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listBookingsQuerySchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  resourceId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
