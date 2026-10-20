import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, runWithContext } from './request-context';

/**
 * Opens a context per HTTP request, reusing an upstream `x-request-id` when a proxy or
 * client already set one so a trace survives across service boundaries. The id is echoed
 * back on the response, which makes a user-reported error findable in the logs.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
    res.setHeader(REQUEST_ID_HEADER, correlationId);
    runWithContext({ correlationId }, () => next());
  }
}
