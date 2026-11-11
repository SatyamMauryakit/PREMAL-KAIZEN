import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CartLineItem {
  id: string;
  productId: string;
  name: string;
  image: string | null;
  price: number; // paise
  quantity: number;
  selectedSize: string | null;
  selectedColor: string | null;
  lineTotal: number; // paise
}

export interface CartSummary {
  items: CartLineItem[];
  itemCount: number;
  subtotal: number; // paise
  lastUpdated: Date | null;
}

/**
 * Server-side persistence for logged-in customers' carts (Section 3: admin
 * cart visibility). The storefront's own cart UI continues to read/write
 * localStorage as its source of truth - this service is a one-way mirror the
 * storefront pushes to in the background so admins can see what's in a
 * customer's cart without touching how the cart itself behaves for the
 * customer. Guest (unauthenticated) carts are never persisted here - there is
 * no userId to attach them to, and nothing for an admin to look up anyway.
 */
@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Replaces this customer's entire persisted cart with the given line items.
   * Simpler and safer than diffing an existing set for a collection this
   * small - every sync is a full, atomic "this is the current cart" snapshot.
   */
  async syncCart(
    userId: string,
    items: Array<{ productId: string; quantity: number; selectedSize?: string | null; selectedColor?: string | null }>,
  ): Promise<{ success: true }> {
    const sanitized = items
      .filter((i) => i.productId && Number.isFinite(i.quantity) && i.quantity > 0)
      .map((i) => ({
        userId,
        productId: i.productId,
        quantity: Math.floor(i.quantity),
        selectedSize: i.selectedSize || null,
        selectedColor: i.selectedColor || null,
      }));

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { userId } });
      if (sanitized.length > 0) {
        await tx.cartItem.createMany({ data: sanitized });
      }
    });

    return { success: true };
  }

  async clearCart(userId: string): Promise<{ success: true }> {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { success: true };
  }

  async getCartForUser(userId: string): Promise<CartSummary> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: { include: { images: { take: 1, orderBy: { order: 'asc' } } } } },
      orderBy: { updatedAt: 'desc' },
    });
    return this.buildSummary(items);
  }

  /**
   * Admin: one row per customer with a non-empty cart, sorted by most
   * recently updated first (surfaces abandoned carts naturally - the ones
   * nobody has touched in a while sink to the bottom of a recency sort).
   */
  async getCartsForAdmin(filters?: { search?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const grouped = await this.prisma.cartItem.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
      _max: { updatedAt: true },
    });

    let rows = grouped.filter((g): g is typeof g & { userId: string } => !!g.userId);

    if (filters?.search) {
      const matchingUsers = await this.prisma.user.findMany({
        where: {
          id: { in: rows.map((r) => r.userId) },
          OR: [
            { email: { contains: filters.search } },
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
          ],
        },
        select: { id: true },
      });
      const matchingIds = new Set(matchingUsers.map((u) => u.id));
      rows = rows.filter((r) => matchingIds.has(r.userId));
    }

    rows.sort((a, b) => (b._max.updatedAt?.getTime() ?? 0) - (a._max.updatedAt?.getTime() ?? 0));

    const total = rows.length;
    const skip = (page - 1) * limit;
    const pageRows = rows.slice(skip, skip + limit);

    const data = await Promise.all(
      pageRows.map(async (row) => {
        const [user, cart] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: row.userId },
            select: { id: true, email: true, firstName: true, lastName: true },
          }),
          this.getCartForUser(row.userId),
        ]);

        return {
          userId: row.userId,
          customerEmail: user?.email ?? null,
          customerName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null : null,
          itemCount: cart.itemCount,
          distinctProducts: cart.items.length,
          subtotal: cart.subtotal,
          lastUpdated: cart.lastUpdated,
        };
      }),
    );

    return { data, total, page, pageSize: limit };
  }

  private buildSummary(
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      selectedSize: string | null;
      selectedColor: string | null;
      updatedAt: Date;
      product: { name: string; price: number; images: Array<{ url: string }> };
    }>,
  ): CartSummary {
    const lineItems: CartLineItem[] = items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.product.name,
      image: i.product.images[0]?.url ?? null,
      price: i.product.price,
      quantity: i.quantity,
      selectedSize: i.selectedSize,
      selectedColor: i.selectedColor,
      lineTotal: i.product.price * i.quantity,
    }));

    const itemCount = lineItems.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const lastUpdated = items.length
      ? items.reduce((max, i) => (i.updatedAt > max ? i.updatedAt : max), items[0].updatedAt)
      : null;

    return { items: lineItems, itemCount, subtotal, lastUpdated };
  }
}
