import { Module } from '@nestjs/common';
import { WishlistService } from './wishlist.service';

/**
 * WishlistModule
 * Encapsulates wishlist functionality.
 * Currently: Client-side via React Context + localStorage
 * Future (Phase 6+): Server-backed wishlist with database persistence
 */
@Module({
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
