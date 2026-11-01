import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { search?: string }) {
    const whereClause: any = {};

    if (filters?.search) {
      whereClause.OR = [
        { name: { contains: filters.search } },
        { slug: { contains: filters.search } },
      ];
    }

    const categories = await this.prisma.category.findMany({
      where: whereClause,
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: categories,
      total: categories.length,
    };
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async create(data: any) {
    if (!data.name || !data.slug) {
      throw new BadRequestException('Name and slug are required');
    }

    const existingSlug = await this.prisma.category.findUnique({
      where: { slug: data.slug },
    });

    if (existingSlug) {
      throw new BadRequestException('Category slug already exists');
    }

    const category = await this.prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug.toLowerCase(),
      },
    });

    return category;
  }

  async update(id: string, data: any) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (data.slug && data.slug !== category.slug) {
      const existingSlug = await this.prisma.category.findUnique({
        where: { slug: data.slug },
      });
      if (existingSlug) {
        throw new BadRequestException('Category slug already exists');
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: data.name || category.name,
        slug: data.slug ? data.slug.toLowerCase() : category.slug,
      },
    });

    return updated;
  }

  async delete(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (category._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.products} associated products`
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { success: true, message: 'Category deleted successfully' };
  }
}
