import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid calendar date');

export const createHolidaySchema = z.object({
  date: isoDate,
  name: z.string().min(1).max(200),
});

export const holidayIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
