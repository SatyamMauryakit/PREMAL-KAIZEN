import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [InvoicesService, InvoicePdfService],
  exports: [InvoicesService, InvoicePdfService],
})
export class InvoicesModule {}
