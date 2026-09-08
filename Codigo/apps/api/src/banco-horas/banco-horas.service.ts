import { Injectable } from '@nestjs/common';
import { diaNoFuso, horasPrevistasNoMes, limitesDoMes, minutosDaJornada } from '@montacontrol/shared';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { BancoHorasRepository } from './banco-horas.repository';

const MINUTOS_POR_HORA = 60;

interface SaldoCalculado {
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldo: number;
}

@Injectable()
export class BancoHorasService {
  constructor(
    private readonly bancoHoras: BancoHorasRepository,
    private readonly jornadas: JornadasRepository,
  ) {}

  /** Sem `mes`/`ano`, calcula o mês corrente no fuso de operação. Grava o resultado. */
  async calcular(usuarioId: number, mes?: number, ano?: number): Promise<BancoHorasDTO> {
    const [mesResolvido, anoResolvido] = this.resolverPeriodo(mes, ano);
    const saldo = await this.computar(usuarioId, mesResolvido, anoResolvido);

    return this.bancoHoras.salvar({
      usuarioId,
      mes: mesResolvido,
      ano: anoResolvido,
      ...saldo,
    });
  }

  /**
   * Mesmo cálculo de `calcular`, mas sem gravar — para quem consulta o
   * saldo de outra pessoa (ex.: espelho de ponto do RH) e não deve, como
   * efeito colateral de uma leitura, sobrescrever o registro calculado de
   * outro usuário.
   */
  async calcularSemPersistir(usuarioId: number, mes?: number, ano?: number): Promise<BancoHorasDTO> {
    const [mesResolvido, anoResolvido] = this.resolverPeriodo(mes, ano);
    const saldo = await this.computar(usuarioId, mesResolvido, anoResolvido);
    const existente = await this.bancoHoras.buscar(usuarioId, mesResolvido, anoResolvido);

    return {
      id: existente?.id ?? 0,
      usuarioId,
      mes: mesResolvido,
      ano: anoResolvido,
      ...saldo,
    };
  }

  private async computar(usuarioId: number, mes: number, ano: number): Promise<SaldoCalculado> {
    const { inicioIso, fimIso } = limitesDoMes(mes, ano, FUSO_OPERACAO);
    const jornadasDoMes = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);

    const minutosTrabalhados = jornadasDoMes.reduce(
      (soma, jornada) => soma + minutosDaJornada(jornada),
      0,
    );
    const horasTrabalhadas = minutosTrabalhados / MINUTOS_POR_HORA;
    const horasPrevistas = horasPrevistasNoMes(mes, ano);

    return { horasTrabalhadas, horasPrevistas, saldo: horasTrabalhadas - horasPrevistas };
  }

  private resolverPeriodo(mes: number | undefined, ano: number | undefined): [number, number] {
    if (mes !== undefined && ano !== undefined) return [mes, ano];

    const hoje = diaNoFuso(new Date().toISOString(), FUSO_OPERACAO);
    const [anoAtual, mesAtual] = hoje.split('-').map(Number);
    return [mes ?? mesAtual, ano ?? anoAtual];
  }
}
