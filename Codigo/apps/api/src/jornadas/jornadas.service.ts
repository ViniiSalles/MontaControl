import { Injectable } from '@nestjs/common';
import {
  agruparJornadasPorDia,
  calcularDistanciaMetros,
  comporInstante,
  diaNoFuso,
  jornadaVencida,
  somarDias,
} from '@montacontrol/shared';
import type {
  CheckinRequest,
  CheckoutRequest,
  HistoricoJornadasDTO,
  JornadaDTO,
  PeriodoHistorico,
} from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../common/fuso';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { JornadasRepository } from './jornadas.repository';
import { JornadaEmAndamentoException } from './exceptions/jornada-em-andamento.exception';
import { RegistroForaDaJanelaException } from './exceptions/registro-fora-da-janela.exception';
import { SemJornadaAbertaException } from './exceptions/sem-jornada-aberta.exception';
import { CheckoutAntesDoCheckinException } from './exceptions/checkout-antes-do-checkin.exception';
import { JornadaVencidaException } from './exceptions/jornada-vencida.exception';
import { PedidoInvalidoException } from './exceptions/pedido-invalido.exception';
import { ForaDoRaioToleradoException } from './exceptions/fora-do-raio-tolerado.exception';

/** Tolerância para relógio de aparelho adiantado. */
const TOLERANCIA_FUTURO_MS = 5 * 60_000;

/** Distância máxima aceita entre a marcação e o endereço do cliente do pedido. */
const RAIO_TOLERANCIA_METROS = 200;

@Injectable()
export class JornadasService {
  constructor(
    private readonly jornadas: JornadasRepository,
    private readonly pedidos: PedidosRepository,
  ) {}

  async checkin(usuarioId: number, dados: CheckinRequest): Promise<JornadaDTO> {
    const jaCriada = await this.jornadas.buscarPorCheckinIdCliente(usuarioId, dados.idCliente);
    if (jaCriada) return jaCriada;

    this.validarJanela(dados.registradoEm);

    // Só jornada viva bloqueia. A vencida (check-out esquecido) fica onde
    // está, para ser corrigida por ponto em atraso, e não pode impedir o
    // montador de começar o turno de hoje.
    const aberta = await this.jornadas.buscarAbertaDoUsuario(usuarioId);
    if (aberta && !jornadaVencida(aberta, new Date().toISOString())) {
      throw new JornadaEmAndamentoException();
    }

    await this.validarDistanciaDoPedido(dados.pedidoId, dados.latitude, dados.longitude);

    return this.jornadas.criarCheckin({
      usuarioId,
      idCliente: dados.idCliente,
      latitude: dados.latitude,
      longitude: dados.longitude,
      endereco: dados.endereco ?? null,
      checkinAt: new Date(dados.registradoEm),
      pedidoId: dados.pedidoId ?? null,
    });
  }

  async checkout(usuarioId: number, dados: CheckoutRequest): Promise<JornadaDTO> {
    const jaEncerrada = await this.jornadas.buscarPorCheckoutIdCliente(usuarioId, dados.idCliente);
    if (jaEncerrada) return jaEncerrada;

    this.validarJanela(dados.registradoEm);

    const aberta = await this.jornadas.buscarAbertaDoUsuario(usuarioId);
    if (!aberta) throw new SemJornadaAbertaException();

    // O limite é medido contra o instante batido, não contra o relógio do
    // servidor: quem decide se o turno estourou é a hora da saída.
    if (jornadaVencida(aberta, dados.registradoEm)) throw new JornadaVencidaException();

    if (aberta.checkinAt && dados.registradoEm < aberta.checkinAt) {
      throw new CheckoutAntesDoCheckinException();
    }

    await this.validarDistanciaDoPedido(dados.pedidoId, dados.latitude, dados.longitude);

    return this.jornadas.registrarCheckout(aberta.id, {
      idCliente: dados.idCliente,
      latitude: dados.latitude,
      longitude: dados.longitude,
      endereco: dados.endereco ?? null,
      checkoutAt: new Date(dados.registradoEm),
      pedidoId: dados.pedidoId ?? null,
    });
  }

  /**
   * Sem `pedidoId` não há contra o que validar — a seleção de pedido no
   * check-in ainda não existe no app, e bloquear todo mundo até que exista
   * pararia o time inteiro.
   */
  private async validarDistanciaDoPedido(
    pedidoId: number | undefined,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    if (pedidoId === undefined) return;

    const cliente = await this.pedidos.buscarCoordenadasCliente(pedidoId);
    if (!cliente) throw new PedidoInvalidoException();

    const distancia = calcularDistanciaMetros({ latitude, longitude }, cliente);
    if (distancia > RAIO_TOLERANCIA_METROS) throw new ForaDoRaioToleradoException();
  }

  async buscarAtual(usuarioId: number): Promise<JornadaDTO | null> {
    return this.jornadas.buscarAbertaDoUsuario(usuarioId);
  }

  async historico(usuarioId: number, dias: PeriodoHistorico): Promise<HistoricoJornadasDTO> {
    const fimPeriodo = diaNoFuso(new Date().toISOString(), FUSO_OPERACAO);
    const inicioPeriodo = somarDias(fimPeriodo, -(dias - 1));

    // O fim é a meia-noite do dia seguinte menos 1 ms: pegar `23:59` deixaria
    // de fora o check-in feito entre 23:59:01 e 23:59:59.
    const inicioIso = comporInstante(inicioPeriodo, '00:00', FUSO_OPERACAO);
    const fimIso = new Date(
      new Date(comporInstante(somarDias(fimPeriodo, 1), '00:00', FUSO_OPERACAO)).getTime() - 1,
    ).toISOString();

    const jornadas = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);
    const diasAgrupados = agruparJornadasPorDia(jornadas, FUSO_OPERACAO);

    return {
      periodoDias: dias,
      inicioPeriodo,
      fimPeriodo,
      dias: diasAgrupados,
      totalMinutos: diasAgrupados.reduce((soma, dia) => soma + dia.minutosTrabalhados, 0),
    };
  }

  /**
   * O registro vale para o dia em que foi efetuado. O dia anterior também é
   * aceito, porque o aparelho pode ter passado a noite sem rede — o atraso é
   * da sincronização, não do ponto. Mais que isso é relógio errado ou
   * lançamento indevido, e o caminho é o ponto em atraso.
   */
  private validarJanela(registradoEmIso: string): void {
    const registrado = new Date(registradoEmIso);
    if (Number.isNaN(registrado.getTime())) throw new RegistroForaDaJanelaException();

    const agora = new Date();
    if (registrado.getTime() - agora.getTime() > TOLERANCIA_FUTURO_MS) {
      throw new RegistroForaDaJanelaException();
    }

    const diaRegistro = diaNoFuso(registrado.toISOString(), FUSO_OPERACAO);
    const hoje = diaNoFuso(agora.toISOString(), FUSO_OPERACAO);
    const ontem = somarDias(hoje, -1);

    if (diaRegistro !== hoje && diaRegistro !== ontem) {
      throw new RegistroForaDaJanelaException();
    }
  }
}
