import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  memberships,
  userRoles,
  roles,
  rolePermissions,
  permissions,
} from '@spare-parts/db/src/schema';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';

import { PERMISSIONS_KEY } from './permissions.decorator';

type ReqHeaders = { headers: Record<string, string | string[] | undefined> };
type ReqUser = { user?: { userId: string; tenantId: string; permissions: Set<string> } };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const raw = ctx.switchToHttp().getRequest<unknown>();
    const req = raw as ReqHeaders & ReqUser;
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    const userId = String(req.headers['x-user-id'] ?? '');
    const tenantId = String(req.headers['x-tenant-id'] ?? '');

    try {
      if (!userId || !tenantId) throw new UnauthorizedException('Missing x-user-id or x-tenant-id');

      // 1) Membership check
      const memberRows = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.tenantId, tenantId),
            eq(memberships.status, 'active'),
          ),
        )
        .limit(1);

      if (memberRows.length === 0) {
        throw new ForbiddenException('No active membership for this tenant');
      }

      // 2) Effective permissions
      const permRows = await db
        .select({ perm: permissions.key })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));

      const effective = new Set(permRows.map((r) => r.perm));
      req.user = { userId, tenantId, permissions: effective };

      if (required.length === 0) return true;
      for (const p of required)
        if (!effective.has(p)) {
          throw new ForbiddenException(`Missing required permission: ${p}`);
        }
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      throw err; // Nest will turn this into 401/403/500 depending on error type
    }
  }
}
