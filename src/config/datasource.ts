import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { Booking } from '../entities/Booking';
import { Holiday } from '../entities/Holiday';
import { Resource } from '../entities/Resource';
import { User } from '../entities/User';

const isProduction = env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  username: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  entities: [User, Resource, Booking, Holiday],
  migrations: [isProduction ? 'dist/migrations/*.js' : 'src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
});
