import { Injectable } from '@nestjs/common';

/**
 * CartService
 * Unfinished, unreachable stub - no CartController exists, so none of these methods
 * are ever called. The real cart is entirely client-side (storefront's
 * lib/cart-context.tsx, backed by localStorage), already implemented and working.
 * Left in place rather than deleted since removing it is a bigger decision than this
 * cleanup pass should make unilaterally; params are prefixed with `_` purely to
 * silence unused-arg lint warnings without changing this stub's (non-)behavior.
 */
@Injectable()
export class CartService {
  async getCart(_userId: string) {
    return {
      items: [],
      subtotal: 0,
      total: 0,
    };
  }

  async addItem(_userId: string, _item: unknown) {
    return null;
  }

  async updateItem(_userId: string, _itemId: string, _quantity: number) {
    return null;
  }

  async removeItem(_userId: string, _itemId: string) {
    return null;
  }

  async clearCart(_userId: string) {
    return true;
  }
}
