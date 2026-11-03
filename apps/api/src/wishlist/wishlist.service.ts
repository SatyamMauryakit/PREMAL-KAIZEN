import { Injectable } from '@nestjs/common';

/**
 * WishlistService
 * Unfinished, unreachable stub - no WishlistController exists, so none of these
 * methods are ever called. The real wishlist is entirely client-side (storefront's
 * lib/wishlist-context.tsx, backed by localStorage), already implemented and working.
 * Left in place rather than deleted since removing it is a bigger decision than this
 * cleanup pass should make unilaterally; params are prefixed with `_` purely to
 * silence unused-arg lint warnings without changing this stub's (non-)behavior.
 */
@Injectable()
export class WishlistService {
  async getWishlist(_userId: string) {
    return {
      items: [],
      total: 0,
    };
  }

  async addItem(_userId: string, _item: unknown) {
    return null;
  }

  async removeItem(_userId: string, _productId: string) {
    return null;
  }

  async isInWishlist(_userId: string, _productId: string) {
    return false;
  }
}
