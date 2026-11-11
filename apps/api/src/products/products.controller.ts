import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

/**
 * ProductsController
 * REST API endpoints for product operations
 * Routes: /api/products
 *
 * GET endpoints are public (storefront catalog browsing).
 * POST/PUT/DELETE require an authenticated admin (AuthGuard + AdminGuard).
 */
@Controller('api/products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  /**
   * GET /api/products
   * Retrieve products with filters and pagination
   */
  @Get()
  async findAll(@Query() query: any) {
    return this.productsService.findAll({
      categories: this.toArray(query.category),
      ids: this.toArray(query.ids),
      search: query.search,
      sort: query.sort,
      sizes: this.toArray(query.sizes),
      colors: this.toArray(query.colors),
      minPrice: query.minPrice !== undefined ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice !== undefined ? parseFloat(query.maxPrice) : undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  /**
   * GET /api/products/facets
   * Distinct sizes/colors + price range across the live catalog, for the storefront's
   * filter sidebar. Must be declared before the `:id` route below, or NestJS would
   * match "facets" as an :id value instead of reaching this handler.
   */
  @Get('facets')
  async getFacets() {
    return this.productsService.getFacets();
  }

  /**
   * GET /api/products/admin
   * Admin-only product list - unlike the public GET above, this shows products of
   * every status (active and inactive) by default, so disabling a product does not
   * make it disappear from the admin panel. Must be declared before the `:id` route
   * below, same reasoning as `facets`.
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:view')
  @Get('admin')
  async findAllForAdmin(@Query() query: any) {
    return this.productsService.findAllForAdmin({
      categories: this.toArray(query.category),
      ids: this.toArray(query.ids),
      search: query.search,
      sort: query.sort,
      sizes: this.toArray(query.sizes),
      colors: this.toArray(query.colors),
      minPrice: query.minPrice !== undefined ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice !== undefined ? parseFloat(query.maxPrice) : undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      status: ['active', 'inactive', 'out_of_stock'].includes(query.status) ? query.status : 'all',
    });
  }

  /**
   * GET /api/products/admin/deleted
   * Section 4D "Deleted Products" admin view - the only place a soft-deleted
   * product is ever listed. Must be declared before `:id`, same reasoning as
   * `facets`/`admin` above.
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:view')
  @Get('admin/deleted')
  async findDeleted(@Query() query: any) {
    return this.productsService.findDeleted({
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  /**
   * GET /api/products/:id
   * Retrieve a single published product by ID (storefront). Unpublished/draft
   * products 404 here even with a direct link.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  /**
   * GET /api/products/:id/full
   * Admin-only: load a product regardless of published status, so drafts can be edited.
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:view')
  @Get(':id/full')
  async findOneForAdmin(@Param('id') id: string) {
    return this.productsService.findById(id, true);
  }

  /**
   * POST /api/products
   * Create a new product (admin only)
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:manage')
  @Post()
  async create(@Body() createProductDto: any) {
    return this.productsService.create(createProductDto);
  }

  /**
   * PUT /api/products/:id
   * Update a product (admin only)
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:manage')
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: any) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * DELETE /api/products/:id
   * Soft-delete a product (admin only). The product is hidden from both the
   * public catalog and the normal admin list, but its row (and every historical
   * order referencing it) is preserved - see ProductsService.delete. Recoverable
   * via POST :id/restore; only permanentlyDelete actually removes the row.
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }

  /**
   * POST /api/products/:id/restore
   * Undo a soft delete (admin only). Restores the row to the normal admin list
   * as a disabled draft - does not auto re-activate it.
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:manage')
  @Post(':id/restore')
  async restore(@Param('id') id: string) {
    return this.productsService.restore(id);
  }

  /**
   * DELETE /api/products/:id/permanent
   * Permanently remove a product row (admin only). Requires the product to
   * already be soft-deleted, and refuses when historical orders reference it.
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('products:manage')
  @Delete(':id/permanent')
  async permanentlyDelete(@Param('id') id: string) {
    return this.productsService.permanentlyDelete(id);
  }

  /**
   * Express/qs parses a single repeated query key (`?sizes=M`) as a string but
   * multiple (`?sizes=M&sizes=L`) as an array - normalize to always-array so
   * ProductsService doesn't need to care which shape arrived.
   */
  private toArray(value: unknown): string[] | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return Array.isArray(value) ? value : [String(value)];
  }
}
