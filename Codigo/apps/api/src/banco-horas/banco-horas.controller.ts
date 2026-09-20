import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import type { BancoHorasDTO, SaldoMontadorDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { BancoHorasService } from './banco-horas.service';
import { BancoHorasQueryDto } from './dto/banco-horas.query.dto';
import { CompetenciaQueryDto } from './dto/competencia.query.dto';

@Controller('banco-horas')
export class BancoHorasController {
  constructor(private readonly bancoHoras: BancoHorasService) {}

  /** Banco de horas é do montador e de mais ninguém — usuarioId sempre do token. */
  @Get()
  @Roles(Perfil.MONTADOR)
  async consultar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() query: BancoHorasQueryDto,
  ): Promise<BancoHorasDTO> {
    return this.bancoHoras.calcular(usuario.id, query.mes, query.ano);
  }

  /** Painel do RH: uma linha por montador da equipe. */
  @Get('equipe')
  @Roles(Perfil.RH, Perfil.GESTOR)
  async listarDaEquipe(@Query() query: CompetenciaQueryDto): Promise<SaldoMontadorDTO[]> {
    return this.bancoHoras.listarDaEquipe(query.ano, query.mes);
  }

  @Get(':usuarioId')
  @Roles(Perfil.RH, Perfil.GESTOR)
  async doMontador(
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Query() query: CompetenciaQueryDto,
  ): Promise<SaldoMontadorDTO> {
    return this.bancoHoras.doMontador(usuarioId, query.ano, query.mes);
  }
}
