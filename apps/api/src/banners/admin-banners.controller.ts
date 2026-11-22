import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BannersService } from './banners.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

/**
 * AdminBannersController
 * Full control over homepage banners (image, text, offer badge, button,
 * link, placement, order, active/inactive, schedule) - `content:manage`
 * permission (SUPER_ADMIN, CONTENT_MANAGER).
 */
@UseGuards(AuthGuard, AdminGuard, PermissionGuard)
@RequirePermission('content:manage')
@Controller('api/admin/banners')
export class AdminBannersController {
  constructor(private bannersService: BannersService) {}

  @Get()
  async list() {
    return this.bannersService.adminList();
  }

  @Post()
  async create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Put('reorder')
  async reorder(@Body() body: { ids: string[] }) {
    return this.bannersService.reorder(body.ids);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.bannersService.delete(id);
  }
}
