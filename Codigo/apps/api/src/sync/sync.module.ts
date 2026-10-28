import { Module } from '@nestjs/common';
import { AmbientesModule } from '../ambientes/ambientes.module';
import { AtestadosModule } from '../atestados/atestados.module';
import { AvariasModule } from '../avarias/avarias.module';
import { BancoHorasModule } from '../banco-horas/banco-horas.module';
import { JornadasModule } from '../jornadas/jornadas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { PecasModule } from '../pecas/pecas.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { SyncExclusaoModule } from './sync-exclusao.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

/** Sincronização da réplica local do montador (`GET /api/sync/pull`). */
@Module({
  imports: [
    SyncExclusaoModule,
    JornadasModule,
    BancoHorasModule,
    PedidosModule,
    AmbientesModule,
    PecasModule,
    AvariasModule,
    AtestadosModule,
    NotificacoesModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
