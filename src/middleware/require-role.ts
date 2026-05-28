import type { RequestHandler } from 'express';
import { UserRole } from '../entities/User';
import { HttpError } from '../utils/http-error';

export const requireRole = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(HttpError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(HttpError.forbidden('Insufficient permissions'));
    }
    next();
  };
};
