import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/config';

export const ACCESS_CODE_HEADER = 'x-access-code';
const PUBLIC = 'isPublic';
export const Public = () => SetMetadata(PUBLIC, true);

export function accessCodeMatches(expected: string | undefined, given: unknown): boolean {
  if (!expected) return true;
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Not user authentication — just keeps random visitors out of the public demo.
 * Disabled when ACCESS_CODE is unset (local development).
 */
@Injectable()
export class AccessCodeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.config.ACCESS_CODE) return true;
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;

    let req: Request | undefined;
    if (ctx.getType<GqlContextType>() === 'graphql') {
      req = GqlExecutionContext.create(ctx).getContext<{ req?: Request }>().req;
      // WebSocket subscriptions carry no HTTP request; they are checked once in onConnect.
      if (!req) return true;
    } else {
      req = ctx.switchToHttp().getRequest<Request>();
    }
    // Query param fallback for <img>/<iframe> file previews, which can't send headers.
    const given = req.headers[ACCESS_CODE_HEADER] ?? req.query?.access_code;
    if (!accessCodeMatches(this.config.ACCESS_CODE, given)) {
      throw new UnauthorizedException('Invalid or missing access code');
    }
    return true;
  }
}
