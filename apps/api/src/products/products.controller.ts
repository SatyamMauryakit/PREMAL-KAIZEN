import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { ProductsService } from './products.service';

/**
 * ProductsController
 * REST API endpoints for product operations
 * Routes: /api/products
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
    return this.productsService.findAll(query);
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
   * Create a new product (requires admin authentication)
   */
  @Post()
  async create(@Body() createProductDto: any) {
    return this.productsService.create(createProductDto);
  }

  /**
   * PUT /api/products/:id
   * Update a product (requires admin authentication)
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: any) {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * DELETE /api/products/:id
   * Delete a product (requires admin authentication)
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }
}
