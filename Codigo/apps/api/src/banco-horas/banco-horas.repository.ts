import { Injectable } from '@nestjs/common';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface DadosSnapshot {
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

  /**
   * O saldo é sempre recalculado na leitura; a linha em `banco_horas` é o
   * retrato do último cálculo (é o que o DER pede e o que dá base ao
   * relatório do mês fechado), nunca a fonte da verdade.
   */
  async salvarSnapshot(dados: DadosSnapshot): Promise<BancoHorasDTO> {
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
      select: {
        id: true,
        usuarioId: true,
        mes: true,
        ano: true,
        horasTrabalhadas: true,
        horasPrevistas: true,
        saldo: true,
      },
    });

    return {
      id: linha.id,
      usuarioId: linha.usuarioId,
      mes: linha.mes,
      ano: linha.ano,
      horasTrabalhadas: linha.horasTrabalhadas.toNumber(),
      horasPrevistas: linha.horasPrevistas.toNumber(),
      saldo: linha.saldo.toNumber(),
    };
  }
}
