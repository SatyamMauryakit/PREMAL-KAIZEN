import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { CategoriesService } from './categories.service';

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

  @Post()
  async create(@Body() createCategoryDto: any) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCategoryDto: any) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }
}
