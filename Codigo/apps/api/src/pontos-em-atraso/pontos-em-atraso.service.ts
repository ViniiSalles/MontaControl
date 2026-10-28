import { Injectable, Logger } from '@nestjs/common';
import { comporInstante, diaNoFuso, somarDias } from '@montacontrol/shared';
import type { SolicitacaoPontoDTO, SolicitarPontoEmAtrasoRequest } from '@montacontrol/shared';
import { Perfil, StatusSolicitacaoPonto } from '../../generated/prisma';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { notificarSemFalhar } from '../notificacoes/notificar-sem-falhar';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { PontosEmAtrasoRepository } from './pontos-em-atraso.repository';
import { MotivoRejeicaoInvalidoException } from './exceptions/motivo-rejeicao-invalido.exception';
import { PeriodoInvalidoException } from './exceptions/periodo-invalido.exception';
import { PeriodoJaRegistradoException } from './exceptions/periodo-ja-registrado.exception';
import { SolicitacaoForaDaJanelaException } from './exceptions/solicitacao-fora-da-janela.exception';
import { SolicitacaoJaAnalisadaException } from './exceptions/solicitacao-ja-analisada.exception';
import { SolicitacaoNaoEncontradaException } from './exceptions/solicitacao-nao-encontrada.exception';
import { SolicitacaoPendenteNoDiaException } from './exceptions/solicitacao-pendente-no-dia.exception';

/**
 * Quanto para trás o montador pode lançar. Acompanha o maior período do
 * histórico: o dia que ele não consegue mais ver na tela também não deve
 * conseguir lançar.
 */
const LIMITE_RETROATIVO_DIAS = 30;

/** `2026-09-01` -> `01/09/2026`, para o texto da notificação. */
function formatarDia(dia: string): string {
  return dia.split('-').reverse().join('/');
}

@Injectable()
export class PontosEmAtrasoService {
  private readonly logger = new Logger(PontosEmAtrasoService.name);

