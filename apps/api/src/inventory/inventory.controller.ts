import { Controller, Get, Post, Put, Param, Query, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

/**
 * Inventory is an admin-only module - all endpoints require an authenticated admin.
 */
@UseGuards(AuthGuard, AdminGuard)
@Controller('api/inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  async getInventory(@Query() query: any) {
    return this.inventoryService.getInventory({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      search: query.search,
      status: query.status,
      categoryId: query.categoryId,
      productId: query.productId,
    });
  }

  @Get('low-stock')
  async getLowStockItems(@Query('threshold') threshold?: string) {
    return this.inventoryService.getLowStockItems(threshold ? parseInt(threshold) : undefined);
  }

  @Get('audit-log')
  async getAuditLog(@Query() query: any) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.inventoryService.getAuditLog({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      inventoryId: query.inventoryId,
      changeType: query.changeType,
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
    });
  }

  @Get('product/:productId')
  async getProductInventory(@Param('productId') productId: string) {
    const inventory = await this.inventoryService.getInventory({
      productId,
    });
    return inventory.data;
  }

  @Get('variant/:productId')
  async getVariantInventory(
    @Param('productId') productId: string,
    @Query('size') size?: string,
    @Query('color') color?: string
  ) {
    return this.inventoryService.getInventoryByVariant(productId, size, color);
  }

  @Post('adjust/:productId')
  async adjustInventory(
    @Param('productId') productId: string,
    @Body() body: any
  ) {
    if (!body.type || !body.quantity || !body.reason) {
      throw new BadRequestException('type, quantity, and reason are required');
    }

    return this.inventoryService.adjustInventory(productId, {
      size: body.size,
      color: body.color,
      type: body.type,
      quantity: parseInt(body.quantity),
      reason: body.reason,
      reference: body.reference,
      adminId: body.adminId,
      notes: body.notes,
    });
  }

  @Put('reorder-threshold/:productId')
  async updateReorderThreshold(
    @Param('productId') productId: string,
    @Query('size') size: string | undefined,
    @Query('color') color: string | undefined,
    @Body() body: any
  ) {
    if (body.threshold === undefined) {
      throw new BadRequestException('threshold is required');
    }

    return this.inventoryService.updateReorderThreshold(
      productId,
      size || null,
      color || null,
      parseInt(body.threshold)
    );
  }

  @Post('initialize/:productId')
  async initializeInventory(@Param('productId') productId: string) {
    return this.inventoryService.initializeProductInventory(productId);
  }
}
