import { Module } from '@nestjs/common';
import { InvoiceProcessor } from './invoice-processor';
import { QueueConsumer } from './queue-consumer';
import { TextExtractor } from './text-extractor';

@Module({
  providers: [TextExtractor, InvoiceProcessor, QueueConsumer],
})
export class ProcessingModule {}
