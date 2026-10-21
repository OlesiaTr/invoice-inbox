import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import { errorMessage } from '../invoices/domain/processing-errors';
import { InvoicesService } from '../invoices/invoices.service';
import { toolJsonSchema } from './tool-types';
import { ASSISTANT_TOOLS } from './tools';

/**
 * The same tools as the in-app assistant, exposed over MCP (Streamable HTTP, stateless) so
 * Claude Desktop / Claude Code / other MCP clients can operate the invoice system.
 *
 * Here destructive tools do execute: MCP clients ask their user to approve each tool call,
 * and the tools carry `destructiveHint` so clients know which ones deserve extra care.
 */
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly invoices: InvoicesService) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response) {
    if (req.method !== 'POST') {
      // Stateless server: no server-initiated streams (GET) and no sessions to end (DELETE).
      res.status(405).set('Allow', 'POST').json({ error: 'Method not allowed' });
      return;
    }
    const server = this.createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  private createServer(): Server {
    const server = new Server({ name: 'invoice-inbox', version: '1.0.0' }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ASSISTANT_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: toolJsonSchema(t) as { type: 'object' },
        annotations: { destructiveHint: t.destructive, readOnlyHint: !t.destructive && /^(list|get)_/.test(t.name) },
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = ASSISTANT_TOOLS.find((t) => t.name === request.params.name);
      if (!tool) return { isError: true, content: [{ type: 'text', text: `Unknown tool ${request.params.name}` }] };
      const parsed = tool.schema.safeParse(request.params.arguments ?? {});
      if (!parsed.success) {
        return { isError: true, content: [{ type: 'text', text: `Invalid arguments: ${parsed.error.message}` }] };
      }
      try {
        const result = await tool.run(parsed.data, this.invoices);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        this.logger.warn(`MCP tool ${tool.name} failed: ${errorMessage(err)}`);
        return { isError: true, content: [{ type: 'text', text: errorMessage(err) }] };
      }
    });

    return server;
  }
}
