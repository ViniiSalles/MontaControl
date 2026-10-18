import { Injectable } from '@nestjs/common';
import { TABELAS_SYNC } from '@montacontrol/shared';
import type { TabelaSync } from '@montacontrol/shared';
import { PrismaTransacao } from '../prisma/prisma-transacao';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Exclusão física a avisar ao aparelho. `entidade` é o nome da tabela da
 * réplica (`pedidos`, `ambientes`, `pecas`...), `registroId` o id da linha em
 * texto e `usuarioId` o dono do aparelho (`null` = vale para todos).
 */
export interface NovaExclusao {
  entidade: TabelaSync;
  registroId: string;
  usuarioId: number | null;
}

/** Exclusão como o pull a lê: o dono já foi filtrado na consulta. */
export interface ExclusaoParaSync {
  entidade: TabelaSync;
  registroId: string;
}

/**
 * Tombstones do pull incremental. Escreva sempre na mesma transação da
 * exclusão que eles descrevem, passando o `tx` recebido de quem a abriu.
 */
@Injectable()
export class SyncExclusaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    entidade: TabelaSync,
    registroId: string,
    usuarioId: number | null,
    tx?: PrismaTransacao,
  ): Promise<void> {
    await (tx ?? this.prisma).syncExclusao.create({
      data: { entidade, registroId, usuarioId },
    });
  }

  /** Uma única inserção para várias exclusões (ex.: as peças de um pedido). */
  async registrarVarios(exclusoes: NovaExclusao[], tx?: PrismaTransacao): Promise<void> {
    if (exclusoes.length === 0) return;
    await (tx ?? this.prisma).syncExclusao.createMany({
      data: exclusoes.map(({ entidade, registroId, usuarioId }) => ({
        entidade,
        registroId,
        usuarioId,
      })),
    });
  }

  /**
   * Exclusões que o aparelho do usuário ainda não viu: as dele e as globais
   * (`usuario_id` nulo) gravadas depois de `desde`. Só tabelas replicadas.
   */
  async listarDesde(usuarioId: number, desde: Date): Promise<ExclusaoParaSync[]> {
    const linhas = await this.prisma.syncExclusao.findMany({
      where: {
        excluidoEm: { gt: desde },
        OR: [{ usuarioId }, { usuarioId: null }],
        entidade: { in: [...TABELAS_SYNC] },
      },
      orderBy: { id: 'asc' },
      select: { entidade: true, registroId: true },
    });
    // O filtro `in` garante o valor; a coluna é `String` no schema.
    return linhas as ExclusaoParaSync[];
  }
}
