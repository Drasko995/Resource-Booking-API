import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../entities/User';
import { HttpError } from './http-error';

export type AuthTokenPayload = {
  sub: string;
  role: UserRole;
};

export const signAuthToken = (payload: AuthTokenPayload): string => {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
      throw HttpError.unauthorized('Malformed token');
    }
    return { sub: decoded.sub, role: decoded.role as UserRole };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw HttpError.unauthorized('Invalid or expired token');
  }
};
