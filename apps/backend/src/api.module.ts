import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import type { Request } from 'express';
import { AccessCodeGuard, accessCodeMatches } from './common/access-code.guard';
import { HealthController } from './common/health.controller';
import { APP_CONFIG, type AppConfig } from './config/config';
import { CoreModule } from './core.module';
import { InvoicesController } from './invoices/api/invoices.controller';
import { InvoicesResolver } from './invoices/api/invoices.resolver';
import { InvoicesService } from './invoices/invoices.service';
import { InvoiceEventsService } from './realtime/invoice-events.service';

@Module({
  imports: [
    CoreModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        // Code-first: the schema is generated from the TypeScript classes. Locally it is
        // also written to disk, where the frontend's codegen reads it.
        autoSchemaFile: config.NODE_ENV === 'production' ? true : join(process.cwd(), 'schema.graphql'),
        sortSchema: true,
        graphiql: config.NODE_ENV !== 'production',
        context: ({ req }: { req?: Request }) => ({ req }),
        subscriptions: {
          'graphql-ws': {
            path: '/graphql',
            onConnect: (ctx) => accessCodeMatches(config.ACCESS_CODE, ctx.connectionParams?.accessCode),
          },
        },
      }),
    }),
  ],
  controllers: [InvoicesController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AccessCodeGuard },
    InvoicesService,
    InvoicesResolver,
    InvoiceEventsService,
  ],
  exports: [InvoicesService],
})
export class ApiModule {}
