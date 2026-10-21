import { type INestApplication, Logger, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { createLogger } from './common/json-logger';
import { APP_CONFIG, type AppConfig, loadConfig, loadDotEnv } from './config/config';

export const startHttpApp = async (module: Type<unknown>, name: string): Promise<INestApplication> => {
  loadDotEnv();
  // The config is parsed before Nest starts so an invalid environment fails immediately,
  // and so the logger knows which format to use for the very first line.
  const booted = loadConfig();
  const app = await NestFactory.create(module, { bufferLogs: false, logger: createLogger(booted.NODE_ENV) });
  const config = app.get<AppConfig>(APP_CONFIG);
  const isProduction = config.NODE_ENV === 'production';

  app.use(
    helmet({
      // GraphiQL loads its assets from a CDN and needs inline styles, so the default CSP
      // would break the development playground. It isn't served in production.
      contentSecurityPolicy: isProduction ? undefined : false,
      // The API is consumed cross-origin by the web app; let the browser read responses.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Inline file previews (<img>, <iframe>) are same-origin reads of our own responses.
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    exposedHeaders: ['x-request-id'],
  });
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  new Logger(name).log(`Listening on http://localhost:${config.PORT} (GraphQL at /graphql)`);
  return app;
};

/** Worker: no HTTP server, just the Nest DI container running the queue consumer. */
export const startWorker = async (module: Type<unknown>): Promise<void> => {
  loadDotEnv();
  const booted = loadConfig();
  const app = await NestFactory.createApplicationContext(module, { logger: createLogger(booted.NODE_ENV) });
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker started');
};
