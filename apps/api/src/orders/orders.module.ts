import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { StaleOrderCleanupService } from './stale-order-cleanup.service';
import { PromotionsModule } from '../promotions/promotions.module';
import { SettingsModule } from '../settings/settings.module';
import { RazorpayModule } from '../payments/razorpay.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PromotionsModule, SettingsModule, RazorpayModule, InvoicesModule, NotificationsModule, InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService, StaleOrderCleanupService],
  exports: [OrdersService],
})
export class OrdersModule { }
