import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { loginSchema, registerSchema } from '../dtos/auth.dto';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(authController.register),
);

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);
