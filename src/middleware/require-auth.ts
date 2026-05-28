import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error';
import { verifyAuthToken } from '../utils/jwt';

const BEARER_PREFIX = 'Bearer ';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return next(HttpError.unauthorized('Missing bearer token'));
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    return next(HttpError.unauthorized('Missing bearer token'));
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
};
