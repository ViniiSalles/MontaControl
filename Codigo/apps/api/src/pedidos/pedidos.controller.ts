import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import type {
  PedidoComAmbientesDTO,
  PedidoDTO,
  PedidoResumoDTO,
  StatusPedido as StatusPedidoCompartilhado,
} from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { ListarPedidosQueryDto } from './dto/listar-pedidos.query.dto';
import { PedidosService } from './pedidos.service';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Roles(Perfil.GESTOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criar(@Body() dto: CriarPedidoDto): Promise<PedidoDTO> {
    return this.pedidos.criar(dto);
  }

  @Roles(Perfil.GESTOR, Perfil.DEPOSITO)
  @Get()
  async listar(@Query() query: ListarPedidosQueryDto): Promise<PedidoResumoDTO[]> {
    return this.pedidos.listar(query.status as unknown as StatusPedidoCompartilhado);
  }

  /**
   * Pedidos em que o montador está trabalhando, com ambientes e peças — de
   * onde ele escolhe a peça ao reportar avaria. Antes de `:numeroPedido`,
   * senão "meus" vira um número de pedido.
   */
  @Roles(Perfil.MONTADOR)
  @Get('meus')
  async meus(@CurrentUser() usuario: UsuarioAutenticado): Promise<PedidoComAmbientesDTO[]> {
    return this.pedidos.listarDoMontador(usuario.id);
  }

  /** US07/N7T3 — o Operador Logístico confere o pedido triado antes do despacho. */
  @Roles(Perfil.DEPOSITO)
  @Get(':numeroPedido')
  async buscar(@Param('numeroPedido') numeroPedido: string): Promise<PedidoComAmbientesDTO> {
    return this.pedidos.buscarComAmbientes(numeroPedido);
  }
}
