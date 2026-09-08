import { Injectable } from '@nestjs/common';
import { diaNoFuso, horasPrevistasNoMes, limitesDoMes, minutosDaJornada } from '@montacontrol/shared';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { BancoHorasRepository } from './banco-horas.repository';

const MINUTOS_POR_HORA = 60;

@Injectable()
export class BancoHorasService {
  constructor(
    private readonly bancoHoras: BancoHorasRepository,
    private readonly jornadas: JornadasRepository,
  ) {}

  /** Sem `mes`/`ano`, calcula o mês corrente no fuso de operação. */
  async calcular(usuarioId: number, mes?: number, ano?: number): Promise<BancoHorasDTO> {
    const [mesResolvido, anoResolvido] = this.resolverPeriodo(mes, ano);

    const { inicioIso, fimIso } = limitesDoMes(mesResolvido, anoResolvido, FUSO_OPERACAO);
    const jornadasDoMes = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);

    const minutosTrabalhados = jornadasDoMes.reduce(
      (soma, jornada) => soma + minutosDaJornada(jornada),
      0,
    );
    const horasTrabalhadas = minutosTrabalhados / MINUTOS_POR_HORA;
    const horasPrevistas = horasPrevistasNoMes(mesResolvido, anoResolvido);

    return this.bancoHoras.salvar({
      usuarioId,
      mes: mesResolvido,
      ano: anoResolvido,
      horasTrabalhadas,
      horasPrevistas,
      saldo: horasTrabalhadas - horasPrevistas,
    });
  }

  private resolverPeriodo(mes: number | undefined, ano: number | undefined): [number, number] {
    if (mes !== undefined && ano !== undefined) return [mes, ano];

    const hoje = diaNoFuso(new Date().toISOString(), FUSO_OPERACAO);
    const [anoAtual, mesAtual] = hoje.split('-').map(Number);
    return [mes ?? mesAtual, ano ?? anoAtual];
  }
}
