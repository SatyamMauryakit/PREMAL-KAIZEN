import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const VALID_PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'];

// Status transition rules: what statuses can transition to what
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
    userId?: string;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    if (filters?.paymentStatus) {
      whereClause.paymentStatus = filters.paymentStatus;
    }

    if (filters?.search) {
      whereClause.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    if (filters?.userId) {
      whereClause.userId = filters.userId;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: { items: true, user: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: whereClause }),
    ]);

    return {
      data: orders,
      total,
      page,
      pageSize: limit,
    };
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { include: { product: true } }, user: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    return order;
  }

  async create(data: any) {
    if (!data.userId || data.total === undefined) {
      throw new BadRequestException('userId and total are required');
    }

    // Generate order number (e.g., PK-2024-001)
    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(6, '0');
    const orderNumber = `PK-${year}-${random}`;

    const order = await this.prisma.order.create({
      data: {
        userId: data.userId,
        orderNumber,
        status: data.status || 'pending',
        paymentStatus: data.paymentStatus || 'pending',
        paymentMethod: data.paymentMethod || 'cod',
        shippingMethod: data.shippingMethod || 'standard',
        subtotal: data.subtotal || 0,
        shipping: data.shipping || 0,
        tax: data.tax || 0,
        total: Math.round(data.total),
        notes: data.notes || null,
        addressId: data.addressId || null,
      },
      include: { items: true, user: true },
    });

    return order;
  }

  async updateStatus(id: string, newStatus: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (!VALID_ORDER_STATUSES.includes(newStatus)) {
      throw new BadRequestException(`Invalid status: ${newStatus}`);
    }

    // Check if transition is allowed
    const allowedTransitions = STATUS_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
      include: { items: true, user: true },
    });

    return updated;
  }

  async updatePaymentStatus(id: string, paymentStatus: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      throw new BadRequestException(`Invalid payment status: ${paymentStatus}`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        paymentStatus,
        updatedAt: new Date(),
      },
      include: { items: true, user: true },
    });

    return updated;
  }

  async updateShipping(id: string, data: any) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        carrier: data.carrier || order.carrier,
        trackingNumber: data.trackingNumber || order.trackingNumber,
        estimatedDelivery: data.estimatedDelivery || order.estimatedDelivery,
        updatedAt: new Date(),
      },
      include: { items: true, user: true },
    });

    return updated;
  }

  async addNotes(id: string, notes: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        internalNotes: notes,
        updatedAt: new Date(),
      },
      include: { items: true, user: true },
    });

    return updated;
  }

  async delete(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Only allow deletion of pending/cancelled orders
    if (!['pending', 'cancelled'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot delete order with status: ${order.status}`
      );
    }

    await this.prisma.order.delete({ where: { id } });

    return { success: true, message: 'Order deleted successfully' };
  }
}
