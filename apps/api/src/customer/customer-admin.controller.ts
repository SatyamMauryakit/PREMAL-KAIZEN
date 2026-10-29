import { Controller, Get, Put, Param, Query, Body, BadRequestException } from '@nestjs/common';
import { CustomerAdminService } from './customer-admin.service';

@Controller('api/admin/customers')
export class CustomerAdminController {
  constructor(private customerAdminService: CustomerAdminService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.customerAdminService.findAll({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      search: query.search,
      status: query.status,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
    });
  }

  @Get('statistics')
  async getStatistics() {
    return this.customerAdminService.getStatistics();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customerAdminService.findById(id);
  }

  @Get(':id/orders')
  async getOrderHistory(@Param('id') customerId: string, @Query() query: any) {
    return this.customerAdminService.getOrderHistory(customerId, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 10,
      status: query.status,
    });
  }

  @Get(':id/export')
  async exportData(@Param('id') id: string) {
    return this.customerAdminService.getCustomerDataExport(id);
  }

  @Put(':id/status')
  async setStatus(@Param('id') id: string, @Body() body: any) {
    if (body.isActive === undefined) {
      throw new BadRequestException('isActive is required');
    }

    return this.customerAdminService.setAccountStatus(id, body.isActive, body.reason);
  }
}
