import { z } from 'zod';

export const createResourceSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(64),
  description: z.string().max(2000).optional(),
  allowOutsideHours: z.boolean().optional().default(false),
  allowWeekendsAndHolidays: z.boolean().optional().default(false),
});

export const updateResourceSchema = createResourceSchema.partial();

export const resourceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
