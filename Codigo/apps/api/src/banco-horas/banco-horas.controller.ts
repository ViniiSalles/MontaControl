import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import type { SaldoMontadorDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { BancoHorasService } from './banco-horas.service';
import { CompetenciaQueryDto } from './dto/competencia.query.dto';

@Controller('banco-horas')
@Roles(Perfil.RH, Perfil.GESTOR)
export class BancoHorasController {
  constructor(private readonly banco: BancoHorasService) {}

  @Get()
  async listar(@Query() query: CompetenciaQueryDto): Promise<SaldoMontadorDTO[]> {
    return this.banco.listarDaEquipe(query.ano, query.mes);
  }

  @Get(':usuarioId')
  async doMontador(
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Query() query: CompetenciaQueryDto,
  ): Promise<SaldoMontadorDTO> {
    return this.banco.doMontador(usuarioId, query.ano, query.mes);
  }
}
