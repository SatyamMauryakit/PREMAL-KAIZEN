import { Controller, Get, Post, Put, Delete, Param, Query, Body, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('api/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // Used by both customers (own order history) and admins (full list) - the
  // service layer scopes results by the caller-provided userId filter.
  @Get()
  async findAll(@Query() query: any) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  // Requires login - an order must belong to a real account, and the user ID
  // comes from the verified session, never from the request body.
  @UseGuards(AuthGuard)
  @Post()
  async create(@Body() createOrderDto: any, @Req() req: any) {
    return this.ordersService.create(req.user.id, createOrderDto);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any) {
    if (!body.status) {
      throw new BadRequestException('Status is required');
    }
    return this.ordersService.updateStatus(id, body.status);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Put(':id/payment-status')
  async updatePaymentStatus(@Param('id') id: string, @Body() body: any) {
    if (!body.paymentStatus) {
      throw new BadRequestException('Payment status is required');
    }
    return this.ordersService.updatePaymentStatus(id, body.paymentStatus);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Put(':id/shipping')
  async updateShipping(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.updateShipping(id, body);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Put(':id/notes')
  async addNotes(@Param('id') id: string, @Body() body: any) {
    if (!body.notes && body.notes !== '') {
      throw new BadRequestException('Notes are required');
    }
    return this.ordersService.addNotes(id, body.notes);
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.ordersService.delete(id);
  }
}
