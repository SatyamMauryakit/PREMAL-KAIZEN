import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Marks a route as requiring a specific granular admin permission. Must be used
 * alongside @UseGuards(AuthGuard, AdminGuard, PermissionGuard) - this decorator
 * only supplies metadata for PermissionGuard to read, it enforces nothing itself.
 */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
