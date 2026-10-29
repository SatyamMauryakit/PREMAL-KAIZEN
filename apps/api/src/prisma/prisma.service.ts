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

  async onModuleInit() {
    // Mock connect
  }

  async onModuleDestroy() {
    // Mock disconnect
  }
}
