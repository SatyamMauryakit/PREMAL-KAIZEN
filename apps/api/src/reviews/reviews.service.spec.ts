import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function makePrismaMock() {
  return {
    orderItem: { findUnique: vi.fn(), findMany: vi.fn() },
    review: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  };
}

describe('ReviewsService.create - purchase verification (never trust the client)', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ReviewsService;
  const dto = { productId: 'prod_1', orderItemId: 'oi_1', rating: 5, title: 'Great product', description: 'Loved it, fits perfectly.' };

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ReviewsService(prisma as any);
  });

  it('rejects when the order item does not exist', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(null);
    await expect(service.create('user_1', dto as any)).rejects.toThrow(NotFoundException);
  });

  it('rejects review for another customer\'s order - as 404, not 403, so a guessed id is never confirmed to exist', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'prod_1',
      order: { userId: 'someone_else', status: 'delivered' },
      review: null,
    });
    await expect(service.create('user_1', dto as any)).rejects.toThrow(NotFoundException);
  });

  it('rejects a review for a product not actually in that order item', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'a-different-product',
      order: { userId: 'user_1', status: 'delivered' },
      review: null,
    });
    await expect(service.create('user_1', dto as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects a review for a non-delivered order (e.g. still "shipped")', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'prod_1',
      order: { userId: 'user_1', status: 'shipped' },
      review: null,
    });
    await expect(service.create('user_1', dto as any)).rejects.toThrow(BadRequestException);
  });

  it('accepts a return_requested order - it was delivered before the return, not skipped', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'prod_1',
      order: { userId: 'user_1', status: 'return_requested' },
      review: null,
    });
    prisma.review.create.mockResolvedValue({ id: 'rev_1', status: 'pending' });

    await service.create('user_1', dto as any);
    expect(prisma.review.create).toHaveBeenCalled();
  });

  it('rejects a duplicate review for an order item already reviewed (pre-check)', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'prod_1',
      order: { userId: 'user_1', status: 'delivered' },
      review: { id: 'existing_review' },
    });
    await expect(service.create('user_1', dto as any)).rejects.toThrow(ConflictException);
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('translates a DB-level unique-constraint race (P2002) into the same friendly conflict error', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'prod_1',
      order: { userId: 'user_1', status: 'delivered' },
      review: null,
    });
    prisma.review.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.create('user_1', dto as any)).rejects.toThrow(ConflictException);
  });

  it('creates the review as pending (never auto-approved) and never trusts a client-supplied userId', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'prod_1',
      order: { userId: 'user_1', status: 'delivered' },
      review: null,
    });
    prisma.review.create.mockResolvedValue({ id: 'rev_1' });

    await service.create('user_1', dto as any);

    const createArgs = prisma.review.create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe('user_1'); // from the authenticated session param, not dto
    expect(createArgs.data.status).toBe('pending');
  });

  it('stores HTML/script content as literal text - no sanitization needed at write time since nothing renders it unsafely, but it must not be dropped/mangled', async () => {
    prisma.orderItem.findUnique.mockResolvedValue({
      id: 'oi_1',
      productId: 'prod_1',
      order: { userId: 'user_1', status: 'delivered' },
      review: null,
    });
    prisma.review.create.mockResolvedValue({ id: 'rev_1' });

    const maliciousDto = { ...dto, title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)> nice fit' };
    await service.create('user_1', maliciousDto as any);

    const createArgs = prisma.review.create.mock.calls[0][0];
    expect(createArgs.data.title).toBe('<script>alert(1)</script>');
    expect(createArgs.data.description).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('ReviewsService.getApprovedForProduct - pagination and sorting', () => {
  it('filters to approved-only and supports newest/highest/lowest sort', async () => {
    const prisma = makePrismaMock();
    prisma.review.findMany.mockResolvedValue([]);
    prisma.review.count.mockResolvedValue(0);
    const service = new ReviewsService(prisma as any);

    await service.getApprovedForProduct('prod_1', { sort: 'highest', page: 2, limit: 5 });

    const call = prisma.review.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ productId: 'prod_1', status: 'approved' });
    expect(call.orderBy[0]).toEqual({ rating: 'desc' });
    expect(call.skip).toBe(5); // (page 2 - 1) * limit 5
    expect(call.take).toBe(5);
  });

  it('marks every returned review as a verified purchase (true by construction, never a fakeable flag)', async () => {
    const prisma = makePrismaMock();
    prisma.review.findMany.mockResolvedValue([
      { id: 'r1', rating: 5, title: 'T', description: 'D', createdAt: new Date(), updatedAt: new Date(), user: { firstName: 'Priya', lastName: 'Sharma' } },
    ]);
    prisma.review.count.mockResolvedValue(1);
    const service = new ReviewsService(prisma as any);

    const result = await service.getApprovedForProduct('prod_1');
    expect(result.data[0].verifiedPurchase).toBe(true);
    expect(result.data[0].reviewerName).toBe('Priya S.');
  });
});

