import { Module } from '@nestjs/common';
import { SyncExclusaoRepository } from './sync-exclusao.repository';

/**
 * Só o repositório de tombstones. Fica separado do `SyncModule` (que depende
 * de pedidos, jornadas etc.) para que quem grava exclusões, como o
 * `PedidosModule`, não crie um ciclo de módulos.
 */
@Module({
  providers: [SyncExclusaoRepository],
  exports: [SyncExclusaoRepository],
})
export class SyncExclusaoModule {}
