import { Controller, Get, Post, Put, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AuthGuard } from '../common/guards/auth.guard';

/**
 * ReviewsController
 * Public review reading + authenticated customer review submission/management.
 * Routes span two path families (api/products/:productId/reviews* and
 * api/reviews*), so this controller uses an empty prefix with full paths per
 * route rather than NestJS's usual single-prefix convention - same reasoning as
 * ProductsController's `facets` route: literal path segments ("reviews",
 * "summary", "eligibility") never collide with another controller's `:id`
 * wildcard, since Express/Nest route matching is segment-exact for literals.
 */
@Controller()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  /**
   * GET /api/products/:productId/reviews
   * Public. Approved reviews only.
   */
  @Get('api/products/:productId/reviews')
  async getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: 'newest' | 'highest' | 'lowest',
  ) {
    return this.reviewsService.getApprovedForProduct(productId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sort,
    });
  }

  /**
   * GET /api/products/:productId/reviews/summary
   * Public. Average rating + star distribution, approved reviews only.
   */
  @Get('api/products/:productId/reviews/summary')
  async getProductRatingSummary(@Param('productId') productId: string) {
    return this.reviewsService.getRatingSummary(productId);
  }

  /**
   * GET /api/products/:productId/reviews/eligibility
   * Whether the authenticated customer can review this product right now, and why not if not.
   */
  @UseGuards(AuthGuard)
  @Get('api/products/:productId/reviews/eligibility')
  async getEligibility(@Param('productId') productId: string, @Req() req: any) {
    return this.reviewsService.getEligibility(req.user.id, productId);
  }

  /**
   * POST /api/reviews
   * Submit a review for a delivered, purchased order item. userId always comes
   * from the verified session, never the request body.
   */
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('api/reviews')
  async create(@Body() dto: CreateReviewDto, @Req() req: any) {
    return this.reviewsService.create(req.user.id, dto);
  }

  /**
   * GET /api/reviews/me
   * The caller's own reviews, any status.
   */
  @UseGuards(AuthGuard)
  @Get('api/reviews/me')
  async getMyReviews(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.reviewsService.getMyReviews(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * PUT /api/reviews/:id
   * Owner-only edit. Re-queues the review for moderation.
   */
  @UseGuards(AuthGuard)
  @Put('api/reviews/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateReviewDto, @Req() req: any) {
    return this.reviewsService.update(req.user.id, id, dto);
  }

  /**
   * POST /api/reviews/:id/report
   * Any authenticated customer may flag a review as inappropriate.
   */
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('api/reviews/:id/report')
  async report(@Param('id') id: string) {
    return this.reviewsService.report(id);
  }
}
