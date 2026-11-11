import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('analytics:view')
@Controller('api/admin/analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboard(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.analyticsService.getDashboardMetrics(start, end);
  }

  @Get('sales-trend')
  async getSalesTrend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: 'day' | 'week' | 'month' = 'day'
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.analyticsService.getSalesTrend(start, end, interval);
  }

  @Get('product-performance')
  async getProductPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit: string = '20'
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.analyticsService.getProductPerformance(start, end, parseInt(limit));
  }

  @Get('order-status-distribution')
  async getOrderStatusDistribution(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.analyticsService.getOrderStatusDistribution(start, end);
  }

  @Get('promotion-performance')
  async getPromotionPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.analyticsService.getPromotionPerformance(start, end);
  }
}
