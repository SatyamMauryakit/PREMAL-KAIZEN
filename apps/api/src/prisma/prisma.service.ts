import { Injectable } from '@nestjs/common';

/**
 * PrismaService - Demo/Development Mock
 * Replace with real PrismaClient when database is available
 * This is a mock implementation to allow the API to start without a real database
 */
@Injectable()
export class PrismaService {
  // Mock implementations for demo purposes
  user: any = {
    findUnique: async (query: any) => null,
    create: async (query: any) => ({ id: 'demo-user-1', ...query.data }),
    update: async (query: any) => ({ id: 'demo-user-1', ...query.data }),
    findMany: async (query?: any) => [],
  };

  session: any = {
    create: async (query: any) => ({ id: 'demo-session-1', ...query.data }),
    findUnique: async (query: any) => null,
    delete: async (query: any) => ({}),
    deleteMany: async (query: any) => ({}),
  };

  verificationToken: any = {
    findUnique: async (query: any) => null,
    create: async (query: any) => ({ id: 'demo-token-1', ...query.data }),
    delete: async (query: any) => ({}),
    deleteMany: async (query: any) => ({}),
  };

  address: any = {
    findMany: async (query?: any) => [],
    findUnique: async (query: any) => null,
    create: async (query: any) => ({ id: 'demo-address-1', ...query.data }),
    update: async (query: any) => ({ id: 'demo-address-1', ...query.data }),
    updateMany: async (query: any) => ({}),
    delete: async (query: any) => ({}),
    findFirst: async (query: any) => null,
  };

  product: any = {
    findMany: async (query?: any) => [],
    findUnique: async (query: any) => null,
    create: async (query: any) => ({ id: 'demo-product-1', ...query.data }),
    update: async (query: any) => ({ id: 'demo-product-1', ...query.data }),
    delete: async (query: any) => ({}),
    count: async (query?: any) => 0,
  };

  category: any = {
    findMany: async (query?: any) => [],
    findUnique: async (query: any) => null,
    create: async (query: any) => ({ id: 'demo-category-1', ...query.data }),
    update: async (query: any) => ({ id: 'demo-category-1', ...query.data }),
    delete: async (query: any) => ({}),
    count: async (query?: any) => 0,
  };

