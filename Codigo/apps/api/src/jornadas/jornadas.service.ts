import { Injectable } from '@nestjs/common';
import { diaNoFuso, somarDias } from '@montacontrol/shared';
import type { CheckinRequest, CheckoutRequest, JornadaDTO } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from './jornadas.repository';
import { JornadaEmAndamentoException } from './exceptions/jornada-em-andamento.exception';
import { RegistroForaDaJanelaException } from './exceptions/registro-fora-da-janela.exception';
import { SemJornadaAbertaException } from './exceptions/sem-jornada-aberta.exception';
import { CheckoutAntesDoCheckinException } from './exceptions/checkout-antes-do-checkin.exception';

/** Tolerância para relógio de aparelho adiantado. */
const TOLERANCIA_FUTURO_MS = 5 * 60_000;

@Injectable()
export class JornadasService {
  constructor(private readonly jornadas: JornadasRepository) {}

  async checkin(usuarioId: number, dados: CheckinRequest): Promise<JornadaDTO> {
    const jaCriada = await this.jornadas.buscarPorCheckinIdCliente(usuarioId, dados.idCliente);
    if (jaCriada) return jaCriada;

    this.validarJanela(dados.registradoEm);

    const aberta = await this.jornadas.buscarAbertaDoUsuario(usuarioId);
    if (aberta) throw new JornadaEmAndamentoException();

    return this.jornadas.criarCheckin({
      usuarioId,
      idCliente: dados.idCliente,
      latitude: dados.latitude,
      longitude: dados.longitude,
      endereco: dados.endereco ?? null,
      checkinAt: new Date(dados.registradoEm),
    });
  }

  async checkout(usuarioId: number, dados: CheckoutRequest): Promise<JornadaDTO> {
    const jaEncerrada = await this.jornadas.buscarPorCheckoutIdCliente(usuarioId, dados.idCliente);
    if (jaEncerrada) return jaEncerrada;

    this.validarJanela(dados.registradoEm);

    const aberta = await this.jornadas.buscarAbertaDoUsuario(usuarioId);
    if (!aberta) throw new SemJornadaAbertaException();

    if (aberta.checkinAt && dados.registradoEm < aberta.checkinAt) {
      throw new CheckoutAntesDoCheckinException();
    }

    return this.jornadas.registrarCheckout(aberta.id, {
      idCliente: dados.idCliente,
      latitude: dados.latitude,
      longitude: dados.longitude,
      endereco: dados.endereco ?? null,
      checkoutAt: new Date(dados.registradoEm),
    });
  }

  async buscarAtual(usuarioId: number): Promise<JornadaDTO | null> {
    return this.jornadas.buscarAbertaDoUsuario(usuarioId);
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