describe('ReviewsService.getRatingSummary - rating recalculation only counts approved reviews', () => {
  it('computes average and distribution from approved reviews only', async () => {
    const prisma = makePrismaMock();
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.3333 }, _count: { rating: 3 } });
    prisma.review.groupBy.mockResolvedValue([
      { rating: 5, _count: { rating: 2 } },
      { rating: 3, _count: { rating: 1 } },
    ]);
    const service = new ReviewsService(prisma as any);

    const summary = await service.getRatingSummary('prod_1');

    expect(prisma.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'prod_1', status: 'approved' } }),
    );
    expect(summary.average).toBe(4.3);
    expect(summary.total).toBe(3);
    expect(summary.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 });
  });

  it('returns a zeroed summary when there are no approved reviews yet', async () => {
    const prisma = makePrismaMock();
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
    prisma.review.groupBy.mockResolvedValue([]);
    const service = new ReviewsService(prisma as any);

    const summary = await service.getRatingSummary('prod_1');
    expect(summary).toEqual({ average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });
});

describe('ReviewsService.getEligibility', () => {
  it('reports eligible when a delivered, unreviewed order item exists for this product', async () => {
    const prisma = makePrismaMock();
    prisma.orderItem.findMany.mockResolvedValue([
      { id: 'oi_1', order: { status: 'delivered', orderNumber: 'PK-1' }, review: null },
    ]);
    const service = new ReviewsService(prisma as any);

    const result = await service.getEligibility('user_1', 'prod_1');
    expect(result.canReview).toBe(true);
    expect(result.eligibleOrderItems).toEqual([{ orderItemId: 'oi_1', orderNumber: 'PK-1' }]);
  });

  it('reports not eligible when the only purchase has already been reviewed', async () => {
    const prisma = makePrismaMock();
    prisma.orderItem.findMany.mockResolvedValue([
      { id: 'oi_1', order: { status: 'delivered', orderNumber: 'PK-1' }, review: { id: 'rev_1' } },
    ]);
    const service = new ReviewsService(prisma as any);

    const result = await service.getEligibility('user_1', 'prod_1');
    expect(result.canReview).toBe(false);
    expect(result.alreadyReviewed).toBe(true);
    expect(result.hasPurchased).toBe(true);
  });

  it('reports not eligible (and not purchased) when there is no order item for this product at all', async () => {
    const prisma = makePrismaMock();
    prisma.orderItem.findMany.mockResolvedValue([]);
    const service = new ReviewsService(prisma as any);

    const result = await service.getEligibility('user_1', 'prod_1');
    expect(result.canReview).toBe(false);
    expect(result.hasPurchased).toBe(false);
  });
});

describe('ReviewsService.update - owner-only, re-queues for moderation', () => {
  it('rejects editing someone else\'s review (404, not 403)', async () => {
    const prisma = makePrismaMock();
    prisma.review.findUnique.mockResolvedValue({ id: 'rev_1', userId: 'someone_else' });
    const service = new ReviewsService(prisma as any);

    await expect(service.update('user_1', 'rev_1', { title: 'edited' } as any)).rejects.toThrow(NotFoundException);
  });

  it('resets status to pending and clears prior moderation fields on edit', async () => {
    const prisma = makePrismaMock();
    prisma.review.findUnique.mockResolvedValue({
      id: 'rev_1', userId: 'user_1', rating: 4, title: 'Old', description: 'Old text long enough',
    });
    prisma.review.update.mockResolvedValue({ id: 'rev_1' });
    const service = new ReviewsService(prisma as any);

    await service.update('user_1', 'rev_1', { title: 'New title' } as any);

    const updateArgs = prisma.review.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('pending');
    expect(updateArgs.data.moderatedBy).toBeNull();
    expect(updateArgs.data.moderatedAt).toBeNull();
  });
});

describe('ReviewsService.moderate - admin moderation records who/when', () => {
  it('approves a review and stamps the moderating admin + timestamp', async () => {
    const prisma = makePrismaMock();
    prisma.review.findUnique.mockResolvedValue({ id: 'rev_1' });
    prisma.review.update.mockResolvedValue({ id: 'rev_1', status: 'approved' });
    const service = new ReviewsService(prisma as any);

    await service.moderate('admin_1', 'rev_1', { status: 'approved' } as any);

    const updateArgs = prisma.review.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('approved');
    expect(updateArgs.data.moderatedBy).toBe('admin_1');
    expect(updateArgs.data.moderatedAt).toBeInstanceOf(Date);
  });

  it('404s when moderating a review that does not exist', async () => {
    const prisma = makePrismaMock();
    prisma.review.findUnique.mockResolvedValue(null);
    const service = new ReviewsService(prisma as any);

    await expect(service.moderate('admin_1', 'nope', { status: 'approved' } as any)).rejects.toThrow(NotFoundException);
  });
});
