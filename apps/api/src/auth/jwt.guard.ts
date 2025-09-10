import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { verifyAccessToken } from './jwt';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Skip if route/class marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();

    const auth = String(req.headers.authorization || '');
    const [scheme, token] = auth.split(' ');

    if (scheme !== 'Bearer' || !token || token === 'null' || token === 'undefined') {
      throw new UnauthorizedException('Missing Bearer token');
    }

    try {
      const payload = verifyAccessToken(token);
      req.auth = payload;
      req.user = { userId: payload.sub, tenantId: payload.tenantId, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
