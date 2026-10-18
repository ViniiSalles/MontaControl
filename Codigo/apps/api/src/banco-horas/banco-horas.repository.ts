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

/** Saldo mensal como o pull de sincronização o consome. */
export interface BancoHorasParaSync {
  id: number;
  mes: number;
  ano: number;
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldo: number;
}

/** Primeira competência (mês/ano) que a réplica carrega. */
export interface CompetenciaInicial {
  ano: number;
  mes: number;
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

  /**
   * Linhas do pull de sincronização: competências do usuário de `inicial` em
   * diante e, no pull incremental, alteradas depois de `alteradosDesde`.
   */
  async listarParaSync(
    usuarioId: number,
    inicial: CompetenciaInicial,
    alteradosDesde?: Date,
  ): Promise<BancoHorasParaSync[]> {
    const linhas = await this.prisma.bancoHoras.findMany({
      where: {
        usuarioId,
        OR: [{ ano: { gt: inicial.ano } }, { ano: inicial.ano, mes: { gte: inicial.mes } }],
        updatedAt: alteradosDesde ? { gt: alteradosDesde } : undefined,
      },
      orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
      select: SELECAO_BANCO_HORAS,
    });
    return linhas.map((linha) => ({
      id: linha.id,
      mes: linha.mes,
      ano: linha.ano,
      horasTrabalhadas: linha.horasTrabalhadas.toNumber(),
      horasPrevistas: linha.horasPrevistas.toNumber(),
      saldo: linha.saldo.toNumber(),
    }));
  }
}
