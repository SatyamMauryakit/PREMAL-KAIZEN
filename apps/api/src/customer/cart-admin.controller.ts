import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

/**
 * GET /api/admin/carts
 * Admin-only list of customers with a non-empty persisted cart (Section 3:
 * customer cart visibility) - search/filter by customer, sorted by most
 * recently updated so abandoned carts are easy to spot. Uses the same
 * customers:view permission as the rest of the customer-admin surface since
 * this is customer data, not a separate concern.
 */
@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('customers:view')
@Controller('api/admin/carts')
export class CartAdminController {
  constructor(private cartService: CartService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.cartService.getCartsForAdmin({
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }
}
