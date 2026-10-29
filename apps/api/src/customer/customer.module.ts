import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';

@Module({
  providers: [CustomerService, PrismaService],
  controllers: [CustomerController],
  exports: [CustomerService],
})
export class CustomerModule {}
