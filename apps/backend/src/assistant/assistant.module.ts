import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { AssistantResolver } from './assistant.resolver';
import { AssistantService } from './assistant.service';
import { McpController } from './mcp.controller';

/**
 * The in-app assistant and the MCP server — the same tool registry behind both doors.
 * Both reach invoices through InvoicesModule's exported service.
 */
@Module({
  imports: [InvoicesModule],
  controllers: [McpController],
  providers: [AssistantService, AssistantResolver],
})
export class AssistantModule {}
