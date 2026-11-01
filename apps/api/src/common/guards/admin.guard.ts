import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

/**
 * AdminGuard
 * Builds on AuthGuard: requires a valid session AND an admin role.
 * Always run AuthGuard first (e.g. @UseGuards(AuthGuard, AdminGuard)) so
 * req.user is populated before this guard inspects the role.
 */
@Injectable()
export class AdminGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Administrator access required');
    }

    return true;
  }
}
