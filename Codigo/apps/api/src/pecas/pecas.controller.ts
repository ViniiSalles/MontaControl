import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import type { PecaDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { AssociarCodigoBarrasDto } from './dto/associar-codigo-barras.dto';
import { TriarPecaDto } from './dto/triar-peca.dto';
import { PecasService } from './pecas.service';

/** US07 — a triagem de peça é exclusiva do Operador Logístico (perfil DEPOSITO). */
@Controller('pecas')
export class PecasController {
  constructor(private readonly pecas: PecasService) {}

  @Roles(Perfil.DEPOSITO)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async triar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: TriarPecaDto,
  ): Promise<PecaDTO> {
    return this.pecas.triar(usuario.id, dto);
  }

  /** Operador escolhe uma peça PENDENTE do pedido e associa o código de barras lido. */
  @Roles(Perfil.DEPOSITO)
  @Patch(':id/codigo-barras')
  async associarCodigoBarras(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssociarCodigoBarrasDto,
  ): Promise<PecaDTO> {
    return this.pecas.associarCodigoBarras(usuario.id, id, dto.codigoBarras.trim());
  }
}
