import { Controller, Get, Post, Put, Delete, Param, Query, Body, Req, BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('api/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // Used by both customers (own order history) and admins (full list). Non-admin
  // callers are always scoped to their own userId - a customer cannot pass a
  // different userId to view another customer's orders.
  @UseGuards(AuthGuard)
  @Get()
  async findAll(@Query() query: any, @Req() req: any) {
    const scoped = req.user.role === 'admin' ? query : { ...query, userId: req.user.id };
    return this.ordersService.findAll(scoped);
  }

  // Guest order tracking: no auth, but requires knowing both the order number and
  // the exact email on the order - must be registered before the ':id' route below.
  @Get('track')
  async trackGuestOrder(@Query('orderNumber') orderNumber: string, @Query('email') email: string) {
    if (!orderNumber || !email) {
      throw new BadRequestException('orderNumber and email are required');
    }
    return this.ordersService.findForGuestTracking(orderNumber, email);
  }

  // A customer may only view their own order; admins may view any order. Returning
  // 404 (not 403) for a mismatched owner avoids confirming that a guessed order ID exists.
  @UseGuards(AuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const order = await this.ordersService.findById(id);
    if (req.user.role !== 'admin' && order.userId !== req.user.id) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
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
