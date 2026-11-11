import { Controller, Get, Put, Delete, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

/**
 * AdminReviewsController
 * Review moderation queue - every route here requires an authenticated admin.
 */
@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('reviews:moderate')
@Controller('api/admin/reviews')
export class AdminReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  /**
   * GET /api/admin/reviews
   * Filterable by product/status/date range, paginated.
   */
  @Get()
  async list(
    @Query('status') status?: string,
    @Query('productId') productId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.adminList({
      status,
      productId,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * PUT /api/admin/reviews/:id/moderate
   * Approve or reject, with an optional internal note. Records who/when.
   */
  @Put(':id/moderate')
  async moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto, @Req() req: any) {
    return this.reviewsService.moderate(req.user.id, id, dto);
  }

  /**
   * DELETE /api/admin/reviews/:id
   * Permanently removes an inappropriate review (distinct from "rejected",
   * which keeps the record for the moderation audit trail).
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
