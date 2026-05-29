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

/**
 * @openapi
 * /api/resources:
 *   get:
 *     tags: [Resources]
 *     summary: List resources
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Resource' } }
 */
resourceRouter.get('/', asyncHandler(resourceController.list));

/**
 * @openapi
 * /api/resources/{id}:
 *   get:
 *     tags: [Resources]
 *     summary: Get a resource by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Resource' } } } }
 *       404: { description: Not found }
 */
resourceRouter.get(
  '/:id',
  validate({ params: resourceIdParamsSchema }),
  asyncHandler(resourceController.getOne),
);

/**
 * @openapi
 * /api/resources:
 *   post:
 *     tags: [Resources]
 *     summary: Create a resource (admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string }
 *               type: { type: string }
 *               description: { type: string }
 *               allowOutsideHours: { type: boolean }
 *               allowWeekendsAndHolidays: { type: boolean }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/Resource' } } } }
 *       403: { description: Forbidden }
 *       409: { description: Resource with this name already exists }
 */
resourceRouter.post(
  '/',
  requireRole(UserRole.ADMIN),
  validate({ body: createResourceSchema }),
  asyncHandler(resourceController.create),
);

/**
 * @openapi
 * /api/resources/{id}:
 *   patch:
 *     tags: [Resources]
 *     summary: Update a resource (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Resources]
 *     summary: Delete a resource (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
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
