import { Injectable } from '@nestjs/common';
import { comporInstante, diaNoFuso, somarDias } from '@montacontrol/shared';
import type { SolicitacaoPontoDTO, SolicitarPontoEmAtrasoRequest } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PontosEmAtrasoRepository } from './pontos-em-atraso.repository';
import { PeriodoInvalidoException } from './exceptions/periodo-invalido.exception';
import { PeriodoJaRegistradoException } from './exceptions/periodo-ja-registrado.exception';
import { SolicitacaoForaDaJanelaException } from './exceptions/solicitacao-fora-da-janela.exception';
import { SolicitacaoNaoEncontradaException } from './exceptions/solicitacao-nao-encontrada.exception';
import { SolicitacaoPendenteNoDiaException } from './exceptions/solicitacao-pendente-no-dia.exception';

/**
 * Quanto para trás o montador pode lançar. Acompanha o maior período do
 * histórico: o dia que ele não consegue mais ver na tela também não deve
 * conseguir lançar.
 */
const LIMITE_RETROATIVO_DIAS = 30;

@Injectable()
export class PontosEmAtrasoService {
  constructor(
    private readonly solicitacoes: PontosEmAtrasoRepository,
    private readonly jornadas: JornadasRepository,
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

    return this.solicitacoes.criar({
      usuarioId,
      idCliente: dados.idCliente,
      data: dados.data,
      inicioIso,
      fimIso,
      minutosSolicitados: minutos,
      justificativa: dados.justificativa.trim(),
    });
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
}
