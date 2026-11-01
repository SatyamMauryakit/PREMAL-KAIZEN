import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ProductService
 * Manages product catalog, searching, and filtering.
 * This service owns:
 * - Product data (name, description, pricing)
 * - Product categories
 * - Product images and metadata
 *
 * Note: `colors` and `sizes` are stored as JSON-encoded strings in SQLite
 * (no native array/json column type) and are parsed back into arrays
 * before being returned from this service.
 *
 * Service boundary: All product queries and mutations go through this service.
 * External access: Via REST API (/api/products)
 */
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all products with filters
   * @param filters - Search and filter parameters
   * @returns Paginated product list
   */
  async findAll(filters?: { category?: string; search?: string; sort?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      isActive: true,
    };

    if (filters?.category) {
      whereClause.category = { slug: filters.category };
    }

    if (filters?.search) {
      whereClause.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: { category: true, images: { orderBy: { order: 'asc' } } },
        orderBy: this.getOrderBy(filters?.sort),
      }),
      this.prisma.product.count({ where: whereClause }),
    ]);

    return {
      data: products.map((p) => this.deserialize(p)),
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Get a single product by ID
   * @param id - Product ID
   * @returns Product details
   */
  /**
   * @param includeInactive - admin-only: lets the edit screen load a draft/unpublished
   * product. Public callers must leave this false so unpublished products stay hidden,
   * even when someone has the direct URL.
   */
  async findById(id: string, includeInactive = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, images: { orderBy: { order: 'asc' } } },
    });

    if (!product || (!includeInactive && !product.isActive)) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.deserialize(product);
  }

  /**
   * Create a new product (admin only)
   * @param data - Product data
   * @returns Created product
   */
  async create(data: any) {
    if (!data.name || !data.sku || data.price === undefined) {
      throw new BadRequestException('Name, SKU, and price are required');
    }

    const price = Math.round(Number(data.price));
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Price must be a valid non-negative number');
    }

    const existingSku = await this.prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) {
      throw new BadRequestException('SKU already exists');
    }

    const images = Array.isArray(data.images) ? data.images : [];

    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description || '',
        sku: data.sku,
        price,
        originalPrice: data.originalPrice ? Math.round(Number(data.originalPrice)) : null,
        categoryId: data.categoryId || null,
        isActive: data.isActive !== false,
        colors: JSON.stringify(Array.isArray(data.colors) ? data.colors : []),
        sizes: JSON.stringify(Array.isArray(data.sizes) ? data.sizes : []),
        images: {
          create: images.map((img: any, index: number) => ({
            url: img.url,
            alt: img.alt || data.name,
            order: img.order ?? index,
          })),
        },
      },
      include: { category: true, images: { orderBy: { order: 'asc' } } },
    });

    return this.deserialize(product);
  }

  /**
   * Update product (admin only)
   * @param id - Product ID
   * @param data - Updated data
   * @returns Updated product
   */
  async update(id: string, data: any) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (data.sku && data.sku !== product.sku) {
      const existingSku = await this.prisma.product.findUnique({ where: { sku: data.sku } });
      if (existingSku) {
        throw new BadRequestException('SKU already exists');
      }
    }

    let price = product.price;
    if (data.price !== undefined) {
      price = Math.round(Number(data.price));
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestException('Price must be a valid non-negative number');
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: data.name ?? product.name,
        description: data.description !== undefined ? data.description : product.description,
        sku: data.sku ?? product.sku,
        price,
        originalPrice: data.originalPrice !== undefined ? Math.round(Number(data.originalPrice)) : product.originalPrice,
        categoryId: data.categoryId !== undefined ? data.categoryId : product.categoryId,
        isActive: data.isActive !== undefined ? data.isActive : product.isActive,
        colors: Array.isArray(data.colors) ? JSON.stringify(data.colors) : product.colors,
        sizes: Array.isArray(data.sizes) ? JSON.stringify(data.sizes) : product.sizes,
      },
      include: { category: true, images: { orderBy: { order: 'asc' } } },
    });

    // Replace images only when a new image set is explicitly provided
    if (Array.isArray(data.images)) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      await this.prisma.productImage.createMany({
        data: data.images.map((img: any, index: number) => ({
          productId: id,
          url: img.url,
          alt: img.alt || updated.name,
          order: img.order ?? index,
        })),
      });
    }

    const final = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, images: { orderBy: { order: 'asc' } } },
    });

    return this.deserialize(final);
  }

  /**
   * Delete product (admin only)
   * @param id - Product ID
   */
  async delete(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.prisma.product.delete({ where: { id } });
    return { success: true, message: 'Product deleted successfully' };
  }

  /**
   * Parse JSON-encoded colors/sizes back into arrays for API responses
   */
  private deserialize(product: any) {
    if (!product) return product;
    return {
      ...product,
      colors: this.safeParseArray(product.colors),
      sizes: this.safeParseArray(product.sizes),
    };
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

  private getOrderBy(sort?: string) {
    switch (sort) {
      case 'price_asc':
        return { price: 'asc' as const };
      case 'price_desc':
        return { price: 'desc' as const };
      case 'newest':
        return { createdAt: 'desc' as const };
      case 'oldest':
        return { createdAt: 'asc' as const };
      default:
        return { createdAt: 'desc' as const };
    }
  }
}
