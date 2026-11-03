import { describe, it, expect, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

function makePrisma(queryRawImpl: () => Promise<unknown>) {
  return { $queryRaw: vi.fn().mockImplementation(queryRawImpl) } as any;
}

describe('HealthController', () => {
  describe('liveness (GET /api/health)', () => {
    it('returns ok without touching the database at all', async () => {
      const prisma = makePrisma(() => {
        throw new Error('should never be called');
      });
      const controller = new HealthController(prisma);

      expect(controller.liveness()).toEqual({ status: 'ok' });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('exposes nothing beyond a bare status', () => {
      const controller = new HealthController(makePrisma(() => Promise.resolve()));
      const result = controller.liveness();
      expect(Object.keys(result)).toEqual(['status']);
    });
  });

  describe('readiness (GET /api/health/ready)', () => {
    it('returns ok when the database responds', async () => {
      const prisma = makePrisma(() => Promise.resolve([{ 1: 1 }]));
      const controller = new HealthController(prisma);

      await expect(controller.readiness()).resolves.toEqual({ status: 'ok' });
    });

    it('returns 503 (not a 500 with a stack trace) when the database is unreachable', async () => {
      const prisma = makePrisma(() => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432')));
      const controller = new HealthController(prisma);

      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });

    it('never leaks the underlying error message (e.g. a connection string/host) to the caller', async () => {
      const prisma = makePrisma(() => Promise.reject(new Error('password authentication failed for user "admin"')));
      const controller = new HealthController(prisma);

      try {
        await controller.readiness();
        expect.unreachable('should have thrown');
      } catch (err) {
        const response = (err as ServiceUnavailableException).getResponse();
        expect(JSON.stringify(response)).not.toContain('password');
        expect(JSON.stringify(response)).not.toContain('admin');
      }
    });
  });
});
