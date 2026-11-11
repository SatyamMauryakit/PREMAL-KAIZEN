import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { IdentityModule } from './identity/identity.module';
import { CustomerModule } from './customer/customer.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { PromotionsModule } from './promotions/promotions.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { ContactModule } from './contact/contact.module';
import { UploadsModule } from './uploads/uploads.module';
import { PaymentsModule } from './payments/payments.module';
import { EmailModule } from './email/email.module';
import { ReviewsModule } from './reviews/reviews.module';

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
 * - Inventory: Stock and inventory management (Phase 12)
 * - Promotions: Discounts and coupon management (Phase 13)
 * - Analytics: Admin dashboard and business analytics (Phase 15)
 * - Settings: Store configuration and admin settings (Phase 16)
 * - Contact: Contact form submissions (Storefront)
 */
@Module({
  imports: [
    // Baseline, generous per-IP rate limit applied to every route by default (120
    // requests/minute). Sensitive routes (login, register, password reset) set a
    // stricter named throttler via @Throttle(); the Razorpay webhook is explicitly
    // exempt via @SkipThrottle() - see payments.controller.ts. In-memory storage is
    // fine for a single API instance; once there are multiple replicas, this needs a
    // shared store (e.g. @nest-lab/throttler-storage-redis) or each replica will count
    // independently and the effective limit becomes limit * replica count.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
    PrismaModule,
    HealthModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    InventoryModule,
    PromotionsModule,
    AnalyticsModule,
    SettingsModule,
    ContactModule,
    CartModule,
    WishlistModule,
    IdentityModule,
    CustomerModule,
    UploadsModule,
    PaymentsModule,
    EmailModule,
    ReviewsModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
