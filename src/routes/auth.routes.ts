import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { loginSchema, registerSchema } from '../dtos/auth.dto';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new regular user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/AuthResult' } } } }
 *       409: { description: Email already registered }
 */
authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(authController.register),
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/AuthResult' } } } }
 *       401: { description: Invalid credentials }
 */
authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);
