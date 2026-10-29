import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';

@Module({
  providers: [IdentityService, PrismaService],
  controllers: [IdentityController],
  exports: [IdentityService],
})
export class IdentityModule {}
