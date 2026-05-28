import 'reflect-metadata';
import { buildApp } from './app';
import { env } from './config/env';
import { AppDataSource } from './config/datasource';

const start = async (): Promise<void> => {
  await AppDataSource.initialize();
  const app = buildApp();
  app.listen(env.PORT, () => {
    console.info(`listening on :${env.PORT}`);
  });
};

start().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
