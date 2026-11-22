import { Module } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { AdminBannersController } from './admin-banners.controller';

/**
 * BannersModule
 * Admin-managed homepage banners/offers - public reads under /api/banners,
 * admin CRUD under /api/admin/banners (content:manage permission).
 */
@Module({
  providers: [BannersService],
  controllers: [BannersController, AdminBannersController],
  exports: [BannersService],
})
export class BannersModule {}
