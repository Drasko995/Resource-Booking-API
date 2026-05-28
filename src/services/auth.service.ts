import { AppDataSource } from '../config/datasource';
import { User, UserRole } from '../entities/User';
import type { LoginInput, RegisterInput } from '../dtos/auth.dto';
import { HttpError } from '../utils/http-error';
import { signAuthToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

export type AuthResult = {
  token: string;
  user: { id: string; email: string; role: UserRole };
};

const toAuthResult = (user: User): AuthResult => ({
  token: signAuthToken({ sub: user.id, role: user.role }),
  user: { id: user.id, email: user.email, role: user.role },
});

export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
  const users = AppDataSource.getRepository(User);
  const existing = await users.findOne({ where: { email: input.email } });
  if (existing) {
    throw HttpError.conflict('Email already registered');
  }
  const user = users.create({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: UserRole.USER,
  });
  await users.save(user);
  return toAuthResult(user);
};

export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const users = AppDataSource.getRepository(User);
  const user = await users.findOne({ where: { email: input.email } });
  if (!user) {
    throw HttpError.unauthorized('Invalid email or password');
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw HttpError.unauthorized('Invalid email or password');
  }
  return toAuthResult(user);
};
