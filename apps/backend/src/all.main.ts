import { Module } from '@nestjs/common';
import { ApiModule } from './api.module';
import { startHttpApp } from './bootstrap';
import { ProcessingModule } from './processing/processing.module';

/**
 * API and worker in one process — only for hosting where a separate worker isn't free
 * (the public demo). Same modules, same code paths; locally they run as two processes.
 */
@Module({ imports: [ApiModule, ProcessingModule] })
class AllInOneModule {}

void startHttpApp(AllInOneModule, 'API+Worker');
