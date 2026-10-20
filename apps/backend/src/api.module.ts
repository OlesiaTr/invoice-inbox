import { join } from 'node:path';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AssistantResolver } from './assistant/assistant.resolver';
import { AssistantService } from './assistant/assistant.service';
import { McpController } from './assistant/mcp.controller';
import { AccessCodeGuard, accessCodeMatches } from './common/access-code.guard';
import { CorrelationMiddleware } from './common/correlation.middleware';
import { GqlThrottlerGuard } from './common/gql-throttler.guard';
import { HealthController } from './common/health.controller';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { APP_CONFIG, type AppConfig } from './config/config';
import { CoreModule } from './core.module';
import { InvoicesController } from './invoices/api/invoices.controller';
import { InvoicesResolver } from './invoices/api/invoices.resolver';
import { InvoicesService } from './invoices/invoices.service';
import { InvoiceEventsService } from './realtime/invoice-events.service';

@Module({
  imports: [
    CoreModule,
    // Generous by default — the UI is chatty on purpose (live updates, counts). The
    // expensive entry points carry their own tighter @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        const isProduction = config.NODE_ENV === 'production';
        return {
          // Code-first: the schema is generated from the TypeScript classes. Locally it is
          // also written to disk, where the frontend's codegen reads it.
          autoSchemaFile: isProduction ? true : join(process.cwd(), 'schema.graphql'),
          sortSchema: true,
          graphiql: !isProduction,
          // `res` as well as `req`: the throttler guard needs it to set its headers.
          context: ({ req, res }: { req?: Request; res?: Response }) => ({ req, res }),
          // Business errors (ConflictException and friends) are written for the caller and
          // pass through. Anything else is flattened so internals and stack traces stay in
          // the logs — the REST equivalent lives in HttpExceptionFilter.
          formatError: (formatted, error) => {
            const status = (formatted.extensions?.originalError as { statusCode?: number } | undefined)?.statusCode;
            const isDeliberate = typeof status === 'number' && status < 500;
            if (isDeliberate || !isProduction) return formatted;
            new Logger('GraphQL').error('Unhandled error', error instanceof Error ? error.stack : String(error));
            return { message: 'Something went wrong.', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
          },
          subscriptions: {
            'graphql-ws': {
              path: '/graphql',
              onConnect: (ctx) => accessCodeMatches(config.ACCESS_CODE, ctx.connectionParams?.accessCode),
            },
          },
        };
      },
    }),
  ],
  controllers: [InvoicesController, HealthController, McpController],
  providers: [
    { provide: APP_GUARD, useClass: AccessCodeGuard },
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    InvoicesService,
    InvoicesResolver,
    InvoiceEventsService,
    AssistantService,
    AssistantResolver,
  ],
  exports: [InvoicesService],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every request gets a correlation id before anything else runs, so even a guard
    // rejection is traceable.
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
