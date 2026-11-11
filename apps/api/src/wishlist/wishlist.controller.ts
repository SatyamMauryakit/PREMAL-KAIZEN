import { Controller, Get, Put, Post, Delete, Param, Body, Request, UseGuards, UnauthorizedException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AuthGuard } from '../common/guards/auth.guard';

/**
 * WishlistController
 * Self-serve wishlist endpoints, mirroring CustomerController's cart routes
 * exactly: userId always comes from the verified session (never the request
 * body), so a customer can only ever read or write their own wishlist.
 */
@UseGuards(AuthGuard)
@Controller('api/customer/wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  async getWishlist(@Request() req: any) {
    return this.wishlistService.getWishlist(this.extractUserId(req));
  }

  /** Replaces the entire wishlist with the given product ids - background sync, same shape as PUT /api/customer/cart. */
  @Put()
  async syncWishlist(@Request() req: any, @Body() body: { productIds: string[] }) {
    return this.wishlistService.syncWishlist(this.extractUserId(req), Array.isArray(body.productIds) ? body.productIds : []);
  }

  @Post(':productId')
  async addItem(@Request() req: any, @Param('productId') productId: string) {
    return this.wishlistService.addItem(this.extractUserId(req), productId);
  }

  @Delete(':productId')
  async removeItem(@Request() req: any, @Param('productId') productId: string) {
    return this.wishlistService.removeItem(this.extractUserId(req), productId);
  }

  /** DELETE /api/customer/wishlist - called when the local wishlist is cleared (not used by logout, which only clears the local view). */
  @Delete()
  async clearWishlist(@Request() req: any) {
    return this.wishlistService.clearWishlist(this.extractUserId(req));
  }

  private extractUserId(req: any): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return userId;
  }
}
