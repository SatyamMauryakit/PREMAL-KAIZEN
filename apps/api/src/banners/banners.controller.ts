import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { BannersService } from './banners.service';

/** Public, unauthenticated reads of active homepage banners. */
@Controller('api/banners')
export class BannersController {
  constructor(private bannersService: BannersService) {}

  @Get()
  async getActive(@Query('placement') placement?: string) {
    return this.bannersService.getActive(placement);
  }
}
