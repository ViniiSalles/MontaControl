import { Controller, Get, Body, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import type { SolicitacaoPontoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { SolicitarPontoEmAtrasoDto } from './dto/solicitar-ponto-em-atraso.dto';
import { PontosEmAtrasoService } from './pontos-em-atraso.service';

/**
 * Duas pontas do mesmo recurso, com perfis opostos: o MONTADOR pede, o
 * GESTOR analisa. Como no check-in, o `usuarioId` do pedido vem do token e
 * nunca do corpo — senão um montador lançaria hora no nome de outro.
 */
@Controller('pontos-em-atraso')
export class PontosEmAtrasoController {
  constructor(private readonly pontos: PontosEmAtrasoService) {}

  @Roles(Perfil.MONTADOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async solicitar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: SolicitarPontoEmAtrasoDto,
  ): Promise<SolicitacaoPontoDTO> {
    return this.pontos.solicitar(usuario.id, dto);
  }

  @Roles(Perfil.GESTOR)
  @Get(':id')
  async detalhar(@Param('id', ParseIntPipe) id: number): Promise<SolicitacaoPontoDTO> {
    return this.pontos.buscarPorId(id);
  }
}
