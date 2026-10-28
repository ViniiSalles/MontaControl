import { Injectable, Logger } from '@nestjs/common';
import {
  SYNC_JANELA_ATESTADOS_DIAS,
  SYNC_JANELA_AVARIAS_DIAS,
  SYNC_JANELA_BANCO_HORAS_MESES,
  SYNC_JANELA_JORNADAS_DIAS,
  SYNC_JANELA_NOTIFICACOES_DIAS,
  SYNC_SCHEMA_VERSION,
  TABELAS_SYNC,
  diaNoFuso,
} from '@montacontrol/shared';
import type { SyncMudancas, SyncPullResponse } from '@montacontrol/shared';
import { AmbientesRepository } from '../ambientes/ambientes.repository';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { AvariasRepository } from '../avarias/avarias.repository';
import { TiposAvariaRepository } from '../avarias/tipos-avaria.repository';
import { BancoHorasRepository } from '../banco-horas/banco-horas.repository';
import type { CompetenciaInicial } from '../banco-horas/banco-horas.repository';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { NotificacoesRepository } from '../notificacoes/notificacoes.repository';
import { PecasRepository } from '../pecas/pecas.repository';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { VersaoSchemaIncompativelException } from './exceptions/versao-schema-incompativel.exception';
import { SyncExclusaoRepository } from './sync-exclusao.repository';
import type { ExclusaoParaSync } from './sync-exclusao.repository';
import {
  paraLinhaAmbiente,
  paraLinhaAtestado,
  paraLinhaAvaria,
  paraLinhaBancoHoras,
  paraLinhaJornada,
  paraLinhaNotificacao,
  paraLinhaPeca,
  paraLinhaPedido,
  paraLinhaTipoAvaria,
} from './sync.mappers';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Folga aplicada a `lastPulledAt` no filtro incremental. O `updated_at` de uma
 * linha é gravado no commit, que pode acontecer depois do relógio capturado no
 * começo do pull anterior; sem a folga essa linha cairia entre dois pulls.
 * Reenviar uma linha repetida não custa nada: o cliente faz upsert.
 */
export const SYNC_MARGEM_SEGURANCA_MS = 5 * 60 * 1000;

function mudancasVazias<Linha>(): SyncMudancas<Linha> {
  return { created: [], updated: [], deleted: [] };
}

