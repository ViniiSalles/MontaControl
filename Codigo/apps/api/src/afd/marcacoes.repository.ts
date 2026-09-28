import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FUSO_OPERACAO } from '../common/fuso';
import { CHAVE_LOCK_NSR } from '../common/marcacao-ponto-lock';
import { calcularHashTipo7 } from './afd-leiaute';

export interface ResultadoSelagem {
  ok: boolean;
  montadoresSemCpf: string[];
}

export interface MarcacaoParaExportacao {
  nsr: number;
  cpf: string;
  marcadoEm: Date;
  gravadoEm: Date;
  coletor: string;
  offline: boolean;
  hash: string;
}

@Injectable()
export class MarcacoesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sela (calcula o hash SHA-256) toda marcação ainda sem hash, em ordem de
   * NSR, encadeando a partir do hash da última já selada — a cadeia é
   * global (todas as marcações desde sempre), não reinicia por período
   * exportado. Tudo sob o mesmo advisory lock do NSR: um check-in
   * concorrente não pode inserir uma marcação no meio da selagem.
   *
   * Se alguma marcação pendente for de usuário sem CPF, não sela nada
   * (`ok: false`) — não dá para calcular um hash correto sem o CPF, e o
   * hash é imutável depois de gravado.
   */
  async selarPendentes(): Promise<ResultadoSelagem> {
    return this.prisma.$transaction(async (tx) => {
      // `pg_advisory_xact_lock` retorna `void`, e o driver adapter
      // `@prisma/adapter-pg` não sabe deserializar essa coluna
      // (`UnsupportedNativeDataType`) — por isso o `IS NULL` no final, só
      // para dar ao resultado um tipo (`boolean`) que o adapter consegue
      // ler; o valor em si é descartado. O lock já foi adquirido como
      // efeito colateral da avaliação da função (mesmo padrão de
      // `JornadasRepository.registrarMarcacao`).
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CHAVE_LOCK_NSR}::bigint) IS NULL`;

      const pendentes = await tx.marcacaoPonto.findMany({
        where: { hash: null },
        orderBy: { nsr: 'asc' },
        include: { usuario: { select: { cpf: true, nome: true } } },
      });

      const semCpf = [...new Set(pendentes.filter((p) => !p.usuario.cpf).map((p) => p.usuario.nome))];
      if (semCpf.length > 0) return { ok: false, montadoresSemCpf: semCpf };

      const ultimaSelada = await tx.marcacaoPonto.findFirst({
        where: { hash: { not: null } },
        orderBy: { nsr: 'desc' },
        select: { hash: true },
      });
      let hashAnterior = ultimaSelada?.hash ?? null;

      for (const marcacao of pendentes) {
        const hash = calcularHashTipo7(
          {
            nsr: marcacao.nsr,
            cpf: marcacao.usuario.cpf as string,
            marcadoEmIso: marcacao.marcadoEm.toISOString(),
            gravadoEmIso: marcacao.gravadoEm.toISOString(),
            coletor: marcacao.coletor,
            offline: marcacao.offline,
          },
          hashAnterior,
          FUSO_OPERACAO,
        );
        await tx.marcacaoPonto.update({ where: { id: marcacao.id }, data: { hash } });
        hashAnterior = hash;
      }

      return { ok: true, montadoresSemCpf: [] };
    });
  }

  /** Marcações já seladas no período (pelo instante da marcação), em ordem de NSR. */
  async listarNoPeriodo(inicioIso: string, fimIso: string): Promise<MarcacaoParaExportacao[]> {
    const linhas = await this.prisma.marcacaoPonto.findMany({
      where: {
        marcadoEm: { gte: new Date(inicioIso), lte: new Date(fimIso) },
        hash: { not: null },
      },
      orderBy: { nsr: 'asc' },
      include: { usuario: { select: { cpf: true } } },
    });

    return linhas.map((linha) => {
      if (!linha.usuario.cpf || !linha.hash) {
        // Inalcançável em operação normal: `selarPendentes` só devolve `ok`
        // depois de confirmar CPF em todas as pendentes, e não existe rota
        // para remover um CPF já definido.
        throw new Error(`Marcação ${linha.nsr} selada sem CPF ou hash — invariante violada.`);
      }
      return {
        nsr: linha.nsr,
        cpf: linha.usuario.cpf,
        marcadoEm: linha.marcadoEm,
        gravadoEm: linha.gravadoEm,
        coletor: linha.coletor,
        offline: linha.offline,
        hash: linha.hash,
      };
    });
  }
}
