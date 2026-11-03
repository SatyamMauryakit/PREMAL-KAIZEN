import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController, PublicSettingsController } from './settings.controller';
import { RazorpayModule } from '../payments/razorpay.module';

@Module({
  imports: [RazorpayModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
