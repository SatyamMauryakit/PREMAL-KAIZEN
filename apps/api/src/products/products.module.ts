import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

/**
 * ProductsModule
 * Encapsulates all product-related functionality.
 * This module is responsible for:
 * - Managing product catalog
 * - Product search and filtering
 * - Product metadata
 */
@Module({
  imports: [],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
