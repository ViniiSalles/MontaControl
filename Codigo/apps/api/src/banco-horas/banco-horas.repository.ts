import { Injectable } from '@nestjs/common';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SELECAO_BANCO_HORAS, paraBancoHorasDTO } from './banco-horas-mapper';

export interface DadosBancoHoras {
  usuarioId: number;
  mes: number;
  ano: number;
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldo: number;
}

@Injectable()
export class BancoHorasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(usuarioId: number, mes: number, ano: number): Promise<BancoHorasDTO | null> {
    const linha = await this.prisma.bancoHoras.findUnique({
      where: { usuarioId_mes_ano: { usuarioId, mes, ano } },
      select: SELECAO_BANCO_HORAS,
    });
    return linha ? paraBancoHorasDTO(linha) : null;
  }

  /**
   * O saldo é sempre recalculado na leitura; a linha em `banco_horas` é o
   * retrato do último cálculo (é o que o DER pede e o que dá base ao
   * relatório do mês fechado), nunca a fonte da verdade.
   */
  async salvar(dados: DadosBancoHoras): Promise<BancoHorasDTO> {
    const linha = await this.prisma.bancoHoras.upsert({
      where: {
        usuarioId_mes_ano: { usuarioId: dados.usuarioId, mes: dados.mes, ano: dados.ano },
      },
      create: { ...dados, calculadoAt: new Date() },
      update: {
        horasTrabalhadas: dados.horasTrabalhadas,
        horasPrevistas: dados.horasPrevistas,
        saldo: dados.saldo,
        calculadoAt: new Date(),
      },
      select: SELECAO_BANCO_HORAS,
    });
    return paraBancoHorasDTO(linha);
  }
}