/** Primeiro mês da janela do banco de horas: o mês atual (no fuso de operação) e os anteriores da janela. */
function primeiraCompetencia(agoraMs: number): CompetenciaInicial {
  const [ano, mes] = diaNoFuso(new Date(agoraMs).toISOString(), FUSO_OPERACAO)
    .split('-')
    .map(Number);
  const indice = ano * 12 + (mes - 1) - (SYNC_JANELA_BANCO_HORAS_MESES - 1);
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly jornadas: JornadasRepository,
    private readonly bancoHoras: BancoHorasRepository,
    private readonly bancoHorasService: BancoHorasService,
    private readonly pedidos: PedidosRepository,
    private readonly ambientes: AmbientesRepository,
    private readonly pecas: PecasRepository,
    private readonly tiposAvaria: TiposAvariaRepository,
    private readonly avarias: AvariasRepository,
    private readonly atestados: AtestadosRepository,
    private readonly notificacoes: NotificacoesRepository,
    private readonly exclusoes: SyncExclusaoRepository,
  ) {}

  /** O app só entende o contrato da sua própria versão; versão diferente precisa atualizar. */
  verificarVersaoSchema(schemaVersion: number): void {
    if (schemaVersion !== SYNC_SCHEMA_VERSION) {
      throw new VersaoSchemaIncompativelException(schemaVersion, SYNC_SCHEMA_VERSION);
    }
  }

  /**
   * Tudo que mudou na réplica do montador desde `lastPulledAt`. Sem ele (ou 0)
   * é o primeiro pull: histórico pelas janelas do contrato, sem exclusões. Os
   * pulls seguintes filtram só por alteração, sem janela. O escopo é sempre o do
   * `usuarioId`.
   *
   * O `timestamp` é o relógio do servidor lido ANTES das consultas: o cliente o
   * devolve como `lastPulledAt`, então uma escrita concorrente às consultas
   * tem `updated_at` posterior a ele e entra no pull seguinte.
   *
   * Antes das consultas, o saldo do mês corrente do usuário é recalculado: o
   * snapshot em `banco_horas` só é refeito por quem consulta o saldo, e sem isso
   * o aparelho ficaria com o saldo de quando a linha foi gravada pela última vez
   * (check-ins, check-outs e atestados não o atualizam). Só grava se o valor mudou,
   * então a linha só volta no pull quando há novidade.
   */
  async pull(usuarioId: number, lastPulledAt?: number): Promise<SyncPullResponse> {
    const timestamp = Date.now();
    await this.atualizarSaldoDoMesCorrente(usuarioId);
    const alteradosDesde =
      lastPulledAt === undefined || lastPulledAt === 0
        ? undefined
        : new Date(lastPulledAt - SYNC_MARGEM_SEGURANCA_MS);

    // As janelas valem só no primeiro pull. No incremental, uma linha que já está
    // no aparelho precisa continuar recebendo atualizações mesmo depois de sair da
    // janela (avaria criada no dia 0 e analisada no dia 35, por exemplo).
    const primeiroPull = alteradosDesde === undefined;
    const desdeJornadas = primeiroPull
      ? new Date(timestamp - SYNC_JANELA_JORNADAS_DIAS * DIA_MS)
      : undefined;
    const desdeAvarias = primeiroPull
      ? new Date(timestamp - SYNC_JANELA_AVARIAS_DIAS * DIA_MS)
      : undefined;
    const desdeAtestados = primeiroPull
      ? new Date(timestamp - SYNC_JANELA_ATESTADOS_DIAS * DIA_MS)
      : undefined;
    const competenciaInicial = primeiroPull ? primeiraCompetencia(timestamp) : undefined;

    const [
      jornadas,
      bancoHoras,
      pedidos,
      ambientes,
      pecas,
      tiposAvaria,
      avarias,
      atestados,
      notificacoes,
      excluidos,
    ] = await Promise.all([
      this.jornadas.listarParaSync(usuarioId, desdeJornadas, alteradosDesde),
      this.bancoHoras.listarParaSync(usuarioId, competenciaInicial, alteradosDesde),
      this.pedidos.listarParaSync(usuarioId, alteradosDesde),
      this.ambientes.listarParaSync(usuarioId, alteradosDesde),
      this.pecas.listarParaSync(usuarioId, alteradosDesde),
      this.tiposAvaria.listarParaSync(alteradosDesde),
      this.avarias.listarParaSync(usuarioId, desdeAvarias, alteradosDesde),
      this.atestados.listarParaSync(usuarioId, desdeAtestados, alteradosDesde),
      this.notificacoes.listarParaSync(
        usuarioId,
        alteradosDesde ?? null,
        SYNC_JANELA_NOTIFICACOES_DIAS,
      ),
      alteradosDesde ? this.exclusoes.listarDesde(usuarioId, alteradosDesde) : [],
    ]);

    const resposta: SyncPullResponse = {
      changes: {
        jornadas: { ...mudancasVazias(), updated: jornadas.map(paraLinhaJornada) },
        banco_horas: { ...mudancasVazias(), updated: bancoHoras.map(paraLinhaBancoHoras) },
        pedidos: { ...mudancasVazias(), updated: pedidos.map(paraLinhaPedido) },
        ambientes: { ...mudancasVazias(), updated: ambientes.map(paraLinhaAmbiente) },
        pecas: { ...mudancasVazias(), updated: pecas.map(paraLinhaPeca) },
        tipos_avaria: { ...mudancasVazias(), updated: tiposAvaria.map(paraLinhaTipoAvaria) },
        avarias: { ...mudancasVazias(), updated: avarias.map(paraLinhaAvaria) },
        atestados: { ...mudancasVazias(), updated: atestados.map(paraLinhaAtestado) },
        notificacoes: { ...mudancasVazias(), updated: notificacoes.map(paraLinhaNotificacao) },
      },
      timestamp,
    };

    this.aplicarExclusoes(resposta, excluidos);
    return resposta;
  }

  /** Melhor esforço: se o recálculo falhar, o pull segue com as linhas já gravadas. */
  private async atualizarSaldoDoMesCorrente(usuarioId: number): Promise<void> {
    try {
      await this.bancoHorasService.atualizarMesCorrenteSeMudou(usuarioId);
    } catch (erro) {
      this.logger.warn(
        `Recálculo do banco de horas do usuário ${usuarioId} falhou; seguindo com o saldo gravado: ${
          erro instanceof Error ? erro.message : String(erro)
        }`,
      );
    }
  }

  /**
   * Preenche `deleted` por tabela. Um id que também vai em `updated` volta a
   * existir para o montador (desalocado e reatribuído entre dois pulls, com
   * tombstone e nova atribuição depois do mesmo `lastPulledAt`): excluí-lo
   * apagaria no aparelho a linha que acabou de chegar.
   */
  private aplicarExclusoes(resposta: SyncPullResponse, excluidos: ExclusaoParaSync[]): void {
    for (const tabela of TABELAS_SYNC) {
      const mudancas: SyncMudancas<{ id: string }> = resposta.changes[tabela];
      const presentes = new Set(mudancas.updated.map((linha) => linha.id));
      const ids = excluidos
        .filter((exclusao) => exclusao.entidade === tabela)
        .map((exclusao) => exclusao.registroId)
        .filter((id) => !presentes.has(id));
      mudancas.deleted = [...new Set(ids)];
    }
  }
}
