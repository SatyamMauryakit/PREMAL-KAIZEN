import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerAdminService } from './customer-admin.service';
import { CustomerAdminController } from './customer-admin.controller';
import { CartService } from './cart.service';
import { CartAdminController } from './cart-admin.controller';

@Module({
  providers: [CustomerService, CustomerAdminService, CartService],
  controllers: [CustomerController, CustomerAdminController, CartAdminController],
  exports: [CustomerService, CustomerAdminService, CartService],
})
export class CustomerModule {}
