import { Module } from '@nestjs/common';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { PecasModule } from '../pecas/pecas.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AvariasController } from './avarias.controller';
import { AvariasRepository } from './avarias.repository';
import { AvariasService } from './avarias.service';
import { TiposAvariaRepository } from './tipos-avaria.repository';

@Module({
  imports: [PrismaModule, SupabaseModule, PecasModule, PedidosModule, NotificacoesModule],
  controllers: [AvariasController],
  providers: [AvariasService, AvariasRepository, TiposAvariaRepository],
  // O pull de sincronização lê as avarias do montador e o catálogo de tipos.
  exports: [AvariasRepository, TiposAvariaRepository],
})
export class AvariasModule {}
