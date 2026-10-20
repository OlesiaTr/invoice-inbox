import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { InvoiceEventsService } from '../../realtime/invoice-events.service';
import { InvoicesService } from '../invoices.service';
import {
  InvoiceEvent,
  InvoiceModel,
  InvoicePage,
  InvoicesFilter,
  RetryAllResult,
  StatusCounts,
  UpdateInvoiceFieldsInput,
  toInvoiceModel,
} from './invoice.model';

@Resolver(() => InvoiceModel)
export class InvoicesResolver {
  constructor(
    private readonly service: InvoicesService,
    private readonly events: InvoiceEventsService,
  ) {}

  @Query(() => InvoicePage)
  async invoices(@Args('filter', { nullable: true }) filter?: InvoicesFilter): Promise<InvoicePage> {
    const { items, total } = await this.service.list(filter ?? {});
    return { items: items.map(toInvoiceModel), total };
  }

  @Query(() => InvoiceModel)
  async invoice(@Args('id', { type: () => ID }) id: string): Promise<InvoiceModel> {
    return toInvoiceModel(await this.service.get(id));
  }

  @Query(() => StatusCounts)
  async statusCounts(): Promise<StatusCounts> {
    const c = await this.service.statusCounts();
    return { ...c, all: c.uploaded + c.processing + c.completed + c.failed };
  }

  @Mutation(() => InvoiceModel)
  async retryInvoice(@Args('id', { type: () => ID }) id: string): Promise<InvoiceModel> {
    return toInvoiceModel(await this.service.retry(id));
  }

  @Mutation(() => RetryAllResult)
  retryAllFailedInvoices(): Promise<RetryAllResult> {
    return this.service.retryAllFailed();
  }

  @Mutation(() => InvoiceModel)
  async deleteInvoice(@Args('id', { type: () => ID }) id: string): Promise<InvoiceModel> {
    return toInvoiceModel(await this.service.delete(id));
  }

  @Mutation(() => InvoiceModel)
  async updateInvoiceFields(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateInvoiceFieldsInput,
  ): Promise<InvoiceModel> {
    return toInvoiceModel(await this.service.updateFields(id, input));
  }

  @Subscription(() => InvoiceEvent, {
    description: 'Every invoice insert/update/delete, as announced by the database trigger',
  })
  invoiceEvents() {
    return this.events.subscribe();
  }
}
