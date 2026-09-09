import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import type { EspelhoPontoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompetenciaQueryDto } from '../banco-horas/dto/competencia.query.dto';
import { EspelhoPontoService } from './espelho-ponto.service';

/** Ponto de terceiro: só RH e GESTOR. O montador vê o próprio em `/jornadas/historico`. */
@Controller('espelho-ponto')
@Roles(Perfil.RH, Perfil.GESTOR)
export class EspelhoPontoController {
  constructor(private readonly espelho: EspelhoPontoService) {}

  @Get(':usuarioId')
  async montar(
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Query() query: CompetenciaQueryDto,
  ): Promise<EspelhoPontoDTO> {
    return this.espelho.montar(usuarioId, query.ano, query.mes);
  }
}
