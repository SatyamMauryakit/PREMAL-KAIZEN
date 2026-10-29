import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerAdminService } from './customer-admin.service';
import { CustomerAdminController } from './customer-admin.controller';

@Module({
  providers: [CustomerService, CustomerAdminService, PrismaService],
  controllers: [CustomerController, CustomerAdminController],
  exports: [CustomerService, CustomerAdminService],
})
export class CustomerModule {}
