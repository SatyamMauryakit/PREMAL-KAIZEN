import { Controller, Get, Put, Param, Query, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { CustomerAdminService } from './customer-admin.service';
import { CartService } from './cart.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('customers:view')
@Controller('api/admin/customers')
export class CustomerAdminController {
  constructor(
    private customerAdminService: CustomerAdminService,
    private cartService: CartService,
  ) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.customerAdminService.findAll({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      search: query.search,
      status: query.status,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
    });
  }

  @Get('statistics')
  async getStatistics() {
    return this.customerAdminService.getStatistics();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customerAdminService.findById(id);
  }

  @Get(':id/orders')
  async getOrderHistory(@Param('id') customerId: string, @Query() query: any) {
    return this.customerAdminService.getOrderHistory(customerId, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 10,
      status: query.status,
    });
  }

  @Get(':id/export')
  async exportData(@Param('id') id: string) {
    return this.customerAdminService.getCustomerDataExport(id);
  }

  /**
   * GET /api/admin/customers/:id/cart
   * Read-only view of a single customer's current persisted cart (Section 3).
   * Confirms the customer exists first so an invalid id 404s cleanly rather
   * than returning an empty cart indistinguishable from "cart is empty".
   */
  @Get(':id/cart')
  async getCart(@Param('id') id: string) {
    await this.customerAdminService.findById(id); // throws NotFoundException if missing
    return this.cartService.getCartForUser(id);
  }

  @RequirePermission('customers:manage')
  @Put(':id/status')
  async setStatus(@Param('id') id: string, @Body() body: any) {
    if (body.isActive === undefined) {
      throw new BadRequestException('isActive is required');
    }

    return this.customerAdminService.setAccountStatus(id, body.isActive, body.reason);
  }
}
