import 'reflect-metadata';
import { buildApp } from './app';
import { env } from './config/env';
import { AppDataSource } from './config/datasource';
import { startAutoRejectStaleJob } from './jobs/auto-reject-stale.job';

const start = async (): Promise<void> => {
  await AppDataSource.initialize();
  const app = buildApp();
  app.listen(env.PORT, () => {
    console.info(`listening on :${env.PORT}`);
  });
  startAutoRejectStaleJob();
};

start().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
