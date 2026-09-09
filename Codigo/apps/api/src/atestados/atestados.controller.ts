import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import type { AtestadoDTO, AtestadoDetalhadoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AtestadosService } from './atestados.service';
import { EnviarAtestadoDto } from './dto/enviar-atestado.dto';
import { RejeitarAtestadoDto } from './dto/rejeitar-atestado.dto';

/**
 * Duas pontas: o MONTADOR envia e vê os seus; o RH analisa os de todos. O
 * `usuarioId` do envio vem do token, nunca do corpo — atestado é do dono da
 * sessão. Nenhuma rota aqui é acessível a GESTOR ou DEPOSITO (N8T2, LGPD).
 */
@Controller('atestados')
export class AtestadosController {
  constructor(private readonly atestados: AtestadosService) {}

  @Roles(Perfil.MONTADOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async enviar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: EnviarAtestadoDto,
  ): Promise<AtestadoDTO> {
    return this.atestados.enviar(usuario.id, dto);
  }

  @Roles(Perfil.MONTADOR)
  @Get('meus')
  async meus(@CurrentUser() usuario: UsuarioAutenticado): Promise<AtestadoDTO[]> {
    return this.atestados.listarDoUsuario(usuario.id);
  }

  @Roles(Perfil.RH)
  @Get('pendentes')
  async pendentes(): Promise<AtestadoDTO[]> {
    return this.atestados.listarPendentes();
  }

  @Roles(Perfil.RH)
  @Get(':id')
  async detalhar(@Param('id', ParseIntPipe) id: number): Promise<AtestadoDetalhadoDTO> {
    return this.atestados.detalhar(id);
  }

  @Roles(Perfil.RH)
  @Patch(':id/validar')
  async validar(
    @CurrentUser() analista: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AtestadoDTO> {
    return this.atestados.validar(id, analista.id);
  }

  @Roles(Perfil.RH)
  @Patch(':id/rejeitar')
  async rejeitar(
    @CurrentUser() analista: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejeitarAtestadoDto,
  ): Promise<AtestadoDTO> {
    return this.atestados.rejeitar(id, analista.id, dto.motivo);
  }
}
