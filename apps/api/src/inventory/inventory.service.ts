import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_ADJUSTMENT_TYPES = ['received', 'correction', 'damage', 'manual_reconciliation', 'reserved', 'released'];

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

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
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filters?.productId) {
      whereClause.productId = filters.productId;
    }

    if (filters?.search) {
      whereClause.OR = [
        { product: { name: { contains: filters.search, mode: 'insensitive' } } },
        { product: { sku: { contains: filters.search, mode: 'insensitive' } } },
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

    return {
      data: inventory.map(inv => ({
        ...inv,
        available: Math.max(0, inv.onHand - inv.reserved),
        status: this.getInventoryStatus(inv),
      })),
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Get inventory by product ID and variant
   */
  async getInventoryByVariant(productId: string, size?: string, color?: string) {
    const whereClause: any = {
      productId,
      size: size || null,
      color: color || null,
    };

    const inventory = await this.prisma.inventory.findUnique({
      where: {
        productId_size_color: whereClause,
      },
      include: {
        product: {
          include: { category: true, images: { take: 1 } },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found for this variant');
    }

    return {
      ...inventory,
      available: Math.max(0, inventory.onHand - inventory.reserved),
      status: this.getInventoryStatus(inventory),
    };
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(threshold?: number) {
    const limit = threshold || 10;

    const lowStock = await this.prisma.inventory.findMany({
      where: {
        AND: [
          { onHand: { gt: 0 } },
          { onHand: { lte: { field: 'reorderThreshold' } } },
        ],
      },
      include: {
        product: {
          include: { category: true },
        },
      },
      orderBy: { onHand: 'asc' },
      take: 50,
    });

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
    const whereClause = {
      productId_size_color: {
        productId,
        size: data.size || null,
        color: data.color || null,
      },
    };

    let inventory = await this.prisma.inventory.findUnique({
      where: whereClause,
      include: { product: true },
    });

    if (!inventory) {
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

    // Prevent overselling if reserved stock exists
    const available = previousOnHand - inventory.reserved;
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
    const inventory = await this.prisma.inventory.findUnique({
      where: {
        productId_size_color: {
          productId,
          size: size || null,
          color: color || null,
        },
      },
    });

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
    const inventory = await this.prisma.inventory.findUnique({
      where: {
        productId_size_color: {
          productId,
          size: size || null,
          color: color || null,
        },
      },
    });

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
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
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

    const updated = await this.prisma.inventory.update({
      where: {
        productId_size_color: {
          productId,
          size: size || null,
          color: color || null,
        },
      },
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

    // For products without variants, create one inventory record
    if (!product.colors.length && !product.sizes.length) {
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
    for (const color of product.colors.length ? product.colors : [null]) {
      for (const size of product.sizes.length ? product.sizes : [null]) {
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

    return this.prisma.inventory.createMany({
      data: variants,
      skipDuplicates: true,
    });
  }

  private getInventoryStatus(inventory: any): string {
    if (inventory.onHand <= 0) return 'out_of_stock';
    if (inventory.onHand <= inventory.reorderThreshold) return 'low_stock';
    return 'in_stock';
  }
}
