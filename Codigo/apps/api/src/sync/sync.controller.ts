import { Controller, Get, Query } from '@nestjs/common';
import type { SyncPullResponse } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { SyncPullQueryDto } from './dto/sync-pull.query.dto';
import { SyncService } from './sync.service';

/**
 * Réplica local do montador. O escopo vem sempre do token (`usuario.id`),
 * nunca da query: não há como pedir os dados de outro montador.
 */
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Roles(Perfil.MONTADOR)
  @Get('pull')
  async pull(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncPullResponse> {
    this.sync.verificarVersaoSchema(query.schemaVersion);
    return this.sync.pull(usuario.id, query.lastPulledAt);
  }
}
