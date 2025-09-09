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
} from '@spare-parts/db/src/schema/rbac';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';

import type { AppDb } from '../db';

import { PERMISSIONS_KEY } from './permissions.decorator';

type AuthedRequest = Request & {
  db?: AppDb;
  user?: { userId: string; tenantId: string; permissions: Set<string> };
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    const userId = req.header('x-user-id') ?? '';
    const tenantId = req.header('x-tenant-id') ?? '';
    if (!userId || !tenantId) {
      throw new UnauthorizedException('Missing x-user-id or x-tenant-id');
    }
    if (!req.db) {
      throw new ForbiddenException('Request DB not initialized');
    }

    // Must be an active member
    const member = await req.db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, userId),
        eq(memberships.tenantId, tenantId),
        eq(memberships.status, 'active'),
      ),
      columns: { id: true },
    });
    if (!member) throw new ForbiddenException('No active membership for this tenant');

    // Compute effective permissions
    const rows = await req.db
      .select({ perm: permissions.key })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));

    const effective = new Set(rows.map((r) => r.perm));
    req.user = { userId, tenantId, permissions: effective };

    if (required.length === 0) return true;
    const ok = required.every((p) => effective.has(p));
    if (!ok) throw new ForbiddenException('Missing required permission(s)');
    return true;
  }
}
