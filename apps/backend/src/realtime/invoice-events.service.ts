import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Client } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { InvoiceEvent, InvoiceEventType } from '../invoices/api/invoice.model';

const CHANNEL = 'invoice_events';
const TRIGGER = 'invoiceEvents';

/**
 * Bridges Postgres NOTIFY → GraphQL subscriptions.
 *
 * Every API instance holds one dedicated LISTEN connection, so every instance hears every
 * change no matter which process made it (worker, another API instance, the assistant).
 * The in-memory PubSub then fans out to the WebSocket clients of *this* instance only.
 */
@Injectable()
export class InvoiceEventsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(InvoiceEventsService.name);
  private readonly pubSub = new PubSub<{ [TRIGGER]: { invoiceEvents: InvoiceEvent } }>();
  private client?: Client;
  private closed = false;
  private hadConnection = false;
  private reconnecting = false;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  subscribe() {
    return this.pubSub.asyncIterableIterator(TRIGGER);
  }

  async onModuleInit() {
    await this.connect();
  }

  async onApplicationShutdown() {
    this.closed = true;
    await this.client?.end().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    // DIRECT_URL: LISTEN needs a session that stays open; a transaction pooler would drop it.
    const client = new Client({ connectionString: this.config.DIRECT_URL });
    client.on('notification', (msg) => this.onNotification(msg.payload));
    client.on('error', (err) => {
      this.logger.error(`LISTEN connection error: ${err.message}`);
      this.reconnect(client);
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.client = client;
      this.logger.log(`Listening on "${CHANNEL}"`);
      // Anything that happened while we were disconnected was missed: tell clients to refetch.
      if (this.hadConnection) this.publish({ type: InvoiceEventType.RESYNC, id: null, status: null, updatedAt: null });
      this.hadConnection = true;
    } catch (err) {
      this.logger.error(`Could not LISTEN: ${(err as Error).message}`);
      this.reconnect(client);
    }
  }

  private reconnect(old: Client) {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    this.client = undefined;
    old.removeAllListeners();
    old.on('error', () => undefined); // a late error on a dead client must not crash the process
    old.end().catch(() => undefined);
    setTimeout(() => {
      this.reconnecting = false;
      void this.connect();
    }, 2000);
  }

  private onNotification(payload: string | undefined) {
    if (!payload) return;
    try {
      const e = JSON.parse(payload) as { type: InvoiceEventType; id: string; status: InvoiceEvent['status']; updatedAt: string };
      this.publish({ type: e.type, id: e.id, status: e.status, updatedAt: new Date(e.updatedAt) });
    } catch {
      this.logger.warn(`Ignoring malformed notification: ${payload}`);
    }
  }

  private publish(event: InvoiceEvent) {
    void this.pubSub.publish(TRIGGER, { invoiceEvents: event });
  }
}
