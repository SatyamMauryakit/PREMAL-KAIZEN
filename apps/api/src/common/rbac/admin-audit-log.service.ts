import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AdminAuditEntry {
  actorId: string;
  actorEmail: string;
  action: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Records administrative actions (admin creation, role changes, activation /
 * deactivation) for accountability. Distinct from SettingsAuditLog, which only
 * tracks store-setting value changes - this log tracks actions taken against
 * admin accounts themselves.
 */
@Injectable()
export class AdminAuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(entry: AdminAuditEntry): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetId: entry.targetId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
      },
    });
  }

  async list(filters: { actorId?: string; targetId?: string; limit?: number; offset?: number } = {}) {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const where: Record<string, unknown> = {};
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.targetId) where.targetId = filters.targetId;

    const [data, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return { data, total, limit, offset };
  }
}
