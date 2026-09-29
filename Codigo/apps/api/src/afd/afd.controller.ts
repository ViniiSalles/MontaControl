import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { AfdQueryDto } from './dto/afd.query.dto';
import { AfdService } from './afd.service';

/** Portaria MTP nº 671/2021 (issue #56) — arquivo fonte de dados do REP-P. Só o RH exporta. */
@Controller('afd')
@Roles(Perfil.RH)
export class AfdController {
  constructor(private readonly afd: AfdService) {}

  @Get()
  async exportar(@Query() query: AfdQueryDto, @Res() resposta: Response): Promise<void> {
    const { conteudo, nomeArquivo } = await this.afd.gerar(query.ano, query.mes);
    resposta
      .status(200)
      .set({
        'Content-Type': 'text/plain; charset=ISO-8859-1',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      })
      .send(conteudo);
  }
}
