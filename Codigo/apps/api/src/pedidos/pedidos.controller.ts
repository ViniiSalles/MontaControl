import { Controller, Get, Param } from '@nestjs/common';
import type { PedidoComAmbientesDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { Roles } from '../auth/decorators/roles.decorator';
import { PedidosService } from './pedidos.service';

/** US07/N7T3 — o Operador Logístico confere o pedido triado antes do despacho. */
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Roles(Perfil.DEPOSITO)
  @Get(':numeroPedido')
  async buscar(@Param('numeroPedido') numeroPedido: string): Promise<PedidoComAmbientesDTO> {
    return this.pedidos.buscarComAmbientes(numeroPedido);
  }
}
