import { Controller, Get, Query } from '@nestjs/common';
import type { ClienteResumoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientesService } from './clientes.service';
import { ListarClientesQueryDto } from './dto/listar-clientes.query.dto';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  /** Alimenta o seletor de local/obra do cadastro de pedido. */
  @Roles(Perfil.GESTOR)
  @Get()
  async listar(@Query() query: ListarClientesQueryDto): Promise<ClienteResumoDTO[]> {
    return this.clientes.listar(query.busca);
  }
}
