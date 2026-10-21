import { Module } from '@nestjs/common';
import { InvoiceEventsService } from '../realtime/invoice-events.service';
import { InvoicesController } from './api/invoices.controller';
import { InvoicesResolver } from './api/invoices.resolver';
import { InvoicesService } from './invoices.service';

/**
 * Everything that reads or writes invoices. InvoicesService is exported because the
 * assistant's tools operate through it rather than reimplementing the business rules.
 */
@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesResolver, InvoiceEventsService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
