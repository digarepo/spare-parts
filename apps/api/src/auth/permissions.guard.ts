import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  memberships,
  userRoles,
  roles,
  rolePermissions,
  permissions,
  memberStatusEnum,
} from '@spare-parts/db/src/schema/rbac';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';

import { withTenantDb, type AppDb } from '../db';

import { PERMISSIONS_KEY } from './permissions.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

type AuthUser = {
  userId: string;
  tenantId: string;
  email: string;
  permissions?: Set<string>;
};

type AuthedRequest = Request & { user?: AuthUser };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();

    // Permissions required by the route (can be empty)
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;

    // Must be authenticated (JwtGuard should have set req.user)
    const user = req.user;
    if (!user) throw new UnauthorizedException('Auth required');

    const { userId, tenantId } = user;
    if (!tenantId) throw new UnauthorizedException('Tenant context missing');

    // drizzle enum-safe literal
    const ACTIVE = 'active' as (typeof memberStatusEnum.enumValues)[number];

    // Use RLS-aware DB per request
    return withTenantDb(tenantId, async (rdb: AppDb): Promise<boolean> => {
      // 1) Verify active membership
      const member = await rdb
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.tenantId, tenantId),
            eq(memberships.status, ACTIVE),
          ),
        )
        .limit(1);

      if (member.length === 0) {
        throw new ForbiddenException('No active membership for this tenant');
      }

      // 2) Compute effective permissions from roles
      const rows = await rdb
        .select({ perm: permissions.key })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));

      const effective = new Set<string>(rows.map((r) => r.perm));

      // Attach to request for downstream usage
      req.user = { ...user, permissions: effective };

      // 3) If route requires permissions, verify all of them
      const ok = required.every((p) => effective.has(p));
      if (!ok) throw new ForbiddenException('Missing required permission(s)');
      return true;
    });
  }
}
