import { Controller, Get, Query } from '@nestjs/common';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { BancoHorasService } from './banco-horas.service';
import { BancoHorasQueryDto } from './dto/banco-horas.query.dto';

/** Banco de horas é do montador e de mais ninguém — usuarioId sempre do token. */
@Controller('banco-horas')
@Roles(Perfil.MONTADOR)
export class BancoHorasController {
  constructor(private readonly bancoHoras: BancoHorasService) {}

  @Get()
  async consultar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() query: BancoHorasQueryDto,
  ): Promise<BancoHorasDTO> {
    return this.bancoHoras.calcular(usuario.id, query.mes, query.ano);
  }
}
