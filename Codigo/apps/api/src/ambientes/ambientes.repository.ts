import { Injectable } from '@nestjs/common';
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
}
