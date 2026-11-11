import { Controller, Get, Post, Put, Delete, Param, Query, Body, Req, Res, BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

@Controller('api/orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private invoicesService: InvoicesService,
    private invoicePdfService: InvoicePdfService,
  ) { }

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
    return this.assertOwnerOrAdmin(id, req);
  }

  // Requires login - an order must belong to a real account, and the user ID
  // comes from the verified session, never from the request body.
  @UseGuards(AuthGuard)
  @Post()
  async create(@Body() createOrderDto: any, @Req() req: any) {
    return this.ordersService.create(req.user.id, createOrderDto);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('orders:process')
  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!body.status) {
      throw new BadRequestException('Status is required');
    }
    return this.ordersService.updateStatus(id, body.status, req.user.id);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('orders:process')
  @Put(':id/payment-status')
  async updatePaymentStatus(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!body.paymentStatus) {
      throw new BadRequestException('Payment status is required');
    }
    return this.ordersService.updatePaymentStatus(id, body.paymentStatus, req.user.id);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('orders:process')
  @Put(':id/shipping')
  async updateShipping(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.updateShipping(id, body);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('orders:process')
  @Put(':id/notes')
  async addNotes(@Param('id') id: string, @Body() body: any) {
    if (!body.notes && body.notes !== '') {
      throw new BadRequestException('Notes are required');
    }
    return this.ordersService.addNotes(id, body.notes);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('orders:delete')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.ordersService.delete(id);
  }

  // -------------------------------------------------------------------------
  // Invoices — a customer may only access invoices for their own orders; admins
  // may access any. The same ownership check as findOne (404 on mismatch) is applied
  // so an invoice endpoint never confirms that a guessed order ID exists, and the
  // routes are never publicly reachable without an authenticated session.
  // -------------------------------------------------------------------------

  // Invoice metadata for the in-browser invoice view / download link.
  @UseGuards(AuthGuard)
  @Get(':id/invoice')
  async getInvoice(@Param('id') id: string, @Req() req: any) {
    await this.assertOwnerOrAdmin(id, req);
    return this.invoicesService.getInvoiceSummary(id);
  }

  // Download the invoice as a PDF. Auth + ownership enforced above; the filename is
  // derived from the (server-generated) invoice number, never a client-supplied value.
  @UseGuards(AuthGuard)
  @Get(':id/invoice/pdf')
  async downloadInvoicePdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    await this.assertOwnerOrAdmin(id, req);
    const data = await this.invoicesService.getInvoiceData(id);
    const pdf = await this.invoicePdfService.render(data);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="invoice-${data.invoiceNumber}.pdf"`);
    res.set('Content-Length', String(pdf.length));
    return res.status(200).send(pdf);
  }

  // Admin-only: (re)generate/ensure an invoice exists for a legacy order that predates
  // automatic invoice creation. Idempotent — returns the existing invoice if one exists.
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('orders:process')
  @Post(':id/invoice/generate')
  async generateInvoice(@Param('id') id: string) {
    await this.ordersService.findById(id); // 404 if order doesn't exist
    const invoice = await this.invoicesService.ensureInvoice(id);
    return this.invoicesService.getInvoiceSummary(invoice.orderId);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Loads an order and enforces that the caller may access it: admins may view any
   * order; a customer may only view their own. Throws 404 (not 403) on a mismatch so
   * the existence of an order/invoice is never leaked to an unauthorized caller.
   */
  private async assertOwnerOrAdmin(id: string, req: any) {
    const order = await this.ordersService.findById(id);
    if (req.user.role !== 'admin' && order.userId !== req.user.id) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }
}
