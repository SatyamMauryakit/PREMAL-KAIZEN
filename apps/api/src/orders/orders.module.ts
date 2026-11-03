import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PromotionsModule } from '../promotions/promotions.module';
import { SettingsModule } from '../settings/settings.module';
import { RazorpayModule } from '../payments/razorpay.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PromotionsModule, SettingsModule, RazorpayModule, EmailModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
