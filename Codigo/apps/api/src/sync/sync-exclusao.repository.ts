import { Injectable } from '@nestjs/common';
import { PrismaTransacao } from '../prisma/prisma-transacao';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Exclusão física a avisar ao aparelho. `entidade` é o nome da tabela da
 * réplica (`pedidos`, `ambientes`, `pecas`...), `registroId` o id da linha em
 * texto e `usuarioId` o dono do aparelho (`null` = vale para todos).
 */
export interface NovaExclusao {
  entidade: string;
  registroId: string;
  usuarioId: number | null;
}

/**
 * Tombstones do pull incremental. Escreva sempre na mesma transação da
 * exclusão que eles descrevem, passando o `tx` recebido de quem a abriu.
 */
@Injectable()
export class SyncExclusaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    entidade: string,
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
}
