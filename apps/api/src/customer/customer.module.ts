import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerAdminService } from './customer-admin.service';
import { CustomerAdminController } from './customer-admin.controller';

@Module({
  providers: [CustomerService, CustomerAdminService],
  controllers: [CustomerController, CustomerAdminController],
  exports: [CustomerService, CustomerAdminService],
})
export class CustomerModule {}
