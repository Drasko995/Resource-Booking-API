import { Router } from 'express';
import * as resourceController from '../controllers/resource.controller';
import {
  createResourceSchema,
  resourceIdParamsSchema,
  updateResourceSchema,
} from '../dtos/resource.dto';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/require-auth';
import { requireRole } from '../middleware/require-role';
import { validate } from '../middleware/validate';
import { UserRole } from '../entities/User';

export const resourceRouter = Router();

resourceRouter.use(requireAuth);

resourceRouter.get('/', asyncHandler(resourceController.list));

resourceRouter.get(
  '/:id',
  validate({ params: resourceIdParamsSchema }),
  asyncHandler(resourceController.getOne),
);

resourceRouter.post(
  '/',
  requireRole(UserRole.ADMIN),
  validate({ body: createResourceSchema }),
  asyncHandler(resourceController.create),
);

resourceRouter.patch(
  '/:id',
  requireRole(UserRole.ADMIN),
  validate({ params: resourceIdParamsSchema, body: updateResourceSchema }),
  asyncHandler(resourceController.update),
);

resourceRouter.delete(
  '/:id',
  requireRole(UserRole.ADMIN),
  validate({ params: resourceIdParamsSchema }),
  asyncHandler(resourceController.remove),
);
