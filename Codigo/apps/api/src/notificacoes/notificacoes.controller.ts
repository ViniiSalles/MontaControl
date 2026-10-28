import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { ListaNotificacoesDTO } from '@montacontrol/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { ListarNotificacoesDto } from './dto/listar-notificacoes.dto';
import { NotificacoesService } from './notificacoes.service';

/**
 * Centro de notificações do usuário autenticado — qualquer perfil (sem
 * `@Roles`). O dono vem sempre do token, nunca da requisição: não há como
 * ler ou alterar notificação de outra pessoa (a alheia responde 404).
 */
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  async listar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() consulta: ListarNotificacoesDto,
  ): Promise<ListaNotificacoesDTO> {
    return this.notificacoes.listar(usuario.id, consulta.limite, consulta.antesDe);
  }

  @Post('marcar-todas-lidas')
  @HttpCode(HttpStatus.NO_CONTENT)
  async marcarTodasLidas(@CurrentUser() usuario: UsuarioAutenticado): Promise<void> {
    await this.notificacoes.marcarTodasLidas(usuario.id);
  }

  @Patch(':id/lida')
  @HttpCode(HttpStatus.NO_CONTENT)
  async marcarLida(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.notificacoes.marcarLida(id, usuario.id);
  }
}