  constructor(
    private readonly solicitacoes: PontosEmAtrasoRepository,
    private readonly jornadas: JornadasRepository,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async solicitar(
    usuarioId: number,
    dados: SolicitarPontoEmAtrasoRequest,
  ): Promise<SolicitacaoPontoDTO> {
    // Idempotência antes de qualquer regra: o reenvio da outbox não é um
    // pedido novo, e recusá-lo com 409 faria a fila do aparelho travar.
    const jaCriada = await this.solicitacoes.buscarPorIdCliente(dados.idCliente);
    if (jaCriada) return jaCriada;

    this.validarJanela(dados.data);

    const inicioIso = comporInstante(dados.data, dados.horaInicio, FUSO_OPERACAO);
    const fimIso = comporInstante(dados.data, dados.horaFim, FUSO_OPERACAO);
    const minutos = Math.round(
      (new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / 60_000,
    );
    if (minutos <= 0) throw new PeriodoInvalidoException();

    if (await this.solicitacoes.existePendenteNoDia(usuarioId, dados.data)) {
      throw new SolicitacaoPendenteNoDiaException();
    }

    // A checagem de sobreposição é aqui, e não só na aprovação: recusar na
    // entrada evita colocar na fila do gestor um pedido que ele nunca
    // poderia aprovar.
    if (await this.jornadas.existeSobreposicao(usuarioId, inicioIso, fimIso)) {
      throw new PeriodoJaRegistradoException();
    }

    const criada = await this.solicitacoes.criar({
      usuarioId,
      idCliente: dados.idCliente,
      data: dados.data,
      inicioIso,
      fimIso,
      minutosSolicitados: minutos,
      justificativa: dados.justificativa.trim(),
    });

    await notificarSemFalhar(
      this.notificacoes,
      {
        perfis: [Perfil.GESTOR, Perfil.RH],
        tipo: 'PONTO_ATRASO_SOLICITADO',
        titulo: 'Ponto em atraso solicitado',
        mensagem: `${criada.usuarioNome} solicitou o lançamento de ponto em atraso do dia ${formatarDia(criada.data)}.`,
        referencia: { tipo: 'PONTO_ATRASO', id: criada.id },
        chaveOrigem: `ponto-atraso:${criada.id}:solicitado`,
      },
      this.logger,
    );
    return criada;
  }

  /** Detalhe de uma solicitação para a análise do gestor. */
  async buscarPorId(id: number): Promise<SolicitacaoPontoDTO> {
    const solicitacao = await this.solicitacoes.buscarPorId(id);
    if (!solicitacao) throw new SolicitacaoNaoEncontradaException();
    return solicitacao;
  }

  /** Nem no futuro, nem além do que o montador ainda enxerga no histórico. */
  private validarJanela(data: string): void {
    const hoje = diaNoFuso(new Date().toISOString(), FUSO_OPERACAO);
    const maisAntiga = somarDias(hoje, -(LIMITE_RETROATIVO_DIAS - 1));

    if (data > hoje || data < maisAntiga) {
      throw new SolicitacaoForaDaJanelaException(LIMITE_RETROATIVO_DIAS);
    }
  }

  async listarPendentes(): Promise<SolicitacaoPontoDTO[]> {
    return this.solicitacoes.listarPendentes();
  }

  /**
   * A sobreposição é checada de novo aqui, e não só na criação: entre o
   * pedido e a análise o montador pode ter batido ponto normalmente no
   * mesmo intervalo, e aprovar agora pagaria a hora duas vezes.
   */
  async aprovar(id: number, analistaId: number): Promise<SolicitacaoPontoDTO> {
    const solicitacao = await this.garantirPendente(id);

    if (
      await this.jornadas.existeSobreposicao(
        solicitacao.usuarioId,
        solicitacao.inicio,
        solicitacao.fim,
      )
    ) {
      throw new PeriodoJaRegistradoException();
    }

    const aprovada = await this.solicitacoes.aprovar(id, analistaId);

    await notificarSemFalhar(
      this.notificacoes,
      {
        usuarioIds: [solicitacao.usuarioId],
        tipo: 'PONTO_ATRASO_APROVADO',
        titulo: 'Ponto em atraso aprovado',
        mensagem: `Sua solicitação de ponto em atraso do dia ${formatarDia(solicitacao.data)} foi aprovada.`,
        referencia: { tipo: 'PONTO_ATRASO', id },
        chaveOrigem: `ponto-atraso:${id}:aprovado`,
      },
      this.logger,
    );
    return aprovada;
  }

  async rejeitar(id: number, analistaId: number, motivo: string): Promise<SolicitacaoPontoDTO> {
    const solicitacao = await this.garantirPendente(id);

    const motivoAparado = motivo.trim();
    if (!motivoAparado) throw new MotivoRejeicaoInvalidoException();

    const rejeitada = await this.solicitacoes.rejeitar(id, analistaId, motivoAparado);

    await notificarSemFalhar(
      this.notificacoes,
      {
        usuarioIds: [solicitacao.usuarioId],
        tipo: 'PONTO_ATRASO_REJEITADO',
        titulo: 'Ponto em atraso rejeitado',
        mensagem: `Sua solicitação de ponto em atraso do dia ${formatarDia(solicitacao.data)} foi rejeitada: ${motivoAparado}`,
        referencia: { tipo: 'PONTO_ATRASO', id },
        chaveOrigem: `ponto-atraso:${id}:rejeitado`,
      },
      this.logger,
    );
    return rejeitada;
  }

  private async garantirPendente(id: number): Promise<SolicitacaoPontoDTO> {
    const solicitacao = await this.solicitacoes.buscarPorId(id);
    if (!solicitacao) throw new SolicitacaoNaoEncontradaException();
    if (solicitacao.status !== StatusSolicitacaoPonto.PENDENTE) {
      throw new SolicitacaoJaAnalisadaException();
    }
    return solicitacao;
  }
}
