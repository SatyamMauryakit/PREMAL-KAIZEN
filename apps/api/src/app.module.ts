import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { IdentityModule } from './identity/identity.module';
import { CustomerModule } from './customer/customer.module';

/**
 * AppModule
 * Root application module for PREMAL KAIZEN backend API.
 *
 * Architecture: Modular Monolith with Service-Oriented Structure
 * Each module owns its domain and exposes a clear API contract.
 *
 * Services (Phase 6):
 * - Products: Catalog management
 * - Cart: Shopping cart operations
 * - Wishlist: User wishlist management
 * - Identity: Authentication, registration, password reset
 * - Customer: User profiles and addresses
 *
 * Services (Phase 7+):
 * - Orders: Order processing
 * - Payment: Payment processing
 * - Notifications: Email and SMS
 * - Admin: Admin operations (Phase 9+)
 */
@Module({
  imports: [ProductsModule, CartModule, WishlistModule, IdentityModule, CustomerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
