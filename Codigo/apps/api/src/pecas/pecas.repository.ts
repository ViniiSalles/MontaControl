import { Injectable } from '@nestjs/common';
import type { PecaDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';
import { paraPecaDTO, SELECAO_PECA } from './peca-mapper';

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

export interface DadosNovaPeca {
  ambienteId: number;
  codigoBarras: string;
  descricao: string;
  triadaPor: number;
}

@Injectable()
export class PecasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorCodigoBarras(codigoBarras: string): Promise<{ id: number } | null> {
    return this.prisma.peca.findUnique({
      where: { codigoBarras },
      select: { id: true },
    });
  }

  /** `null` em violação de unicidade (N7T2) — o código de barras já foi triado por outra peça. */
  async criar(dados: DadosNovaPeca): Promise<PecaDTO | null> {
    try {
      const linha = await this.prisma.peca.create({
        data: {
          ambienteId: dados.ambienteId,
          codigoBarras: dados.codigoBarras,
          descricao: dados.descricao,
          triadaPor: dados.triadaPor,
        },
        select: SELECAO_PECA,
      });
      return paraPecaDTO(linha);
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro)) return null;
      throw erro;
    }
  }
}
