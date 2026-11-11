import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WishlistLineItem {
  id: string;
  productId: string;
  name: string;
  image: string | null;
  price: number; // paise
  category: string | null;
  addedAt: string;
}

/**
 * Server-side persistence for logged-in customers' wishlists, backed by the
 * WishlistItem table (userId required - there is no guest wishlist concept,
 * unlike cart). Mirrors CartService's shape/conventions exactly.
 *
 * Replaces the previous unreachable stub - the wishlist used to be 100%
 * client-side (localStorage, a single shared key with no per-user
 * namespacing), which meant it never cleared on logout and leaked from one
 * account to the next on a shared browser/device.
 */
@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async getWishlist(userId: string): Promise<{ items: WishlistLineItem[]; total: number }> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: { include: { category: true, images: { take: 1, orderBy: { order: 'asc' } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const items: WishlistLineItem[] = rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      name: row.product.name,
      image: row.product.images[0]?.url ?? null,
      price: row.product.price,
      category: row.product.category?.name ?? null,
      addedAt: row.createdAt.toISOString(),
    }));

    return { items, total: items.length };
  }

  /** Idempotent - adding a product already in the wishlist is a silent no-op (unique constraint on userId+productId). */
  async addItem(userId: string, productId: string): Promise<{ success: true }> {
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return { success: true };
  }

  async removeItem(userId: string, productId: string): Promise<{ success: true }> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { success: true };
  }

  /** Replaces the entire wishlist with the given product ids - used by the storefront's background sync, same as CartService.syncCart. */
  async syncWishlist(userId: string, productIds: string[]): Promise<{ success: true }> {
    const unique = Array.from(new Set(productIds.filter(Boolean)));
    await this.prisma.$transaction(async (tx) => {
      await tx.wishlistItem.deleteMany({ where: { userId } });
      if (unique.length > 0) {
        // No `skipDuplicates` - SQLite doesn't support it (same gotcha as
        // ProductsService.initializeProductInventory). Not needed here anyway:
        // the deleteMany above clears the row first and `unique` is already
        // de-duplicated, so there's nothing left to collide with.
        await tx.wishlistItem.createMany({
          data: unique.map((productId) => ({ userId, productId })),
        });
      }
    });
    return { success: true };
  }

  async clearWishlist(userId: string): Promise<{ success: true }> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId } });
    return { success: true };
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const row = await this.prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
    return !!row;
  }
}
