import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/**
 * HealthController
 * Unauthenticated, intended for container liveness/readiness probes. Deliberately
 * exposes nothing beyond up/down status - no stack traces, connection strings,
 * versions, or any other internal detail.
 */
@SkipThrottle()
@Controller('api/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: is the process itself up and able to handle a request at all? Never
  // touches the database - a slow/unreachable DB must not make Kubernetes think the
  // whole pod is dead and restart it in a loop while the DB recovers.
  @Get()
  @HttpCode(200)
  liveness() {
    return { status: 'ok' };
  }

  // Readiness: can this instance actually serve real requests right now? Checks DB
  // connectivity with a trivial query; any failure is reported generically, without
  // the underlying error message (which could include the connection string).
  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error' });
    }
  }
}
