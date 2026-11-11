import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

// An order is only reviewable once the customer has actually received the goods.
// 'return_*' states are reachable only from 'delivered' (see orders.service.ts's
// STATUS_TRANSITIONS graph: delivered -> return_requested -> approved/rejected),
// so they still represent a genuinely delivered order, not a skipped delivery.
function isDeliveredStatus(status: string): boolean {
  return status === 'delivered' || status.startsWith('return_');
}

const PUBLIC_REVIEW_SELECT = {
  id: true,
  rating: true,
  title: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { firstName: true, lastName: true } },
} as const;

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Submits a review. Every eligibility fact (ownership, delivery, product match,
   * no prior review) is re-derived server-side from the order item the caller
   * references - never taken on faith from the request body. `userId` always
   * comes from the authenticated session (AuthGuard), never the request body.
   */
  async create(userId: string, dto: CreateReviewDto) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: true, review: true },
    });

    // 404, not 403, for both "doesn't exist" and "belongs to someone else" - same
    // pattern as orders.controller.ts's assertOwnerOrAdmin: never confirm to an
    // attacker that a guessed/foreign order item id exists.
    if (!orderItem || orderItem.order.userId !== userId) {
      throw new NotFoundException('Order item not found');
    }

    if (orderItem.productId !== dto.productId) {
      throw new BadRequestException('This order item does not match the specified product');
    }

    if (!isDeliveredStatus(orderItem.order.status)) {
      throw new BadRequestException('This order is not yet eligible for a review - it must be delivered first');
    }

    if (orderItem.review) {
      throw new ConflictException('You have already reviewed this purchase');
    }

    try {
      return await this.prisma.review.create({
        data: {
          productId: dto.productId,
          userId,
          orderItemId: dto.orderItemId,
          rating: dto.rating,
          title: dto.title.trim(),
          description: dto.description.trim(),
          status: 'pending',
        },
      });
    } catch (err: any) {
      // Race condition: two concurrent submissions for the same order item both
      // pass the check above, but the @unique(orderItemId) constraint lets only
      // one actually insert - translate that DB-level rejection into the same
      // friendly error rather than a raw Prisma error.
      if (err?.code === 'P2002') {
        throw new ConflictException('You have already reviewed this purchase');
      }
      throw err;
    }
  }

  /** Approved reviews for a product - the only ones ever shown publicly. */
  async getApprovedForProduct(
    productId: string,
    opts: { page?: number; limit?: number; sort?: 'newest' | 'highest' | 'lowest' } = {},
  ) {
    const page = opts.page || 1;
    const limit = opts.limit || 10;
    const skip = (page - 1) * limit;

    const orderBy =
      opts.sort === 'highest'
        ? [{ rating: 'desc' as const }, { createdAt: 'desc' as const }]
        : opts.sort === 'lowest'
          ? [{ rating: 'asc' as const }, { createdAt: 'desc' as const }]
          : [{ createdAt: 'desc' as const }];

    const where = { productId, status: 'approved' };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({ where, orderBy, skip, take: limit, select: PUBLIC_REVIEW_SELECT }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        description: r.description,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        // First name + last-initial only (e.g. "Priya S.") - never the full name
        // or any contact detail, even though every review is a verified purchase.
        reviewerName: this.formatReviewerName(r.user.firstName, r.user.lastName),
        // Every review in this system is tied to a real purchased OrderItem by
        // construction (see the Review model's comment) - there is no submission
        // path that isn't a verified purchase, so this is always true, not a
        // per-review flag that could be faked.
        verifiedPurchase: true,
      })),
      total,
      page,
      pageSize: limit,
    };
  }

  /** Average + per-star distribution, approved reviews only - the one source of truth both the API and storefront use. */
  async getRatingSummary(productId: string) {
    const where = { productId, status: 'approved' };
    const [agg, grouped] = await Promise.all([
      this.prisma.review.aggregate({ where, _avg: { rating: true }, _count: { rating: true } }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { rating: true } }),
    ]);

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const g of grouped) {
      distribution[g.rating as 1 | 2 | 3 | 4 | 5] = g._count.rating;
    }

    return {
      average: agg._count.rating > 0 ? Math.round((agg._avg.rating || 0) * 10) / 10 : 0,
      total: agg._count.rating,
      distribution,
    };
  }

  /** The caller's own reviews, any status - a customer should see their pending/rejected reviews too, just not anyone else's. */
  async getMyReviews(userId: string, opts: { page?: number; limit?: number } = {}) {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const skip = (page - 1) * limit;
    const where = { userId };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { product: { select: { id: true, name: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data: reviews, total, page, pageSize: limit };
  }

  /**
   * Which of the caller's delivered order items for this product don't have a
   * review yet - lets the storefront show "Write a review" only when genuinely
   * eligible, and a specific reason (not delivered / already reviewed / never
   * purchased) otherwise, without the client guessing.
   */
  async getEligibility(userId: string, productId: string) {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { productId, order: { userId } },
      include: { order: { select: { status: true, orderNumber: true } }, review: { select: { id: true } } },
    });

    const eligible = orderItems.filter((oi) => isDeliveredStatus(oi.order.status) && !oi.review);

    return {
      canReview: eligible.length > 0,
      eligibleOrderItems: eligible.map((oi) => ({ orderItemId: oi.id, orderNumber: oi.order.orderNumber })),
      hasPurchased: orderItems.length > 0,
      alreadyReviewed: orderItems.some((oi) => !!oi.review),
    };
  }

  /**
   * Owner-only edit. Re-submits the review for moderation (status -> 'pending')
   * rather than keeping it 'approved' - an edit is new, unmoderated content, and
   * silently keeping an already-approved status would let a customer swap in
   * different text after approval without a human ever reviewing the new version.
   */
  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: dto.rating ?? review.rating,
        title: dto.title?.trim() ?? review.title,
        description: dto.description?.trim() ?? review.description,
        status: 'pending',
        moderatedBy: null,
        moderatedAt: null,
        moderationNote: null,
      },
    });
  }

  /** Any authenticated user may flag a review as inappropriate - not owner-restricted, and not itself a moderation action. */
  async report(reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.review.update({ where: { id: reviewId }, data: { reportCount: { increment: 1 } } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Admin moderation
  // ---------------------------------------------------------------------------

  async adminList(filters: {
    status?: string;
    productId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.productId) where.productId = filters.productId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: [{ reportCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          orderItem: { select: { id: true, order: { select: { id: true, orderNumber: true } } } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data: reviews, total, page, pageSize: limit };
  }

  async moderate(adminId: string, reviewId: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: dto.status,
        moderatedBy: adminId,
        moderatedAt: new Date(),
        moderationNote: dto.moderationNote ?? null,
      },
    });
  }

  async remove(reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { success: true, message: 'Review removed' };
  }

  private formatReviewerName(firstName: string | null, lastName: string | null): string {
    const first = firstName?.trim();
    const lastInitial = lastName?.trim()?.[0];
    if (first && lastInitial) return `${first} ${lastInitial}.`;
    if (first) return first;
    return 'Verified Buyer';
  }
}
