import { INestApplication, Logger, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_CONFIG, type AppConfig, loadDotEnv } from './config/config';

export async function startHttpApp(module: Type<unknown>, name: string): Promise<INestApplication> {
  loadDotEnv();
  const app = await NestFactory.create(module, { bufferLogs: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({ origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()) });
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  new Logger(name).log(`Listening on http://localhost:${config.PORT} (GraphQL at /graphql)`);
  return app;
}

/** Worker: no HTTP server, just the Nest DI container running the queue consumer. */
export async function startWorker(module: Type<unknown>): Promise<void> {
  loadDotEnv();
  const app = await NestFactory.createApplicationContext(module);
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker started');
}
