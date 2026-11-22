import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

/**
 * BannersService
 * Backs the admin-managed homepage banners (hero / strip / sidebar). Public
 * reads only ever return active rows inside their schedule window; admin
 * reads/writes are unfiltered so a draft/disabled/expired banner stays
 * editable in the admin panel even though the storefront never shows it.
 */
@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  async getActive(placement?: string) {
    const now = new Date();
    return this.prisma.homeBanner.findMany({
      where: {
        isActive: true,
        ...(placement ? { placement } : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: { order: 'asc' },
    });
  }

  async adminList() {
    return this.prisma.homeBanner.findMany({ orderBy: [{ placement: 'asc' }, { order: 'asc' }] });
  }

  async create(dto: CreateBannerDto) {
    const maxOrder = await this.prisma.homeBanner.aggregate({
      where: { placement: dto.placement },
      _max: { order: true },
    });
    return this.prisma.homeBanner.create({
      data: {
        placement: dto.placement,
        imageUrl: dto.imageUrl,
        mobileImageUrl: dto.mobileImageUrl,
        title: dto.title,
        subtitle: dto.subtitle,
        badgeText: dto.badgeText,
        ctaText: dto.ctaText,
        ctaUrl: dto.ctaUrl,
        textColor: dto.textColor,
        fontStyle: dto.fontStyle,
        order: dto.order ?? (maxOrder._max.order ?? -1) + 1,
        isActive: dto.isActive ?? true,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.mustFind(id);
    if (dto.startAt !== undefined && dto.endAt !== undefined && dto.startAt && dto.endAt) {
      if (new Date(dto.endAt) <= new Date(dto.startAt)) {
        throw new BadRequestException('endAt must be after startAt.');
      }
    }
    return this.prisma.homeBanner.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt !== undefined ? (dto.startAt ? new Date(dto.startAt) : null) : undefined,
        endAt: dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : undefined,
      },
    });
  }

  async delete(id: string) {
    await this.mustFind(id);
    await this.prisma.homeBanner.delete({ where: { id } });
    return { success: true };
  }

  /** Reorders every listed banner within its own placement to match array position. */
  async reorder(ids: string[]) {
    const existing = await this.prisma.homeBanner.findMany({ where: { id: { in: ids } } });
    if (existing.length !== ids.length) {
      throw new BadRequestException('One or more banner ids do not exist.');
    }
    await this.prisma.$transaction(ids.map((id, index) => this.prisma.homeBanner.update({ where: { id }, data: { order: index } })));
    return this.adminList();
  }

  private async mustFind(id: string) {
    const banner = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found.');
    return banner;
  }
}
