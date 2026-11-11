import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { EmailModule } from '../email/email.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  // EmailModule (for EmailService) + InvoicesModule (for InvoicesService/InvoicePdfService,
  // used to build invoice PDF attachments) are needed by the processor, not by the
  // lightweight enqueue service — but they must be importable here so the processor
  // can inject them.
  imports: [EmailModule, InvoicesModule],
  providers: [NotificationService, NotificationProcessor],
  exports: [NotificationService],
})
export class NotificationsModule {}
