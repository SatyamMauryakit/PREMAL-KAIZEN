import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './require-permission.decorator';
import { roleHasPermission, isAdminRole } from './permissions';

/**
 * Enforces granular admin permissions. Always runs after AuthGuard + AdminGuard
 * (@UseGuards(AuthGuard, AdminGuard, PermissionGuard)) - those two guarantee
 * req.user is populated and req.user.role === 'admin' before this guard runs.
 *
 * Routes with no @RequirePermission() are left untouched (return true) so this
 * guard can be layered onto the existing admin surface incrementally without
 * breaking anything not yet migrated to a specific permission.
 *
 * SUPER_ADMIN implicitly passes every permission check.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Method-level @RequirePermission() overrides a class-level one, so a single
    // route within an otherwise-uniform controller can still ask for something
    // more specific (e.g. a stricter permission than the rest of the controller).
    const required = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Administrator access required');
    }

    const adminRole = isAdminRole(user.adminRole) ? user.adminRole : null;

    if (adminRole === 'SUPER_ADMIN') return true;

    if (!roleHasPermission(adminRole, required as any)) {
      throw new ForbiddenException(`You do not have permission to perform this action (${required})`);
    }

    return true;
  }
}
