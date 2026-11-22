import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BannersService } from './banners.service';

function makePrismaMock() {
  return {
    homeBanner: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  };
}

describe('BannersService.getActive', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: BannersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new BannersService(prisma as any);
  });

  it('filters by isActive, placement, and the schedule window', async () => {
    prisma.homeBanner.findMany.mockResolvedValue([]);
    await service.getActive('hero');
    const call = prisma.homeBanner.findMany.mock.calls[0][0];
    expect(call.where.isActive).toBe(true);
    expect(call.where.placement).toBe('hero');
    expect(call.where.AND).toHaveLength(2);
    expect(call.orderBy).toEqual({ order: 'asc' });
  });

  it('omits the placement filter when none is given', async () => {
    prisma.homeBanner.findMany.mockResolvedValue([]);
    await service.getActive();
    const call = prisma.homeBanner.findMany.mock.calls[0][0];
    expect(call.where.placement).toBeUndefined();
  });
});

describe('BannersService.create', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: BannersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new BannersService(prisma as any);
  });

  it('auto-assigns the next order within the same placement when none is given', async () => {
    prisma.homeBanner.aggregate.mockResolvedValue({ _max: { order: 2 } });
    prisma.homeBanner.create.mockResolvedValue({ id: 'b1' });

    await service.create({ placement: 'hero', imageUrl: 'https://x/a.jpg', title: 'Big Sale' } as any);

    expect(prisma.homeBanner.aggregate).toHaveBeenCalledWith({ where: { placement: 'hero' }, _max: { order: true } });
    expect(prisma.homeBanner.create.mock.calls[0][0].data.order).toBe(3);
  });

  it('starts at order 0 for the first banner in a placement', async () => {
    prisma.homeBanner.aggregate.mockResolvedValue({ _max: { order: null } });
    prisma.homeBanner.create.mockResolvedValue({ id: 'b1' });

    await service.create({ placement: 'sidebar', imageUrl: 'https://x/a.jpg', title: 'Offer' } as any);

    expect(prisma.homeBanner.create.mock.calls[0][0].data.order).toBe(0);
  });

  it('persists mobileImageUrl when provided', async () => {
    prisma.homeBanner.aggregate.mockResolvedValue({ _max: { order: null } });
    prisma.homeBanner.create.mockResolvedValue({ id: 'b1' });

    await service.create({
      placement: 'hero',
      imageUrl: 'https://x/desktop.jpg',
      mobileImageUrl: 'https://x/mobile.jpg',
      title: 'Big Sale',
    } as any);

    expect(prisma.homeBanner.create.mock.calls[0][0].data.mobileImageUrl).toBe('https://x/mobile.jpg');
  });

  it('persists textColor and fontStyle when provided', async () => {
    prisma.homeBanner.aggregate.mockResolvedValue({ _max: { order: null } });
    prisma.homeBanner.create.mockResolvedValue({ id: 'b1' });

    await service.create({
      placement: 'hero',
      imageUrl: 'https://x/a.jpg',
      title: 'Big Sale',
      textColor: '#FFFFFF',
      fontStyle: 'sans',
    } as any);

    expect(prisma.homeBanner.create.mock.calls[0][0].data.textColor).toBe('#FFFFFF');
    expect(prisma.homeBanner.create.mock.calls[0][0].data.fontStyle).toBe('sans');
  });

  it('defaults isActive to true', async () => {
    prisma.homeBanner.aggregate.mockResolvedValue({ _max: { order: null } });
    prisma.homeBanner.create.mockResolvedValue({ id: 'b1' });

    await service.create({ placement: 'strip', imageUrl: 'https://x/a.jpg', title: 'Deal' } as any);

    expect(prisma.homeBanner.create.mock.calls[0][0].data.isActive).toBe(true);
  });
});

describe('BannersService.update', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: BannersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new BannersService(prisma as any);
  });

  it('throws NotFoundException for a missing banner', async () => {
    prisma.homeBanner.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { title: 'New' } as any)).rejects.toThrow(NotFoundException);
  });

  it('rejects endAt at or before startAt when both are supplied', async () => {
    prisma.homeBanner.findUnique.mockResolvedValue({ id: 'b1' });
    await expect(
      service.update('b1', { startAt: '2026-01-10T00:00:00.000Z', endAt: '2026-01-01T00:00:00.000Z' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.homeBanner.update).not.toHaveBeenCalled();
  });
});

describe('BannersService.reorder', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: BannersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new BannersService(prisma as any);
  });

  it('rejects when an id does not exist and writes nothing', async () => {
    prisma.homeBanner.findMany.mockResolvedValueOnce([{ id: 'b1' }]);
    await expect(service.reorder(['b1', 'b2'])).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies array-position order to every banner', async () => {
    prisma.homeBanner.findMany
      .mockResolvedValueOnce([{ id: 'b1' }, { id: 'b2' }])
      .mockResolvedValueOnce([{ id: 'b2', order: 0 }, { id: 'b1', order: 1 }]);

    await service.reorder(['b2', 'b1']);

    expect(prisma.homeBanner.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { order: 0 } });
    expect(prisma.homeBanner.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { order: 1 } });
  });
});
