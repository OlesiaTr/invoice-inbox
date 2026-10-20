import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  async onModuleInit() {
    await this.$connect();
  }

  // Last shutdown phase: consumers stop in onModuleDestroy, which Nest runs earlier.
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
