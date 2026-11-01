import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule
 * Global module providing a single shared PrismaService instance across the app.
 * SQLite only supports one writer at a time, so a single connection avoids
 * "database is locked" errors under concurrent requests.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
