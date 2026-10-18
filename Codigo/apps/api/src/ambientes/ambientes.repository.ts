import { Injectable } from '@nestjs/common';
import type { StatusAmbiente } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';

const CODIGO_PRISMA_VIOLACAO_UNICIDADE = 'P2002';

/**
 * Checagem por forma (não `instanceof`): o cliente Prisma gerado no build
 * pode divergir, por identidade de módulo, da classe importada aqui.
 */
function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: unknown }).code === CODIGO_PRISMA_VIOLACAO_UNICIDADE
  );
}

export interface Ambiente {
  id: number;
  nome: string;
}

/** Ambiente de um pedido atribuído ao montador, como o pull de sincronização o consome. */
export interface AmbienteParaSync {
  id: number;
  pedidoId: number;
  nome: string;
  status: StatusAmbiente;
}

@Injectable()
export class AmbientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agrupamento automático da triagem (US07/UC09/UC10): mesmo pedido + mesmo
   * nome sempre cai no mesmo ambiente. `@@unique([pedidoId, nome])` é quem
   * garante isso sob concorrência — o `catch` aqui só cobre a corrida entre
   * o `findFirst` e o `create` de dois operadores bipando ao mesmo tempo.
   */
  async buscarOuCriar(pedidoId: number, nome: string): Promise<Ambiente> {
    const existente = await this.prisma.ambiente.findFirst({
      where: { pedidoId, nome },
      select: { id: true, nome: true },
    });
    if (existente) return existente;

    try {
      return await this.prisma.ambiente.create({
        data: { pedidoId, nome },
        select: { id: true, nome: true },
      });
    } catch (erro) {
      if (!ehViolacaoDeUnicidade(erro)) throw erro;
      return this.prisma.ambiente.findFirstOrThrow({
        where: { pedidoId, nome },
        select: { id: true, nome: true },
      });
    }
  }

  /**
   * Linhas do pull de sincronização: ambientes dos pedidos atribuídos ao
   * montador. No pull incremental, os alterados depois de `alteradosDesde` e
   * todos os dos pedidos em que ele foi atribuído depois disso (o pedido
   * antigo passa a ficar visível com seus ambientes).
   */
  async listarParaSync(usuarioId: number, alteradosDesde?: Date): Promise<AmbienteParaSync[]> {
    const linhas = await this.prisma.ambiente.findMany({
      where: {
        pedido: { montadores: { some: { usuarioId } } },
        ...(alteradosDesde
          ? {
              OR: [
                { updatedAt: { gt: alteradosDesde } },
                {
                  pedido: {
                    montadores: { some: { usuarioId, createdAt: { gt: alteradosDesde } } },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { id: 'asc' },
      select: { id: true, pedidoId: true, nome: true, status: true },
    });
    return linhas.map((linha) => ({
      ...linha,
      status: linha.status as unknown as StatusAmbiente,
    }));
  }
}
