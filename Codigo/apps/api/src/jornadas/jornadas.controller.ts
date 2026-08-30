import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import type { HistoricoJornadasDTO, JornadaDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { CheckinDto } from './dto/checkin.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { HistoricoQueryDto } from './dto/historico.query.dto';
import { JornadasService } from './jornadas.service';

/**
 * Jornada é do montador e de mais ninguém: o `usuarioId` vem sempre do
 * token (`@CurrentUser`), nunca do corpo, para que um montador não consiga
 * bater ponto no nome de outro.
 */
@Controller('jornadas')
@Roles(Perfil.MONTADOR)
export class JornadasController {
  constructor(private readonly jornadas: JornadasService) {}

  @Post('checkin')
  async checkin(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: CheckinDto,
  ): Promise<JornadaDTO> {
    return this.jornadas.checkin(usuario.id, dto);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  async checkout(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: CheckoutDto,
  ): Promise<JornadaDTO> {
    return this.jornadas.checkout(usuario.id, dto);
  }

  @Get('atual')
  async atual(@CurrentUser() usuario: UsuarioAutenticado): Promise<JornadaDTO | null> {
    return this.jornadas.buscarAtual(usuario.id);
  }

  @Get('historico')
  async historico(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() query: HistoricoQueryDto,
  ): Promise<HistoricoJornadasDTO> {
    return this.jornadas.historico(usuario.id, query.dias);
  }
}
