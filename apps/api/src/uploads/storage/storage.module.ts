import { Module } from '@nestjs/common';
import { STORAGE_ADAPTER } from './storage-adapter.interface';
import { createStorageAdapter } from './storage.provider';

@Module({
  providers: [
    {
      provide: STORAGE_ADAPTER,
      useFactory: () => createStorageAdapter(),
    },
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
