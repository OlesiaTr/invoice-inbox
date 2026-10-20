import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { ProcessingModule } from './processing/processing.module';

@Module({
  imports: [CoreModule, ProcessingModule],
})
export class WorkerModule {}
