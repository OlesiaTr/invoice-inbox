import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Response } from 'express';
import { errorMessage } from '../invoices/domain/processing-errors';
import { currentContext } from './request-context';

/**
 * One response shape for every REST error, and — more importantly — nothing leaks out of
 * an unexpected throw. `HttpException`s are deliberate messages written for the caller, so
 * they pass through; anything else becomes a flat 500 and the detail goes to the log only.
 *
 * GraphQL errors are normalised separately, in the driver's `formatError` (api.module.ts).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // Non-HTTP contexts (the worker, GraphQL) have no response to write to.
    if (host.getType() !== 'http') throw exception;

    const { httpAdapter } = this.httpAdapterHost;
    const res = host.switchToHttp().getResponse<Response>();
    const correlationId = currentContext()?.correlationId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      httpAdapter.reply(
        res,
        typeof body === 'string' ? { statusCode: status, message: body, correlationId } : { ...body, correlationId },
        status,
      );
      return;
    }

    this.logger.error(`Unhandled error: ${errorMessage(exception)}`, exception instanceof Error ? exception.stack : '');
    httpAdapter.reply(
      res,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        // Deliberately generic: the correlation id is how you find the real cause.
        message: 'Something went wrong. Quote the correlation id if you report this.',
        correlationId,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
