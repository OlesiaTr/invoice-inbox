import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig, loadConfig } from './config/config';
import { GeminiLlmClient } from './llm/gemini-llm-client';
import { LlmClient } from './llm/llm-client';
import { MockLlmClient } from './llm/mock-llm-client';
import { OllamaLlmClient } from './llm/ollama-llm-client';
import { PrismaService } from './prisma/prisma.service';
import { JobQueue } from './queue/job-queue';
import { PgmqJobQueue } from './queue/pgmq-job-queue';
import { FileStorage } from './storage/file-storage';
import { LocalDiskStorage } from './storage/local-disk-storage';
import { S3Storage } from './storage/s3-storage';

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} must be set for the selected driver`);
  return value;
}

/**
 * Infrastructure shared by the API and the worker. Each port (abstract class) is bound to
 * an adapter chosen by configuration — the rest of the code only sees the port.
 */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    PrismaService,
    { provide: JobQueue, useClass: PgmqJobQueue },
    {
      provide: FileStorage,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): FileStorage => {
        switch (config.STORAGE_DRIVER) {
          case 'local':
            return new LocalDiskStorage(config.STORAGE_LOCAL_DIR);
          case 's3':
            return new S3Storage({
              endpoint: config.S3_ENDPOINT,
              region: required(config.S3_REGION, 'S3_REGION'),
              bucket: required(config.S3_BUCKET, 'S3_BUCKET'),
              accessKeyId: required(config.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
              secretAccessKey: required(config.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
            });
        }
      },
    },
    {
      provide: LlmClient,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): LlmClient => {
        const timeoutMs = config.LLM_TIMEOUT_SECONDS * 1000;
        switch (config.LLM_DRIVER) {
          case 'ollama':
            return new OllamaLlmClient(config.OLLAMA_URL, config.OLLAMA_MODEL, timeoutMs);
          case 'mock':
            return new MockLlmClient();
          case 'gemini':
            return new GeminiLlmClient(required(config.GEMINI_API_KEY, 'GEMINI_API_KEY'), config.GEMINI_MODEL, timeoutMs);
        }
      },
    },
  ],
  exports: [APP_CONFIG, PrismaService, JobQueue, FileStorage, LlmClient],
})
export class CoreModule {}
