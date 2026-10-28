import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Ocupacao } from './disponibilidade';

const RESUMO_USUARIO = { select: { id: true, nome: true } } as const;

const SELECAO_ALUGUEL = {
  id: true,
  quantidade: true,
  inicio: true,
  fimPrevisto: true,
  devolvidoEm: true,
  observacao: true,
  tipoEpi: { select: { id: true, nome: true } },
  usuario: RESUMO_USUARIO,
  registrador: RESUMO_USUARIO,
  registradorDevolucao: RESUMO_USUARIO,
} as const;

interface Resumo {
  id: number;
  nome: string;
}

export interface AluguelEpi extends Ocupacao {
  id: number;
  observacao: string | null;
  tipoEpi: Resumo;
  usuario: Resumo;
  registrador: Resumo;
  registradorDevolucao: Resumo | null;
}

export interface OcupacaoDoTipo extends Ocupacao {
  tipoEpiId: number;
}

export interface DadosNovoAluguel {
  tipoEpiId: number;
  usuarioId: number;
  quantidade: number;
  inicio: Date;
  fimPrevisto: Date;
  observacao: string | null;
  registradoPor: number;
}

/** Recebe o que já ocupa o estoque no período e o estoque do tipo; diz se o novo aluguel cabe. */
export type VerificacaoEstoque = (ocupacoes: Ocupacao[], estoque: number) => boolean;

@Injectable()
export class AlugueisEpiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<AluguelEpi[]> {
    return this.prisma.aluguelEpi.findMany({ orderBy: { inicio: 'desc' }, select: SELECAO_ALUGUEL });
  }

  async buscarPorId(id: number): Promise<AluguelEpi | null> {
    return this.prisma.aluguelEpi.findUnique({ where: { id }, select: SELECAO_ALUGUEL });
  }

  /** Aluguéis ainda não devolvidos (reservados, em uso ou atrasados) de todos os tipos. */
  async listarEmAberto(): Promise<OcupacaoDoTipo[]> {
    return this.prisma.aluguelEpi.findMany({
      where: { devolvidoEm: null },
      select: { tipoEpiId: true, inicio: true, fimPrevisto: true, devolvidoEm: true, quantidade: true },
    });
  }

  /**
   * Cria o aluguel só se `cabe` aprovar, com a linha do tipo travada
   * (`FOR UPDATE`): dois gestores alugando a última unidade ao mesmo tempo
   * não passam os dois. A regra de disponibilidade fica no service; aqui só
   * a leitura consistente e a escrita.
   */
  async criarSeCouber(dados: DadosNovoAluguel, cabe: VerificacaoEstoque): Promise<AluguelEpi | 'SEM_ESTOQUE' | 'TIPO_NAO_ENCONTRADO'> {
    return this.prisma.$transaction(async (tx) => {
      const [tipo] = await tx.$queryRaw<Array<{ estoque: number }>>`
        SELECT "estoque" FROM "tipo_epi" WHERE "id" = ${dados.tipoEpiId} FOR UPDATE`;
      if (!tipo) return 'TIPO_NAO_ENCONTRADO';

      // Tudo que pode encostar no período: não devolvido (o atrasado segura a
      // unidade sem data para voltar) ou devolvido depois do início.
      const ocupacoes = await tx.aluguelEpi.findMany({
        where: {
          tipoEpiId: dados.tipoEpiId,
          inicio: { lt: dados.fimPrevisto },
          OR: [{ devolvidoEm: null }, { devolvidoEm: { gt: dados.inicio } }],
        },
        select: { inicio: true, fimPrevisto: true, devolvidoEm: true, quantidade: true },
      });
      if (!cabe(ocupacoes, tipo.estoque)) return 'SEM_ESTOQUE';

      return tx.aluguelEpi.create({ data: dados, select: SELECAO_ALUGUEL });
    });
  }

  /** `null` quando o aluguel não existe ou já foi devolvido (inclusive por outra requisição). */
  async registrarDevolucao(id: number, devolvidoEm: Date, registradoPor: number): Promise<AluguelEpi | null> {
    const { count } = await this.prisma.aluguelEpi.updateMany({
      where: { id, devolvidoEm: null },
      data: { devolvidoEm, devolucaoRegistradaPor: registradoPor },
    });
    return count > 0 ? this.buscarPorId(id) : null;
  }

  /** Só reserva que ainda não começou pode ser cancelada — o resto é histórico. */
  async removerSeReservado(id: number, agora: Date): Promise<boolean> {
    const { count } = await this.prisma.aluguelEpi.deleteMany({
      where: { id, devolvidoEm: null, inicio: { gt: agora } },
    });
    return count > 0;
  }
}
