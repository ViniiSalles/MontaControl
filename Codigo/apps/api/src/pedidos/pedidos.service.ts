import { Injectable } from '@nestjs/common';
import {
  StatusPedido,
  type CriarPedidoRequest,
  type MontadorResumoDTO,
  type PedidoComAmbientesDTO,
  type PedidoDTO,
  type PedidoResumoDTO,
} from '@montacontrol/shared';
import { ClientesRepository } from '../clientes/clientes.repository';
import { ClienteNaoEncontradoException } from '../clientes/exceptions/cliente-nao-encontrado.exception';
import { MontadoresInvalidosException } from '../usuarios/exceptions/montadores-invalidos.exception';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { PedidoNaoEncontradoException } from './exceptions/pedido-nao-encontrado.exception';
import { PedidosRepository } from './pedidos.repository';

@Injectable()
export class PedidosService {
  constructor(
    private readonly pedidos: PedidosRepository,
    private readonly clientes: ClientesRepository,
    private readonly usuarios: UsuariosRepository,
  ) {}

  async criar(dados: CriarPedidoRequest): Promise<PedidoDTO> {
    if (!(await this.clientes.existe(dados.clienteId))) throw new ClienteNaoEncontradoException();

    const pedido = await this.pedidos.criar(dados.clienteId, dados.ambientes);
    return {
      id: pedido.id,
      numeroPedido: pedido.numeroPedido,
      status: StatusPedido.AGUARDANDO,
      clienteId: dados.clienteId,
    };
  }

  async listar(status?: StatusPedido): Promise<PedidoResumoDTO[]> {
    return this.pedidos.listar(status);
  }

  async listarDoMontador(usuarioId: number): Promise<PedidoComAmbientesDTO[]> {
    return this.pedidos.listarDoMontador(usuarioId);
  }

  /** N7T3 — peças do pedido organizadas por ambiente, para conferência antes do despacho. */
  async buscarComAmbientes(numeroPedido: string): Promise<PedidoComAmbientesDTO> {
    const pedido = await this.pedidos.buscarComAmbientes(numeroPedido);
    if (!pedido) throw new PedidoNaoEncontradoException();
    return pedido;
  }

  async listarMontadores(pedidoId: number): Promise<MontadorResumoDTO[]> {
    if (!(await this.pedidos.existe(pedidoId))) throw new PedidoNaoEncontradoException();
    return this.pedidos.listarMontadores(pedidoId);
  }

  /**
   * Atribuição é sempre por pessoa: a equipe só pré-preenche a lista na tela.
   * Lista vazia é válida — tira todos da obra.
   */
  async atribuirMontadores(pedidoId: number, usuarioIds: number[]): Promise<MontadorResumoDTO[]> {
    if (!(await this.pedidos.existe(pedidoId))) throw new PedidoNaoEncontradoException();

    const unicos = [...new Set(usuarioIds)];
    const validos = await this.usuarios.filtrarMontadoresAtivos(unicos);
    if (validos.length !== unicos.length) throw new MontadoresInvalidosException();

    return this.pedidos.definirMontadores(pedidoId, unicos);
  }
}
