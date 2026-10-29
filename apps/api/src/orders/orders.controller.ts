import { Controller, Get, Post, Put, Delete, Param, Query, Body, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('api/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Post()
  async create(@Body() createOrderDto: any) {
    return this.ordersService.create(createOrderDto);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any) {
    if (!body.status) {
      throw new BadRequestException('Status is required');
    }
    return this.ordersService.updateStatus(id, body.status);
  }

  @Put(':id/payment-status')
  async updatePaymentStatus(@Param('id') id: string, @Body() body: any) {
    if (!body.paymentStatus) {
      throw new BadRequestException('Payment status is required');
    }
    return this.ordersService.updatePaymentStatus(id, body.paymentStatus);
  }

  @Put(':id/shipping')
  async updateShipping(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.updateShipping(id, body);
  }

  @Put(':id/notes')
  async addNotes(@Param('id') id: string, @Body() body: any) {
    if (!body.notes && body.notes !== '') {
      throw new BadRequestException('Notes are required');
    }
    return this.ordersService.addNotes(id, body.notes);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.ordersService.delete(id);
  }
}
