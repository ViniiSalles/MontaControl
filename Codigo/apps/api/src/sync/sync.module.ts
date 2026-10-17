import { Module } from '@nestjs/common';
import { SyncExclusaoRepository } from './sync-exclusao.repository';

@Module({
  providers: [SyncExclusaoRepository],
  exports: [SyncExclusaoRepository],
})
export class SyncModule {}
