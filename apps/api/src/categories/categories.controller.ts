import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';

@Controller('api/categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('categories:manage')
  @Post()
  async create(@Body() createCategoryDto: any) {
    return this.categoriesService.create(createCategoryDto);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('categories:manage')
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCategoryDto: any) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('categories:manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }
}
