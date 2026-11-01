import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AuthGuard
 * Verifies the request carries a valid, non-expired session token
 * (Authorization: Bearer <token> header, or sessionToken cookie)
 * and attaches the authenticated user to the request as `req.user`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('This account has been disabled');
    }

    const { password: _password, ...userWithoutPassword } = session.user;
    request.user = userWithoutPassword;
    return true;
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim() || null;
    }
    return request.cookies?.sessionToken || null;
  }
}
