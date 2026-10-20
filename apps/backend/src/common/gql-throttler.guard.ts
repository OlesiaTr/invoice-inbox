import { type ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * The stock ThrottlerGuard reads the Express request off the HTTP context, which a GraphQL
 * resolver doesn't have — so without this, every GraphQL field would go unthrottled.
 * Mirrors how AccessCodeGuard reaches the request (see access-code.guard.ts).
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(ctx: ExecutionContext): { req: Request; res: Response } {
    if (ctx.getType<GqlContextType>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(ctx).getContext<{ req?: Request; res?: Response }>();
      return { req: gqlCtx?.req as Request, res: gqlCtx?.res as Response };
    }
    const http = ctx.switchToHttp();
    return { req: http.getRequest<Request>(), res: http.getResponse<Response>() };
  }

  /**
   * A WebSocket subscription carries no HTTP request or response: there is no IP to key a
   * counter on, and nothing to write rate-limit headers to. Those connections are
   * authorised once in `onConnect` instead.
   *
   * Keyed off the request/response pair rather than the context shape, because the shape
   * differs between transports — getting this wrong made every subscription fail with
   * "Cannot read properties of undefined (reading 'header')" when the guard tried to set
   * its headers on a response that doesn't exist.
   */
  protected async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    const { req, res } = this.getRequestResponse(ctx);
    if (!req || !res) return true;
    return super.shouldSkip(ctx);
  }
}
