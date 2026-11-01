import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerAdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * List all customers with pagination and filters
   */
  async findAll(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive';
    fromDate?: Date;
    toDate?: Date;
  }) {
    const page = Number(filters?.page) || 1;
    const limit = Number(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    // Search by name or email
    if (filters?.search) {
      whereClause.OR = [
        { email: { contains: filters.search } },
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
      ];
    }

    // Filter by account status
    if (filters?.status) {
      whereClause.isActive = filters.status === 'active';
    }

    // Filter by registration date range
    if (filters?.fromDate || filters?.toDate) {
      whereClause.createdAt = {};
      if (filters?.fromDate) whereClause.createdAt.gte = filters.fromDate;
      if (filters?.toDate) whereClause.createdAt.lte = filters.toDate;
    }

    const [customers, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          isActive: true,
          emailVerified: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              orders: true,
              addresses: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    // Enrich with order statistics
    const enriched = await Promise.all(
      customers.map(async (customer) => {
        const orders = await this.prisma.order.findMany({
          where: { userId: customer.id },
          select: {
            total: true,
            status: true,
            paymentStatus: true,
          },
        });

        const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
        const completedOrders = orders.filter(
          (o) => o.status === 'delivered' && o.paymentStatus === 'completed'
        ).length;

        return {
          ...customer,
          orderCount: customer._count.orders,
          totalSpent,
          completedOrders,
          _count: undefined,
        };
      })
    );

    return {
      data: enriched,
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Get customer details by ID
   */
  async findById(customerId: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          select: {
            id: true,
            label: true,
            firstName: true,
            lastName: true,
            street1: true,
            street2: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            isDefault: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Get order statistics
    const orders = await this.prisma.order.findMany({
      where: { userId: customerId },
      select: {
        total: true,
        status: true,
        paymentStatus: true,
      },
    });

    const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
    const completedOrders = orders.filter(
      (o) => o.status === 'delivered' && o.paymentStatus === 'completed'
    ).length;

    return {
      ...customer,
      orderCount: orders.length,
      totalSpent,
      completedOrders,
    };
  }

  /**
   * Get customer order history
   */
  async getOrderHistory(
    customerId: string,
    filters?: {
      page?: number;
      limit?: number;
      status?: string;
    }
  ) {
    // Verify customer exists
    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const page = Number(filters?.page) || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = { userId: customerId };

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          discount: true,
          shipping: true,
          tax: true,
          total: true,
          createdAt: true,
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: whereClause }),
    ]);

    const enriched = orders.map((order) => ({
      ...order,
      itemCount: order._count.items,
      _count: undefined,
    }));

    return {
      data: enriched,
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Get customer's recent orders (last 5)
   */
  async getRecentOrders(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId: customerId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return orders;
  }

  /**
   * Change customer account status
   */
  async setAccountStatus(customerId: string, isActive: boolean, reason?: string) {
    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    if (customer.isActive === isActive) {
      throw new BadRequestException(
        `Customer is already ${isActive ? 'active' : 'inactive'}`
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: customerId },
      data: {
        isActive,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Optionally invalidate sessions when suspending account
    if (!isActive) {
      await this.prisma.session.deleteMany({
        where: { userId: customerId },
      });
    }

    // Create audit log entry (if audit logging is implemented)
    // For now, this is a placeholder for future audit trail integration

    return {
      ...updated,
      action: isActive ? 'reactivated' : 'suspended',
      reason,
    };
  }

  /**
   * Get customer statistics
   */
  async getStatistics() {
    const [
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      verifiedEmails,
      totalOrderValue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { emailVerified: { not: null } } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
      }),
    ]);

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      verifiedEmails,
      totalOrderValue: totalOrderValue._sum?.total || 0,
      avgOrderValue:
        totalCustomers > 0 ? Math.round((totalOrderValue._sum?.total || 0) / totalCustomers) : 0,
    };
  }

  /**
   * Export customer data (limited fields for GDPR/privacy)
   */
  async getCustomerDataExport(customerId: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return customer;
  }
}
