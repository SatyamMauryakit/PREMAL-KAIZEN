import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayModule } from './razorpay.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [RazorpayModule, EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
