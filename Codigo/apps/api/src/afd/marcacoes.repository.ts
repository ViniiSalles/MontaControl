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

/**
 * Quantas marcações selar por transação. O Prisma 7 tem timeout padrão de
 * 5000ms por `$transaction`; selar tudo (backfill da migração + volume
 * mensal) numa única transação arriscava estourar esse limite e falhar
 * (P2028) de um jeito que não se recupera sozinho. Em lotes, cada transação
 * é curta o bastante para nunca chegar perto do timeout.
 */
export const TAMANHO_LOTE_SELAGEM = 200;

type ResultadoLote = { ok: true; quantidade: number } | { ok: false; montadoresSemCpf: string[] };

@Injectable()
export class MarcacoesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sela (calcula o hash SHA-256) toda marcação ainda sem hash, em ordem de
   * NSR, encadeando a partir do hash da última já selada — a cadeia é
   * global (todas as marcações desde sempre), não reinicia por período
   * exportado.
   *
   * Selagem em lotes (`TAMANHO_LOTE_SELAGEM` por vez), cada um sua própria
   * transação, para nunca arriscar o timeout padrão de `$transaction`. Duas
   * garantias preservadas apesar do particionamento:
   *
   * 1. Tudo-ou-nada por CPF: uma checagem prévia, somente leitura, sob o
   *    mesmo advisory lock, olha TODAS as pendentes (não só o primeiro
   *    lote) antes de qualquer escrita — se alguma for de usuário sem CPF,
   *    nada é selado.
   * 2. Cadeia de hash correta entre lotes: cada lote relê a última selada
   *    de dentro da sua própria transação (depois de adquirir o lock), em
   *    vez de carregar `hashAnterior` em memória entre transações
   *    separadas — assim cada lote enxerga o commit do lote anterior.
   *
   * Defesa em profundidade: se uma marcação sem CPF aparecer entre a
   * checagem prévia e um lote específico (ex.: check-in concorrente), esse
   * lote detecta e interrompe a selagem (devolve `ok: false` para esta
   * chamada), sem desfazer o que já foi selado em lotes anteriores — que
   * eram, sim, cpf-completos no momento em que foram selados.
   */
  async selarPendentes(): Promise<ResultadoSelagem> {
    const semCpfInicial = await this.checarCpfCompletoAntesDeSelar();
    if (semCpfInicial.length > 0) return { ok: false, montadoresSemCpf: semCpfInicial };

    for (;;) {
      const resultadoLote = await this.selarProximoLote();
      if (!resultadoLote.ok) return { ok: false, montadoresSemCpf: resultadoLote.montadoresSemCpf };
      if (resultadoLote.quantidade === 0) return { ok: true, montadoresSemCpf: [] };
    }
  }

  /**
   * Checagem prévia, somente leitura: nenhuma pendente pode ficar sem CPF,
   * em lugar nenhum da fila — não dá para selar em lotes e descobrir só no
   * meio do caminho que um lote isolado ficaria bloqueado. Sob o mesmo
   * advisory lock da selagem, para ver o mesmo estado que os lotes vão ver.
   */
  private async checarCpfCompletoAntesDeSelar(): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      // `pg_advisory_xact_lock` retorna `void`, e o driver adapter
      // `@prisma/adapter-pg` não sabe deserializar essa coluna
      // (`UnsupportedNativeDataType`) — por isso o `IS NULL` no final, só
      // para dar ao resultado um tipo (`boolean`) que o adapter consegue
      // ler; o valor em si é descartado. O lock já foi adquirido como
      // efeito colateral da avaliação da função (mesmo padrão de
      // `JornadasRepository.registrarMarcacao`).
      //
      // Correção depende do nível de isolamento padrão (READ COMMITTED):
      // cada statement desta transação enxerga um snapshot novo, tirado
      // depois de adquirir o lock. Se algum dia alguém passar um
      // `isolationLevel` explícito para este `$transaction`, essa suposição
      // precisa ser reconferida.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CHAVE_LOCK_NSR}::bigint) IS NULL`;

      const pendentes = await tx.marcacaoPonto.findMany({
        where: { hash: null },
        select: { usuario: { select: { cpf: true, nome: true } } },
      });
      return [...new Set(pendentes.filter((p) => !p.usuario.cpf).map((p) => p.usuario.nome))];
    });
  }

  /** Sela até `TAMANHO_LOTE_SELAGEM` pendentes, numa transação própria. */
  private async selarProximoLote(): Promise<ResultadoLote> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CHAVE_LOCK_NSR}::bigint) IS NULL`;

      const pendentes = await tx.marcacaoPonto.findMany({
        where: { hash: null },
        orderBy: { nsr: 'asc' },
        take: TAMANHO_LOTE_SELAGEM,
        include: { usuario: { select: { cpf: true, nome: true } } },
      });
      if (pendentes.length === 0) return { ok: true, quantidade: 0 };

      // Defesa contra concorrência: a checagem prévia já garantiu que não
      // havia pendente sem CPF em lugar nenhum, mas um check-in concorrente
      // pode ter criado uma nova marcação sem CPF depois daquela checagem.
      // Como a varredura é em ordem de NSR, ela só aparece no lote quando
      // for a sua vez — interrompe aqui, sem tocar no que outros lotes já
      // seguraram.
      const semCpf = [...new Set(pendentes.filter((p) => !p.usuario.cpf).map((p) => p.usuario.nome))];
      if (semCpf.length > 0) return { ok: false, montadoresSemCpf: semCpf };

      // Relido de dentro desta transação, depois do lock: precisa refletir
      // o commit de qualquer lote anterior, não um valor carregado em
      // memória da aplicação entre transações separadas.
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
        // `updateMany` + checagem de `count` (em vez de `update({ where: { id } })`):
        // uma escrita irreversível como esta nunca pode aplicar em silêncio
        // na linha errada nem virar um no-op — a condição `hash: null` some
        // do WHERE assim que a linha já foi selada por outra chamada.
        const resultado = await tx.marcacaoPonto.updateMany({
          where: { id: marcacao.id, hash: null },
          data: { hash },
        });
        if (resultado.count !== 1) {
          throw new Error(
            `Selagem da marcação nsr=${marcacao.nsr} (id=${marcacao.id}) afetou ${resultado.count} linha(s); esperado exatamente 1.`,
          );
        }
        hashAnterior = hash;
      }

      return { ok: true, quantidade: pendentes.length };
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
