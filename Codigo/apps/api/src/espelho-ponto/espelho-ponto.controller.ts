import { Controller, Get, Query } from '@nestjs/common';
import type { EspelhoPontoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { EspelhoPontoQueryDto } from './dto/espelho-ponto.query.dto';
import { EspelhoPontoService } from './espelho-ponto.service';

/** Só o RH consulta o espelho de ponto — de qualquer montador, por isso o usuarioId vem da query, não do token. */
@Controller('espelho-ponto')
@Roles(Perfil.RH)
export class EspelhoPontoController {
  constructor(private readonly espelhoPonto: EspelhoPontoService) {}

  @Get()
  async consultar(@Query() query: EspelhoPontoQueryDto): Promise<EspelhoPontoDTO> {
    return this.espelhoPonto.gerar(query.usuarioId, query.mes, query.ano);
  }
}
