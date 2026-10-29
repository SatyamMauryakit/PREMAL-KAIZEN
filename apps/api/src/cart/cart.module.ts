import { Module } from '@nestjs/common';
import { CartService } from './cart.service';

/**
 * CartModule
 * Encapsulates cart functionality.
 * Currently: Client-side via React Context + localStorage
 * Future (Phase 6+): Server-backed cart with database persistence
 */
@Module({
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
