import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { AdminManagementController } from './admin-management.controller';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { AdminAuditLogService } from '../common/rbac/admin-audit-log.service';

@Module({
  imports: [EmailModule, SmsModule],
  providers: [IdentityService, AdminAuditLogService],
  controllers: [IdentityController, AdminManagementController],
  exports: [IdentityService, AdminAuditLogService],
})
export class IdentityModule { }
