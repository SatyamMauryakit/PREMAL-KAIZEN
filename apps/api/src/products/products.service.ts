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
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: { category: true, images: true },
        orderBy: this.getOrderBy(filters?.sort),
      }),
      this.prisma.product.count({ where: whereClause }),
    ]);

    return {
      data: products,
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
  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, images: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
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

    const existingSku = await this.prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) {
      throw new BadRequestException('SKU already exists');
    }

    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description || '',
        sku: data.sku,
        price: Math.round(data.price),
        originalPrice: data.originalPrice ? Math.round(data.originalPrice) : null,
        categoryId: data.categoryId || null,
        isActive: data.isActive !== false,
        colors: data.colors || [],
        sizes: data.sizes || [],
      },
      include: { category: true, images: true },
    });

    return product;
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

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: data.name || product.name,
        description: data.description !== undefined ? data.description : product.description,
        sku: data.sku || product.sku,
        price: data.price !== undefined ? Math.round(data.price) : product.price,
        originalPrice: data.originalPrice !== undefined ? Math.round(data.originalPrice) : product.originalPrice,
        categoryId: data.categoryId !== undefined ? data.categoryId : product.categoryId,
        isActive: data.isActive !== undefined ? data.isActive : product.isActive,
        colors: data.colors || product.colors,
        sizes: data.sizes || product.sizes,
      },
      include: { category: true, images: true },
    });

    return updated;
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

  private getOrderBy(sort?: string) {
    switch (sort) {
      case 'price_asc':
        return { price: 'asc' };
      case 'price_desc':
        return { price: 'desc' };
      case 'newest':
        return { createdAt: 'desc' };
      case 'oldest':
        return { createdAt: 'asc' };
      default:
        return { createdAt: 'desc' };
    }
  }
}