  order: any = {
    findMany: async (query?: any) => {
      // Return demo orders
      const baseOrder = {
        id: 'demo-order-1',
        userId: 'demo-user-1',
        orderNumber: 'PK-2024-001',
        status: 'processing',
        paymentMethod: 'card',
        paymentStatus: 'completed',
        shippingMethod: 'standard',
        subtotal: 5000,
        shipping: 200,
        tax: 900,
        total: 6100,
        notes: null,
        internalNotes: null,
        carrier: 'FedEx',
        trackingNumber: '1234567890',
        estimatedDelivery: '2024-11-15',
        addressId: null,
        createdAt: new Date('2024-10-25'),
        updatedAt: new Date('2024-10-25'),
      };
      return [baseOrder];
    },
    findUnique: async (query: any) => {
      if (query.where.id === 'demo-order-1') {
        return {
          id: 'demo-order-1',
          userId: 'demo-user-1',
          orderNumber: 'PK-2024-001',
          status: 'processing',
          paymentMethod: 'card',
          paymentStatus: 'completed',
          shippingMethod: 'standard',
          subtotal: 5000,
          shipping: 200,
          tax: 900,
          total: 6100,
          notes: null,
          internalNotes: null,
          carrier: 'FedEx',
          trackingNumber: '1234567890',
          estimatedDelivery: '2024-11-15',
          addressId: null,
          createdAt: new Date('2024-10-25'),
          updatedAt: new Date('2024-10-25'),
          items: [],
          user: { id: 'demo-user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        };
      }
      return null;
    },
    create: async (query: any) => ({ id: 'demo-order-1', ...query.data, orderNumber: 'PK-2024-001' }),
    update: async (query: any) => ({ id: 'demo-order-1', ...query.data }),
    delete: async (query: any) => ({}),
    count: async (query?: any) => 1,
  };

  orderItem: any = {
    findMany: async (query?: any) => [],
    findUnique: async (query: any) => null,
    create: async (query: any) => ({ id: 'demo-item-1', ...query.data }),
    update: async (query: any) => ({ id: 'demo-item-1', ...query.data }),
    delete: async (query: any) => ({}),
  };

  inventory: any = {
    findMany: async (query?: any) => {
      // Return demo inventory
      return [
        {
          id: 'inv-1',
          productId: 'prod-1',
          size: 'M',
          color: 'Black',
          onHand: 45,
          reserved: 5,
          reorderThreshold: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'prod-1',
            name: 'Classic T-Shirt',
            sku: 'TSHIRT-001',
            price: 1999,
            isActive: true,
          },
        },
        {
          id: 'inv-2',
          productId: 'prod-2',
          size: 'L',
          color: 'Blue',
          onHand: 8,
          reserved: 2,
          reorderThreshold: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'prod-2',
            name: 'Denim Jacket',
            sku: 'JACKET-001',
            price: 4999,
            isActive: true,
          },
        },
        {
          id: 'inv-3',
          productId: 'prod-3',
          size: null,
          color: null,
          onHand: 0,
          reserved: 0,
          reorderThreshold: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'prod-3',
            name: 'Wool Beanie',
            sku: 'BEANIE-001',
            price: 899,
            isActive: true,
          },
        },
      ];
    },
    findUnique: async (query: any) => {
      if (query.where.productId_size_color) {
        const { productId, size, color } = query.where.productId_size_color;
        if (productId === 'prod-1' && size === 'M' && color === 'Black') {
          return {
            id: 'inv-1',
            productId: 'prod-1',
            size: 'M',
            color: 'Black',
            onHand: 45,
            reserved: 5,
            reorderThreshold: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            product: {
              id: 'prod-1',
              name: 'Classic T-Shirt',
              sku: 'TSHIRT-001',
              price: 1999,
            },
          };
        }
      }
      return null;
    },
    create: async (query: any) => ({ id: 'inv-new', ...query.data, createdAt: new Date(), updatedAt: new Date() }),
    createMany: async (query: any) => ({ count: query.data.length }),
    update: async (query: any) => ({ id: 'inv-1', ...query.data, updatedAt: new Date() }),
    delete: async (query: any) => ({}),
    count: async (query?: any) => 3,
  };

  inventoryAdjustment: any = {
    findMany: async (query?: any) => [],
    create: async (query: any) => ({ id: 'adj-1', ...query.data, createdAt: new Date() }),
    count: async (query?: any) => 0,
  };

  inventoryAuditLog: any = {
    findMany: async (query?: any) => [],
    create: async (query: any) => ({ id: 'log-1', ...query.data, createdAt: new Date() }),
    count: async (query?: any) => 0,
  };

  promotion: any = {
    findMany: async (query?: any) => {
      return [
        {
          id: 'promo-1',
          name: '20% Off Everything',
          description: 'Save 20% on all products',
          type: 'percentage',
          value: 20,
          maxDiscount: 50000,
          minSubtotal: null,
          firstOrderOnly: false,
          eligibleProductIds: [],
          eligibleCategoryIds: [],
          excludedProductIds: [],
          excludedCategoryIds: [],
          startDate: new Date('2024-10-01'),
          expiryDate: new Date('2024-12-31'),
          isActive: true,
          totalUsageLimit: 1000,
          usageCount: 42,
          perCustomerLimit: 3,
          code: null,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'promo-2',
          name: 'Free Shipping Over ₹500',
          description: 'Get free shipping on orders above ₹500',
          type: 'free_shipping',
          value: null,
          maxDiscount: null,
          minSubtotal: 50000,
          firstOrderOnly: false,
          eligibleProductIds: [],
          eligibleCategoryIds: [],
          excludedProductIds: [],
          excludedCategoryIds: [],
          startDate: new Date('2024-10-15'),
          expiryDate: null,
          isActive: true,
          totalUsageLimit: null,
          usageCount: 18,
          perCustomerLimit: null,
          code: 'FREESHIP',
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    },
    findUnique: async (query: any) => {
      if (query.where.id === 'promo-1') {
        return {
          id: 'promo-1',
          name: '20% Off Everything',
          type: 'percentage',
          value: 20,
          isActive: true,
          usageCount: 42,
          totalUsageLimit: 1000,
        };
      }
      return null;
    },
    create: async (query: any) => ({ id: 'promo-new', ...query.data, usageCount: 0, createdAt: new Date(), updatedAt: new Date() }),
    createMany: async (query: any) => ({ count: query.data.length }),
    update: async (query: any) => ({ id: 'promo-1', ...query.data, updatedAt: new Date() }),
    count: async (query?: any) => 2,
  };

  couponCode: any = {
    findMany: async (query?: any) => [],
    findUnique: async (query: any) => null,
    create: async (query: any) => ({ id: 'coupon-1', ...query.data, usageCount: 0, createdAt: new Date(), updatedAt: new Date() }),
    createMany: async (query: any) => ({ count: query.data.length }),
    update: async (query: any) => ({ id: 'coupon-1', ...query.data, updatedAt: new Date() }),
    count: async (query?: any) => 0,
  };

  couponRedemption: any = {
    findMany: async (query?: any) => [],
    findFirst: async (query: any) => null,
    create: async (query: any) => ({ id: 'redemption-1', ...query.data, createdAt: new Date(), updatedAt: new Date() }),
    count: async (query?: any) => 0,
    update: async (query: any) => ({ id: 'redemption-1', ...query.data, updatedAt: new Date() }),
  };

  storeSettings: any = {
    findUnique: async (query: any) => {
      if (query.where.id === 'singleton') {
        return {
          id: 'singleton',
          storeName: 'PREMAL KAIZEN',
          storeEmail: 'support@premalkaizen.com',
          storePhone: '+91-99XXX-XXXXX',
          businessAddress: 'Gurugram, Haryana, India',
          timezone: 'Asia/Kolkata',
          locale: 'en-IN',
          currency: 'INR',
          shippingMethods: JSON.stringify([
            {
              id: 'standard',
              name: 'Standard Shipping',
              description: 'Delivery in 5-7 business days',
              price: 5000,
              estimatedDays: 6,
              enabled: true,
            },
            {
              id: 'express',
              name: 'Express Shipping',
              description: 'Delivery in 2-3 business days',
              price: 10000,
              estimatedDays: 2,
              enabled: true,
            },
          ]),
          defaultTaxRate: 18,
          taxCalculationMode: 'exclusive',
          guestCheckoutEnabled: true,
          minimumOrderValue: 0,
          maintenanceMode: false,
          maintenanceMessage: '',
          orderConfirmationEnabled: true,
          paymentNotificationsEnabled: true,
          shippingNotificationsEnabled: true,
          lowStockNotificationsEnabled: true,
          stripeEnabled: false,
          razorpayEnabled: false,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          lastModifiedAt: new Date(),
          lastModifiedBy: null,
        };
      }
      return null;
    },
    create: async (query: any) => ({
      id: 'singleton',
      ...query.data,
      lastModifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    update: async (query: any) => ({
      id: 'singleton',
      ...query.data,
      lastModifiedAt: new Date(),
      updatedAt: new Date(),
    }),
  };

  settingsAuditLog: any = {
    findMany: async (query?: any) => [],
    create: async (query: any) => ({ id: 'audit-1', ...query.data, createdAt: new Date() }),
  };

  // Transaction support for mock
  $transaction: async (callback: any) => {
    return callback(this);
  };

  async onModuleInit() {
    // Mock connect
  }

  async onModuleDestroy() {
    // Mock disconnect
  }
}
