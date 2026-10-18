import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type {
  MontadorResumoDTO,
  PedidoComAmbientesDTO,
  PedidoDoMontadorDTO,
  PedidoDTO,
  PedidoResumoDTO,
  StatusPedido,
} from '@montacontrol/shared';
import {
  StatusPeca as StatusPecaPrisma,
  StatusPedido as StatusPedidoPrisma,
} from '../../generated/prisma';
import { PrismaTransacao } from '../prisma/prisma-transacao';
import { PrismaService } from '../prisma/prisma.service';
import {
  paraPedidoComAmbientesDTO,
  paraPedidoDoMontadorDTO,
  paraPedidoDTO,
  SELECAO_PEDIDO,
  SELECAO_PEDIDO_COM_AMBIENTES,
  SELECAO_PEDIDO_DO_MONTADOR,
} from './pedido-mapper';

export interface CoordenadasCliente {
  latitude: number;
  longitude: number;
}

export interface DadosItemNovo {
  descricao: string;
  quantidade: number;
}

export interface DadosAmbienteNovo {
  nome: string;
  itens: DadosItemNovo[];
}

/** `PED-000042` — legível para o gestor, derivado do id da linha. */
function numeroDoPedido(id: number): string {
  return `PED-${String(id).padStart(6, '0')}`;
}

/** Atribuído ao montador (`pedido_montador`) ou com jornada dele vinculada ao pedido. */
function vinculoDoMontador(usuarioId: number) {
  return {
    OR: [{ montadores: { some: { usuarioId } } }, { jornadas: { some: { usuarioId } } }],
  };
}

/** Pedido atribuído ao montador, com o cliente (local da obra) desnormalizado, como o pull o consome. */
export interface PedidoParaSync {
  id: number;
  numeroPedido: string;
  status: StatusPedido;
  clienteId: number;
  clienteNome: string;
  clienteEndereco: string;
  clienteCidade: string;
  clienteEstado: string;
  clienteLatitude: number;
  clienteLongitude: number;
}

/**
 * Pedidos que a réplica do montador contém: SOMENTE os atribuídos a ele
 * (`pedido_montador`). Diferente de `vinculoDoMontador`, uma jornada não dá
 * visibilidade — o pull e as exclusões (tombstones da desalocação) precisam
 * concordar sobre quando um pedido some da réplica.
 */
function atribuidoAoMontador(usuarioId: number) {
  return { montadores: { some: { usuarioId } } };
}

/** O montador foi atribuído depois de `desde`: o pedido antigo passa a ficar visível. */
function atribuidoDepoisDe(usuarioId: number, desde: Date) {
  return { montadores: { some: { usuarioId, createdAt: { gt: desde } } } };
}

