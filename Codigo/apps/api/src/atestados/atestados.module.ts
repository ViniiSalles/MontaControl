import { Module } from '@nestjs/common';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AtestadosController } from './atestados.controller';
import { AtestadosRepository } from './atestados.repository';
import { AtestadosService } from './atestados.service';

@Module({
  imports: [PrismaModule, SupabaseModule, NotificacoesModule],
  controllers: [AtestadosController],
  providers: [AtestadosService, AtestadosRepository],
  // O banco de horas e o espelho de ponto leem atestados validados para abonar.
  exports: [AtestadosRepository],
})
export class AtestadosModule {}
