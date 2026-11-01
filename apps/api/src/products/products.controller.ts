import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

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
      category: query.category,
      search: query.search,
      sort: query.sort,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  /**
   * GET /api/products/:id
   * Retrieve a single product by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  /**
   * POST /api/products
   * Create a new product (admin only)
   */
  @UseGuards(AuthGuard, AdminGuard)
  @Post()
  async create(@Body() createProductDto: any) {
    return this.productsService.create(createProductDto);
  }

  /**
   * PUT /api/products/:id
   * Update a product (admin only)
   */
  @UseGuards(AuthGuard, AdminGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: any) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * DELETE /api/products/:id
   * Delete a product (admin only)
   */
  @UseGuards(AuthGuard, AdminGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }
}
