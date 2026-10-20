import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig, loadConfig } from './config/config';
import { LlmClient } from './llm/llm-client';
import { MockLlmClient } from './llm/mock-llm-client';
import { OllamaLlmClient } from './llm/ollama-llm-client';
import { PrismaService } from './prisma/prisma.service';
import { JobQueue } from './queue/job-queue';
import { PgmqJobQueue } from './queue/pgmq-job-queue';
import { FileStorage } from './storage/file-storage';
import { LocalDiskStorage } from './storage/local-disk-storage';

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
            throw new Error('S3 storage is not configured yet');
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
            throw new Error('Gemini is not configured yet');
        }
      },
    },
  ],
  exports: [APP_CONFIG, PrismaService, JobQueue, FileStorage, LlmClient],
})
export class CoreModule {}