@Injectable()
export class PedidosRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Coordenadas do cliente do pedido, ou `null` se o pedido não existe. */
  async buscarCoordenadasCliente(pedidoId: number): Promise<CoordenadasCliente | null> {
    const linha = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { cliente: { select: { latitude: true, longitude: true } } },
    });
    if (!linha) return null;

    return {
      latitude: linha.cliente.latitude.toNumber(),
      longitude: linha.cliente.longitude.toNumber(),
    };
  }

  /** Como `buscarCoordenadasCliente`, mas `null` também quando o pedido não é do montador. */
  async buscarCoordenadasClienteDoMontador(
    pedidoId: number,
    usuarioId: number,
  ): Promise<CoordenadasCliente | null> {
    const linha = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, ...vinculoDoMontador(usuarioId) },
      select: { cliente: { select: { latitude: true, longitude: true } } },
    });
    if (!linha) return null;

    return {
      latitude: linha.cliente.latitude.toNumber(),
      longitude: linha.cliente.longitude.toNumber(),
    };
  }

  /**
   * Cria pedido + ambientes + um slot de `Peca` PENDENTE por item
   * planejado, tudo numa transação. `numeroPedido` só pode ser calculado
   * depois do insert (depende do id gerado), então nasce com um valor
   * temporário único e é corrigido em seguida, na mesma transação.
   */
  async criar(
    clienteId: number,
    ambientes: DadosAmbienteNovo[],
  ): Promise<{ id: number; numeroPedido: string }> {
    return this.prisma.$transaction(async (tx) => {
      const criado = await tx.pedido.create({
        data: { clienteId, numeroPedido: `TEMP-${randomUUID()}` },
        select: { id: true },
      });
      const pedido = await tx.pedido.update({
        where: { id: criado.id },
        data: { numeroPedido: numeroDoPedido(criado.id) },
        select: { id: true, numeroPedido: true },
      });

      for (const ambiente of ambientes) {
        const ambienteCriado = await tx.ambiente.create({
          data: { pedidoId: pedido.id, nome: ambiente.nome },
          select: { id: true },
        });
        for (const item of ambiente.itens) {
          await this.criarItem(ambienteCriado.id, item.descricao, item.quantidade, tx);
        }
      }

      return pedido;
    });
  }

  /**
   * Um item do pedido = um slot: uma única linha de `Peca` PENDENTE que carrega
   * a `quantidade` planejada (150 pregos = 1 linha, bipada uma vez). `itemId`
   * recebe o próprio id da linha. Cada chamada cria um item novo, mesmo que já
   * exista outro com a mesma descrição no ambiente.
   */
  async criarItem(
    ambienteId: number,
    descricao: string,
    quantidade: number,
    tx?: PrismaTransacao,
  ): Promise<number> {
    const executar = async (cliente: PrismaTransacao): Promise<number> => {
      const slot = await cliente.peca.create({
        data: { ambienteId, descricao, quantidade, itemId: 0 },
        select: { id: true },
      });
      await cliente.peca.update({ where: { id: slot.id }, data: { itemId: slot.id } });
      return slot.id;
    };

    if (tx) return executar(tx);
    return this.prisma.$transaction(executar);
  }

  async listar(status?: StatusPedido): Promise<PedidoResumoDTO[]> {
    const linhas = await this.prisma.pedido.findMany({
      where: status ? { status: status as unknown as StatusPedidoPrisma } : undefined,
      select: {
        id: true,
        numeroPedido: true,
        status: true,
        clienteId: true,
        cliente: { select: { nome: true } },
        ambientes: { select: { pecas: { select: { status: true } } } },
        _count: { select: { montadores: true } },
      },
      orderBy: { id: 'desc' },
    });

    return linhas.map((linha) => {
      const pecas = linha.ambientes.flatMap((ambiente) => ambiente.pecas);
      return {
        id: linha.id,
        numeroPedido: linha.numeroPedido,
        status: linha.status as unknown as StatusPedido,
        clienteId: linha.clienteId,
        clienteNome: linha.cliente.nome,
        quantidadeTotal: pecas.length,
        quantidadeTriada: pecas.filter((peca) => peca.status !== StatusPecaPrisma.PENDENTE).length,
        quantidadeMontadores: linha._count.montadores,
      };
    });
  }

  async buscarPorNumero(numeroPedido: string): Promise<PedidoDTO | null> {
    const linha = await this.prisma.pedido.findUnique({
      where: { numeroPedido },
      select: SELECAO_PEDIDO,
    });
    return linha ? paraPedidoDTO(linha) : null;
  }

  /** Peças agrupadas por ambiente (N7T3) — conferência visual antes do despacho. */
  async buscarComAmbientes(numeroPedido: string): Promise<PedidoComAmbientesDTO | null> {
    const linha = await this.prisma.pedido.findUnique({
      where: { numeroPedido },
      select: SELECAO_PEDIDO_COM_AMBIENTES,
    });
    return linha ? paraPedidoComAmbientesDTO(linha) : null;
  }

  /**
   * Montador está trabalhando no pedido: atribuído a ele (`pedido_montador`)
   * ou com jornada vinculada a ele. Qualquer jornada, não só a aberta — o
   * reporte pode sincronizar da outbox depois do check-out.
   */
  async montadorVinculado(pedidoId: number, usuarioId: number): Promise<boolean> {
    const total = await this.prisma.pedido.count({
      where: { id: pedidoId, ...vinculoDoMontador(usuarioId) },
    });
    return total > 0;
  }

  /** Pedidos em que o montador está trabalhando, com as peças — base do reporte de avaria no app. */
  async listarDoMontador(usuarioId: number): Promise<PedidoDoMontadorDTO[]> {
    const linhas = await this.prisma.pedido.findMany({
      where: vinculoDoMontador(usuarioId),
      orderBy: { id: 'desc' },
      select: SELECAO_PEDIDO_DO_MONTADOR,
    });
    return linhas.map(paraPedidoDoMontadorDTO);
  }

  async existe(id: number): Promise<boolean> {
    return (await this.prisma.pedido.count({ where: { id } })) > 0;
  }

  /** Montadores atribuídos à obra, em ordem alfabética. */
  async listarMontadores(pedidoId: number): Promise<MontadorResumoDTO[]> {
    const linhas = await this.prisma.pedidoMontador.findMany({
      where: { pedidoId },
      select: { usuario: { select: { id: true, nome: true, ativo: true } } },
      orderBy: { usuario: { nome: 'asc' } },
    });
    return linhas.map((linha) => linha.usuario);
  }

  /**
   * Roda `fn` numa transação do banco. O `tx` recebido deve ser repassado aos
   * métodos de repositório que aceitam `tx?` — assim o service coordena várias
   * escritas atômicas sem importar o Prisma.
   */
  emTransacao<T>(fn: (tx: PrismaTransacao) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /**
   * Troca o conjunto inteiro de montadores do pedido: quem saiu da lista perde
   * o vínculo, quem entrou ganha, quem ficou não é tocado. Devolve os ids de
   * quem saiu, para o chamador registrar a exclusão na mesma transação. Sem
   * `tx`, abre uma transação própria.
   */
  async definirMontadores(
    pedidoId: number,
    usuarioIds: number[],
    tx?: PrismaTransacao,
  ): Promise<number[]> {
    const executar = async (cliente: PrismaTransacao): Promise<number[]> => {
      // Corrida aceita (READ COMMITTED): a leitura de `saindo` e o `deleteMany` não
      // são atômicos entre si. Duas atribuições simultâneas ao mesmo pedido podem
      // deixar o conjunto final de uma delas e perder o tombstone de quem a outra
      // removeu; o gestor reabre a tela e reatribui. Sem trava de linha de propósito:
      // atribuir montador é ação rara e manual de um único gestor por vez.
      const saindo = await cliente.pedidoMontador.findMany({
        where: { pedidoId, usuarioId: { notIn: usuarioIds } },
        select: { usuarioId: true },
      });
      const removidos = saindo.map((linha) => linha.usuarioId);

      if (removidos.length > 0) {
        await cliente.pedidoMontador.deleteMany({
          where: { pedidoId, usuarioId: { in: removidos } },
        });
      }
      await cliente.pedidoMontador.createMany({
        data: usuarioIds.map((usuarioId) => ({ pedidoId, usuarioId })),
        skipDuplicates: true,
      });
      return removidos;
    };

    if (tx) return executar(tx);
    return this.prisma.$transaction(executar);
  }

  /** Ids dos ambientes e das peças do pedido — o que some da réplica junto com ele. */
  async listarIdsAmbientesEPecas(
    pedidoId: number,
    tx?: PrismaTransacao,
  ): Promise<{ ambienteIds: number[]; pecaIds: number[] }> {
    const cliente = tx ?? this.prisma;
    const [ambientes, pecas] = await Promise.all([
      cliente.ambiente.findMany({ where: { pedidoId }, select: { id: true } }),
      cliente.peca.findMany({ where: { ambiente: { pedidoId } }, select: { id: true } }),
    ]);
    return {
      ambienteIds: ambientes.map((ambiente) => ambiente.id),
      pecaIds: pecas.map((peca) => peca.id),
    };
  }

  /** Primeira triagem do pedido: sai de AGUARDANDO para EM_TRIAGEM. Não-AGUARDANDO fica como está. */
  async marcarEmTriagem(id: number): Promise<void> {
    await this.prisma.pedido.updateMany({
      where: { id, status: StatusPedidoPrisma.AGUARDANDO },
      data: { status: StatusPedidoPrisma.EM_TRIAGEM },
    });
  }

  /**
   * Linhas do pull de sincronização: pedidos atribuídos ao montador. No pull
   * incremental, só os que mudaram depois de `alteradosDesde`: o próprio
   * pedido, o cliente ou a atribuição (`pedido_montador.created_at`).
   */
  async listarParaSync(usuarioId: number, alteradosDesde?: Date): Promise<PedidoParaSync[]> {
    const linhas = await this.prisma.pedido.findMany({
      where: {
        ...atribuidoAoMontador(usuarioId),
        ...(alteradosDesde
          ? {
              OR: [
                { updatedAt: { gt: alteradosDesde } },
                { cliente: { updatedAt: { gt: alteradosDesde } } },
                atribuidoDepoisDe(usuarioId, alteradosDesde),
              ],
            }
          : {}),
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        numeroPedido: true,
        status: true,
        cliente: {
          select: {
            id: true,
            nome: true,
            endereco: true,
            cidade: true,
            estado: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    return linhas.map((linha) => ({
      id: linha.id,
      numeroPedido: linha.numeroPedido,
      status: linha.status as unknown as StatusPedido,
      clienteId: linha.cliente.id,
      clienteNome: linha.cliente.nome,
      clienteEndereco: linha.cliente.endereco,
      clienteCidade: linha.cliente.cidade,
      clienteEstado: linha.cliente.estado,
      clienteLatitude: linha.cliente.latitude.toNumber(),
      clienteLongitude: linha.cliente.longitude.toNumber(),
    }));
  }
}
