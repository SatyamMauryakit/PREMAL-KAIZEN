import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const VALID_ADJUSTMENT_TYPES = ['received', 'correction', 'damage', 'manual_reconciliation', 'reserved', 'released'];

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) { }

  // =========================================================================
  // Order-lifecycle stock management
  // =========================================================================

  /**
   * Atomically decrement onHand for every line item in an order.
   * Must be called INSIDE the order-creation $transaction so a stock
   * check failure rolls back the entire order atomically.
   *
   * Uses a conditional `updateMany({ where: { onHand: { gte: qty } } })` so
   * two concurrent orders for the same variant cannot both succeed when only
   * one unit remains (the second write finds count=0 and throws, rolling back).
   *
   * If no inventory row exists for a variant we silently skip (the store only
   * enforces stock limits where a row is configured; absent rows = unlimited).
   */
  async decrementForOrder(
    items: Array<{ productId: string; quantity: number; selectedSize?: string | null; selectedColor?: string | null }>,
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    for (const item of items) {
      const size = item.selectedSize || null;
      const color = item.selectedColor || null;

      const inv = await this.findInventoryByVariant(tx as any, item.productId, size, color);

      // No inventory row = stock not tracked for this variant; allow the order.
      if (!inv) continue;

      const available = inv.onHand - inv.reserved;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}` +
          (size ? ` (size ${size})` : '') +
          (color ? ` (color ${color})` : '') +
          `. Available: ${available}, requested: ${item.quantity}`,
        );
      }

      // Atomic conditional decrement — write only succeeds when onHand is still
      // enough at the moment of the write, guarding against concurrent orders.
      const result = await tx.inventory.updateMany({
        where: {
          id: inv.id,
          onHand: { gte: inv.reserved + item.quantity },
        },
        data: { onHand: { decrement: item.quantity } },
      });

      if (result.count === 0) {
        throw new BadRequestException(
          `Stock was taken by a concurrent order for product ${item.productId}` +
          (size ? ` (size ${size})` : '') +
          (color ? ` (color ${color})` : '') +
          `. Please try again.`,
        );
      }

      await tx.inventoryAuditLog.create({
        data: {
          inventoryId: inv.id,
          previousOnHand: inv.onHand,
          newOnHand: inv.onHand - item.quantity,
          previousReserved: inv.reserved,
          newReserved: inv.reserved,
          changeType: 'order_placed',
          reason: `Order placed: deducted ${item.quantity} unit(s)`,
          reference: orderId,
        },
      });
    }
  }

  /**
   * Restore onHand after a cancellation or refund.
   * Called after the status change is committed. Idempotent — if the inventory
   * row doesn't exist it silently continues (nothing was tracked, nothing to restore).
   */
  async restoreForCancellation(
    items: Array<{ productId: string; quantity: number; selectedSize?: string | null; selectedColor?: string | null }>,
    orderId: string,
  ): Promise<void> {
    for (const item of items) {
      const size = item.selectedSize || null;
      const color = item.selectedColor || null;

      const inv = await this.findInventoryByVariant(this.prisma as any, item.productId, size, color);

      if (!inv) continue;

      await this.prisma.inventory.update({
        where: { id: inv.id },
        data: { onHand: { increment: item.quantity } },
      });

      await this.prisma.inventoryAuditLog.create({
        data: {
          inventoryId: inv.id,
          previousOnHand: inv.onHand,
          newOnHand: inv.onHand + item.quantity,
          previousReserved: inv.reserved,
          newReserved: inv.reserved,
          changeType: 'order_cancelled',
          reason: `Order cancelled/refunded: restored ${item.quantity} unit(s)`,
          reference: orderId,
        },
      });

      this.logger.log(
        `Restored ${item.quantity}× product ${item.productId}` +
        (size ? ` size ${size}` : '') + (color ? ` color ${color}` : '') +
        ` for order ${orderId}`,
      );
    }
  }

  // =========================================================================
  // Admin inventory management
  // =========================================================================

  /**
   * Get inventory with filters and pagination
   */
  async getInventory(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'in_stock' | 'low_stock' | 'out_of_stock';
    categoryId?: string;
    productId?: string;
  }) {
    const page = Number(filters?.page) || 1;
    const limit = Number(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filters?.productId) {
      whereClause.productId = filters.productId;
    }

    if (filters?.search) {
      whereClause.OR = [
        { product: { name: { contains: filters.search } } },
        { product: { sku: { contains: filters.search } } },
      ];
    }

    if (filters?.categoryId) {
      whereClause.product = {
        categoryId: filters.categoryId,
      };
    }

    // Status filtering
    if (filters?.status) {
      if (filters.status === 'out_of_stock') {
        whereClause.onHand = { lte: 0 };
      } else if (filters.status === 'low_stock') {
        whereClause.AND = [
          { onHand: { gt: 0 } },
          { onHand: { lte: this.prisma.inventory.fields?.reorderThreshold || 10 } },
        ];
      } else if (filters.status === 'in_stock') {
        whereClause.onHand = { gt: 0 };
      }
    }

    const [inventory, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          product: {
            include: { category: true, images: { take: 1 } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventory.count({ where: whereClause }),
    ]);

    const soldByVariant = await this.getSoldQuantities(inventory.map(inv => inv.productId));

    return {
      data: inventory.map(inv => ({
        ...inv,
        available: Math.max(0, inv.onHand - inv.reserved),
        status: this.getInventoryStatus(inv),
        sold: soldByVariant.get(this.variantKey(inv.productId, inv.size, inv.color)) ?? 0,
      })),
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Total units historically sold per (productId, size, color), for admin
   * visibility alongside on-hand/reserved stock. "Sold" means net units that
   * actually left stock - order items from cancelled orders are excluded since
   * restoreForCancellation already put that stock back, so counting them too
   * would double-count against what's physically on hand.
   */
  private async getSoldQuantities(productIds: string[]): Promise<Map<string, number>> {
    const uniqueIds = Array.from(new Set(productIds));
    const map = new Map<string, number>();
    if (uniqueIds.length === 0) return map;

    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId', 'selectedSize', 'selectedColor'],
      where: {
        productId: { in: uniqueIds },
        order: { status: { not: 'cancelled' } },
      },
      _sum: { quantity: true },
    });

    for (const row of grouped) {
      map.set(this.variantKey(row.productId, row.selectedSize, row.selectedColor), row._sum.quantity ?? 0);
    }
    return map;
  }

  private variantKey(productId: string, size: string | null, color: string | null): string {
    return `${productId}|${size ?? ''}|${color ?? ''}`;
  }

  /**
   * Get inventory by product ID and variant
   */
  async getInventoryByVariant(productId: string, size?: string, color?: string) {
    const row = await this.findInventoryByVariant(
      this.prisma as any,
      productId,
      size ?? null,
      color ?? null,
    );

    if (!row) {
      throw new NotFoundException('Inventory not found for this variant');
    }

    // Re-fetch with full product include now that we have the row id.
    const inventory = await this.prisma.inventory.findUnique({
      where: { id: row.id },
      include: { product: { include: { category: true, images: { take: 1 } } } },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found for this variant');
    }

    const soldByVariant = await this.getSoldQuantities([inventory.productId]);

    return {
      ...inventory,
      available: Math.max(0, inventory.onHand - inventory.reserved),
      status: this.getInventoryStatus(inventory),
      sold: soldByVariant.get(this.variantKey(inventory.productId, inventory.size, inventory.color)) ?? 0,
    };
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(threshold?: number) {
    // SQLite connector doesn't support comparing one column to another
    // (field references) in a where filter, so fetch candidates and compare in JS.
    const lowStockCandidates = await this.prisma.inventory.findMany({
      where: { onHand: { gt: 0 } },
      include: {
        product: {
          include: { category: true },
        },
      },
      orderBy: { onHand: 'asc' },
    });
    // An explicit threshold overrides every product's own configured reorderThreshold
    // uniformly; with no threshold given, each product's own value applies (this is
    // the only path the admin UI currently exercises, so its behavior is unchanged).
    const lowStock = lowStockCandidates
      .filter((inv) => inv.onHand <= (threshold ?? inv.reorderThreshold))
      .slice(0, 50);

    const outOfStock = await this.prisma.inventory.findMany({
      where: { onHand: { lte: 0 } },
      include: {
        product: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      lowStock: lowStock.map(inv => ({
        ...inv,
        available: Math.max(0, inv.onHand - inv.reserved),
        status: 'low_stock' as const,
      })),
      outOfStock: outOfStock.map(inv => ({
        ...inv,
        available: 0,
        status: 'out_of_stock' as const,
      })),
      totalLow: lowStock.length,
      totalOut: outOfStock.length,
    };
  }

  /**
   * Adjust inventory with audit trail
   */
  async adjustInventory(
    productId: string,
    data: {
      size?: string;
      color?: string;
      type: string;
      quantity: number;
      reason: string;
      reference?: string;
      adminId?: string;
      notes?: string;
    }
  ) {
    if (!VALID_ADJUSTMENT_TYPES.includes(data.type)) {
      throw new BadRequestException(`Invalid adjustment type: ${data.type}`);
    }

    if (data.quantity === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }

    if (!data.reason || data.reason.trim() === '') {
      throw new BadRequestException('Reason is required');
    }

    // Get or create inventory record
    let inventory = await this.findInventoryByVariant(
      this.prisma as any,
      productId,
      data.size ?? null,
      data.color ?? null,
    );

    // If found, re-fetch with product include so downstream code has product.name etc.
    if (inventory) {
      inventory = await this.prisma.inventory.findUnique({
        where: { id: inventory.id },
        include: { product: true },
      }) ?? inventory;
    }

    if (!inventory) {
      // No existing row for this exact productId+size+color - before creating one,
      // confirm the productId is real. Skipping this check would let a bad id (e.g.
      // an inventory row's own id passed where a product id was expected) reach
      // Prisma's create() and fail on the FK constraint as an unhandled 500, instead
      // of a clear, actionable error.
      const productExists = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!productExists) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Create new inventory record
      inventory = await this.prisma.inventory.create({
        data: {
          productId,
          size: data.size || null,
          color: data.color || null,
          onHand: 0,
          reserved: 0,
          reorderThreshold: 10,
        },
        include: { product: true },
      });
    }

    const previousOnHand = inventory.onHand;
    const newOnHand = previousOnHand + data.quantity;

    // Prevent invalid negative stock
    if (newOnHand < 0) {
      throw new BadRequestException(
        `Cannot reduce stock below 0. Current: ${previousOnHand}, Adjustment: ${data.quantity}`
      );
    }

    // Prevent overselling: on-hand stock can never drop below what's already reserved
    if (newOnHand < inventory.reserved) {
      throw new BadRequestException(
        `Insufficient stock for adjustment. Current on-hand: ${previousOnHand}, Reserved: ${inventory.reserved}, Requested reduction: ${Math.abs(data.quantity)}`
      );
    }

    // Create adjustment record
    const adjustment = await this.prisma.inventoryAdjustment.create({
      data: {
        inventoryId: inventory.id,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        reference: data.reference || null,
        previousOnHand,
        newOnHand,
        adminId: data.adminId || null,
        notes: data.notes || null,
      },
    });

    // Update inventory
    const updated = await this.prisma.inventory.update({
      where: { id: inventory.id },
      data: { onHand: newOnHand },
      include: {
        product: {
          include: { category: true, images: { take: 1 } },
        },
      },
    });

    // Create audit log
    await this.prisma.inventoryAuditLog.create({
      data: {
        inventoryId: inventory.id,
        adjustmentId: adjustment.id,
        previousOnHand,
        newOnHand,
        previousReserved: inventory.reserved,
        newReserved: inventory.reserved,
        changeType: 'adjustment',
        reason: data.reason,
        reference: data.reference || adjustment.id,
        adminId: data.adminId || null,
      },
    });

    return {
      ...updated,
      available: Math.max(0, updated.onHand - updated.reserved),
      status: this.getInventoryStatus(updated),
      adjustment,
    };
  }

  /**
   * Reserve stock for an order (internal method)
   */
  async reserveStock(productId: string, size?: string, color?: string, quantity?: number) {
    const inventory = await this.findInventoryByVariant(
      this.prisma as any, productId, size ?? null, color ?? null,
    );

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    const available = inventory.onHand - inventory.reserved;
    if (available < (quantity || 1)) {
      throw new BadRequestException('Insufficient stock available');
    }

    const newReserved = inventory.reserved + (quantity || 1);

    const updated = await this.prisma.inventory.update({
      where: { id: inventory.id },
      data: { reserved: newReserved },
      include: {
        product: true,
      },
    });

    // Create audit log
    await this.prisma.inventoryAuditLog.create({
      data: {
        inventoryId: inventory.id,
        previousOnHand: inventory.onHand,
        newOnHand: inventory.onHand,
        previousReserved: inventory.reserved,
        newReserved,
        changeType: 'reservation',
        reason: 'Stock reserved for order',
      },
    });

    return updated;
  }

  /**
   * Release reserved stock (internal method)
   */
  async releaseStock(productId: string, size?: string, color?: string, quantity?: number) {
    const inventory = await this.findInventoryByVariant(
      this.prisma as any, productId, size ?? null, color ?? null,
    );

    if (!inventory) {
      return null; // Silently return if inventory doesn't exist
    }

    const releaseQty = Math.min(inventory.reserved, quantity || 1);
    const newReserved = Math.max(0, inventory.reserved - releaseQty);

    const updated = await this.prisma.inventory.update({
      where: { id: inventory.id },
      data: { reserved: newReserved },
      include: {
        product: true,
      },
    });

    // Create audit log
    await this.prisma.inventoryAuditLog.create({
      data: {
        inventoryId: inventory.id,
        previousOnHand: inventory.onHand,
        newOnHand: inventory.onHand,
        previousReserved: inventory.reserved,
        newReserved,
        changeType: 'release',
        reason: 'Stock released from order',
      },
    });

    return updated;
  }

  /**
   * Get inventory audit log
   */
  async getAuditLog(filters?: {
    page?: number;
    limit?: number;
    inventoryId?: string;
    changeType?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const page = Number(filters?.page) || 1;
    const limit = Number(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filters?.inventoryId) {
      whereClause.inventoryId = filters.inventoryId;
    }

    if (filters?.changeType) {
      whereClause.changeType = filters.changeType;
    }

    if (filters?.startDate || filters?.endDate) {
      whereClause.createdAt = {};
      if (filters?.startDate) whereClause.createdAt.gte = filters.startDate;
      if (filters?.endDate) whereClause.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.inventoryAuditLog.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          inventory: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryAuditLog.count({ where: whereClause }),
    ]);

    return {
      data: logs,
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Update reorder threshold for a SKU
   */
  async updateReorderThreshold(productId: string, size: string | null, color: string | null, threshold: number) {
    if (threshold < 0) {
      throw new BadRequestException('Reorder threshold cannot be negative');
    }

    const row = await this.findInventoryByVariant(this.prisma as any, productId, size, color);
    if (!row) {
      throw new NotFoundException('Inventory not found for this variant');
    }

    const updated = await this.prisma.inventory.update({
      where: { id: row.id },
      data: { reorderThreshold: threshold },
      include: {
        product: {
          include: { category: true, images: { take: 1 } },
        },
      },
    });

    return {
      ...updated,
      available: Math.max(0, updated.onHand - updated.reserved),
      status: this.getInventoryStatus(updated),
    };
  }

  /**
   * Initialize inventory for a new product
   */
  async initializeProductInventory(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const colors = this.safeParseArray(product.colors);
    const sizes = this.safeParseArray(product.sizes);

    // For products without variants, create one inventory record
    if (!colors.length && !sizes.length) {
      return this.prisma.inventory.create({
        data: {
          productId,
          size: null,
          color: null,
          onHand: 0,
          reserved: 0,
          reorderThreshold: 10,
        },
      });
    }

    // For products with variants, create records for each combination
    const variants: any[] = [];
    for (const color of colors.length ? colors : [null]) {
      for (const size of sizes.length ? sizes : [null]) {
        variants.push({
          productId,
          size,
          color,
          onHand: 0,
          reserved: 0,
          reorderThreshold: 10,
        });
      }
    }

    // SQLite doesn't support skipDuplicates; create each record individually
    // and ignore ones that already exist for this product/size/color.
    const created: any[] = [];
    for (const variant of variants) {
      try {
        created.push(await this.prisma.inventory.create({ data: variant }));
      } catch {
        // Unique constraint violation - variant already initialized, skip it.
      }
    }

    return { count: created.length };
  }

  /**
   * Look up an inventory row by (productId, size, color).
   *
   * Prisma 5 on SQLite throws "Argument `size` must not be null" when you pass
   * `null` into a compound-unique `findUnique` key.  The workaround is to use
   * `findFirst` with explicit `IS NULL` filters whenever any component is null.
   * This helper centralises that logic so every caller is correct.
   */
  private async findInventoryByVariant(
    client: { inventory: { findFirst: (args: any) => Promise<any> } },
    productId: string,
    size: string | null,
    color: string | null,
  ) {
    return client.inventory.findFirst({
      where: {
        productId,
        size: size === null ? null : size,
        color: color === null ? null : color,
      },
    });
  }

  private safeParseArray(value: unknown): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getInventoryStatus(inventory: any): string {
    if (inventory.onHand <= 0) return 'out_of_stock';
    if (inventory.onHand <= inventory.reorderThreshold) return 'low_stock';
    return 'in_stock';
  }
}
