import { Module } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';

/**
 * WishlistModule
 * Server-backed wishlist (WishlistItem table), self-serve routes under
 * /api/customer/wishlist - mirrors the cart module's pattern.
 */
@Module({
  providers: [WishlistService],
  controllers: [WishlistController],
  exports: [WishlistService],
})
export class WishlistModule {}
