import type { UserRole } from '../entities/User';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: UserRole;
    }
    interface Request {
      user?: UserContext;
    }
  }
}

export {};
