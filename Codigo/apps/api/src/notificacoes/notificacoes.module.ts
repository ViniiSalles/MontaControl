import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { NotificacoesController } from './notificacoes.controller';
import { EmissorNotificacao } from './notificacoes.emissor';
import { NotificacoesGateway } from './notificacoes.gateway';
import { NotificacoesRepository } from './notificacoes.repository';
import { NotificacoesService } from './notificacoes.service';

/**
 * Persistência + REST + gateway Socket.io das notificações. Os módulos de
 * origem (avarias, atestados...) importam este e usam `NotificacoesService`.
 */
@Module({
  imports: [PrismaModule, UsuariosModule, AuthModule],
  controllers: [NotificacoesController],
  providers: [
    NotificacoesService,
    NotificacoesRepository,
    NotificacoesGateway,
    // Mesma instância do gateway: o service só conhece a porta abstrata.
    { provide: EmissorNotificacao, useExisting: NotificacoesGateway },
  ],
  exports: [NotificacoesService, NotificacoesRepository],
})
export class NotificacoesModule {}
