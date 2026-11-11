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
   * @param filters - Search and filter parameters. `minPrice`/`maxPrice` are in rupees
   * (matching the storefront's display unit), converted to paise internally since that's
   * how `Product.price` is stored.
   * @returns Paginated product list
   */
  async findAll(filters?: {
    /** One or more category slugs - OR semantics, matching sizes/colors below. */
    categories?: string[];
    /** One or more exact product ids - e.g. batch-fetching a recently-viewed list in one request instead of N. */
    ids?: string[];
    search?: string;
    sort?: string;
    sizes?: string[];
    colors?: string[];
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }) {
    return this.findAllInternal(filters, 'active', false);
  }

  /**
   * Admin-only variant of findAll: the public method above always hardcodes
   * isActive:true so customers can never see a draft/disabled product, which
   * means the admin product list must NOT reuse it directly - doing so was the
   * bug where disabling a product made it invisible in the admin panel too,
   * indistinguishable from having been deleted. This method defaults to
   * showing every status so disabled products stay visible and manageable.
   */
  async findAllForAdmin(filters?: {
    categories?: string[];
    ids?: string[];
    search?: string;
    sort?: string;
    sizes?: string[];
    colors?: string[];
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
    /**
     * 'active' | 'inactive' | 'out_of_stock' | 'all' (default) - admin status filter,
     * independent of the public catalog's always-active view. 'out_of_stock' is
     * orthogonal to active/inactive (a disabled product can also be out of stock) -
     * it shows regardless of isActive, since the point is surfacing a stock problem
     * wherever it is.
     */
    status?: 'active' | 'inactive' | 'out_of_stock' | 'all';
  }) {
    // Soft-deleted products never show in the normal admin list, even with
    // status=all - they live in their own "Deleted Products" view (findDeleted).
    return this.findAllInternal(filters, filters?.status ?? 'all', false);
  }

  /**
   * "Deleted Products" admin view (Section 4D) - the only place a soft-deleted
   * product is ever listed.
   */
  async findDeleted(filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.findAllInternal(filters, 'all', true);
  }

  private async findAllInternal(
    filters:
      | {
          categories?: string[];
          ids?: string[];
          search?: string;
          sort?: string;
          sizes?: string[];
          colors?: string[];
          minPrice?: number;
          maxPrice?: number;
          page?: number;
          limit?: number;
        }
      | undefined,
    status: 'active' | 'inactive' | 'out_of_stock' | 'all',
    /** false (default-ish, callers always pass explicitly): list only soft-deleted products instead of excluding them. */
    onlyDeleted: boolean,
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    // Combined with AND (rather than a single flat object) because `search` and the
    // `sizes`/`colors` filters below each need their own OR group - a flat object can
    // only hold one `OR` key, so a second would silently overwrite the first.
    const and: any[] = [{ isDeleted: onlyDeleted }];
    if (status === 'active') and.push({ isActive: true });
    else if (status === 'inactive') and.push({ isActive: false });
    else if (status === 'out_of_stock') {
      // A product with no tracked inventory rows at all is treated as unlimited
      // stock everywhere else in this codebase (see InventoryService), so it must
      // never count as "out of stock" here either - `some: {}` requires at least
      // one tracked variant to exist. "Out of stock" reuses the exact same
      // onHand<=0 definition InventoryService.getInventoryStatus() already uses
      // (reserved vs onHand can't be compared at the DB level on SQLite).
      and.push({ inventory: { some: {}, every: { onHand: { lte: 0 } } } });
    }
    // status === 'all' - no isActive/stock filter at all

    if (filters?.ids && filters.ids.length > 0) {
      and.push({ id: { in: filters.ids } });
    }

    if (filters?.categories && filters.categories.length > 0) {
      and.push({ category: { slug: { in: filters.categories } } });
    }

    if (filters?.search) {
      and.push({
        OR: [
          { name: { contains: filters.search } },
          { description: { contains: filters.search } },
        ],
      });
    }

    // sizes/colors are JSON-encoded string arrays (SQLite has no native array/json
    // column type). Wrapping the value in quotes matches it as a whole JSON array
    // element (`"M"`) rather than a substring of a different one (avoids "M" matching
    // within "ML" or "Maroon"). SQLite's LIKE/`contains` is already case-insensitive
    // for ASCII, matching this service's existing search-filter convention (see
    // products.service.spec.ts) - PostgreSQL cutover would need `mode: 'insensitive'`
    // added here too, same as that pending note.
    if (filters?.sizes && filters.sizes.length > 0) {
      and.push({ OR: filters.sizes.map((s) => ({ sizes: { contains: `"${s}"` } })) });
    }
    if (filters?.colors && filters.colors.length > 0) {
      and.push({ OR: filters.colors.map((c) => ({ colors: { contains: `"${c}"` } })) });
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceFilter: any = {};
      if (filters.minPrice !== undefined) priceFilter.gte = Math.round(filters.minPrice * 100);
      if (filters.maxPrice !== undefined) priceFilter.lte = Math.round(filters.maxPrice * 100);
      and.push({ price: priceFilter });
    }

    const whereClause = { AND: and };

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
   * Lightweight filter-option data for the storefront's filter sidebar: distinct
   * sizes/colors across the live catalog and the price range. Deliberately selects
   * only `sizes`/`colors`/`price` (not images/description/category) so computing
   * filter options doesn't require fetching full product records - the facets the
   * sidebar needs, not the catalog itself.
   */
  async getFacets() {
    const [priceAgg, rows] = await Promise.all([
      this.prisma.product.aggregate({
        where: { isActive: true },
        _min: { price: true },
        _max: { price: true },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { sizes: true, colors: true },
      }),
    ]);

    const sizes = new Set<string>();
    const colors = new Set<string>();
    for (const row of rows) {
      for (const s of this.safeParseArray(row.sizes)) sizes.add(s);
      for (const c of this.safeParseArray(row.colors)) colors.add(c);
    }

    return {
      sizes: Array.from(sizes),
      colors: Array.from(colors),
      priceRange: {
        min: priceAgg._min.price !== null ? Math.round(priceAgg._min.price / 100) : 0,
        max: priceAgg._max.price !== null ? Math.round(priceAgg._max.price / 100) : 0,
      },
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

    // A soft-deleted product 404s for every caller, admin included - the admin edit
    // screen has no use for a deleted product's data; it belongs in the restore flow
    // instead (see findDeleted/restore below).
    if (!product || product.isDeleted || (!includeInactive && !product.isActive)) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Real per-variant stock, when the business has configured it - a size/color
    // with no inventory row here is treated as available (no tracking enabled for
    // it yet), never as a fabricated stock count.
    const inventory = await this.prisma.inventory.findMany({ where: { productId: id } });

    return {
      ...this.deserialize(product),
      inventory: inventory.map((i) => ({
        size: i.size,
        color: i.color,
        available: Math.max(0, i.onHand - i.reserved),
      })),
    };
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
   * Soft-delete a product (admin only). Never a hard delete - this just marks the
   * row isDeleted:true (and isActive:false, so it's hidden even if some caller
   * somehow bypassed the isDeleted filter) and records when. The row, its images,
   * its inventory, and - critically - every historical OrderItem referencing it
   * are completely untouched. Use permanentlyDelete for actual row removal.
   */
  async delete(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.isDeleted) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.prisma.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), isActive: false },
    });
    return { success: true, message: 'Product deleted successfully' };
  }

  /**
   * Restore a soft-deleted product (admin only). Deliberately does NOT
   * re-activate it - isDeleted and isActive are independent fields, so a
   * restored product comes back as a disabled draft the admin can review and
   * re-enable explicitly via the normal update endpoint, rather than silently
   * going live again.
   */
  async restore(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.isDeleted) {
      throw new NotFoundException(`Deleted product with ID ${id} not found`);
    }

    const restored = await this.prisma.product.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
      include: { category: true, images: { orderBy: { order: 'asc' } } },
    });
    return this.deserialize(restored);
  }

  /**
   * Permanently removes a product row (admin only). Requires the product to
   * already be soft-deleted first - permanent deletion is a deliberate second
   * step, never a shortcut around disabling a product. Explicitly checks for
   * order history first and refuses with a clear, actionable error instead of
   * letting Prisma's raw foreign-key violation (OrderItem.product is
   * onDelete:Restrict) surface as an unhandled 500.
   */
  async permanentlyDelete(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    if (!product.isDeleted) {
      throw new BadRequestException('Only an already-deleted product can be permanently removed. Delete it first.');
    }

    const orderItemCount = await this.prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      throw new BadRequestException(
        `Cannot permanently delete this product - it is referenced by ${orderItemCount} historical order item(s). Order history must be preserved.`,
      );
    }

    await this.prisma.product.delete({ where: { id } });
    return { success: true, message: 'Product permanently deleted' };
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
