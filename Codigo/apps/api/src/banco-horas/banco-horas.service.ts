import { Injectable } from '@nestjs/common';
import {
  MINUTOS_JORNADA_PADRAO,
  agruparJornadasPorDia,
  comporInstante,
  diasAbonados,
  diasUteisNoMes,
  periodoDoMes,
  somarDias,
} from '@montacontrol/shared';
import type { SaldoMontadorDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PontosEmAtrasoRepository } from '../pontos-em-atraso/pontos-em-atraso.repository';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { BancoHorasRepository } from './banco-horas.repository';

function paraHoras(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100;
}

@Injectable()
export class BancoHorasService {
  constructor(
    private readonly banco: BancoHorasRepository,
    private readonly jornadas: JornadasRepository,
    private readonly atestados: AtestadosRepository,
    private readonly pontos: PontosEmAtrasoRepository,
    private readonly usuarios: UsuariosRepository,
  ) {}

  /** Painel do RH: uma linha por montador (inclusive inativo, que ainda tem mês a fechar). */
  async listarDaEquipe(ano: number, mes: number): Promise<SaldoMontadorDTO[]> {
    const todos = await this.usuarios.listar();
    const montadores = todos.filter((usuario) => usuario.perfil === Perfil.MONTADOR);
    const pendentes = await this.pontos.contarPendentesPorUsuario(
      montadores.map((montador) => montador.id),
    );

    const linhas: SaldoMontadorDTO[] = [];
    for (const montador of montadores) {
      linhas.push(
        await this.montarLinha(montador.id, montador.nome, ano, mes, pendentes.get(montador.id) ?? 0),
      );
    }
    return linhas;
  }

  async doMontador(usuarioId: number, ano: number, mes: number): Promise<SaldoMontadorDTO> {
    const usuario = (await this.usuarios.listar()).find((item) => item.id === usuarioId);
    const pendentes = await this.pontos.contarPendentesPorUsuario([usuarioId]);
    return this.montarLinha(
      usuarioId,
      usuario?.nome ?? '',
      ano,
      mes,
      pendentes.get(usuarioId) ?? 0,
    );
  }

  /**
   * Fonte da verdade do mês: jornadas finalizadas + dias abonados por
   * atestado validado. Recalcular na leitura é o que faz a aprovação de um
   * atestado (ou de uma compensação) aparecer no saldo sem gatilho nenhum —
   * e o que evita `AtestadosModule` e este módulo se importarem em círculo.
   */
  private async montarLinha(
    usuarioId: number,
    usuarioNome: string,
    ano: number,
    mes: number,
    compensacoesPendentes: number,
  ): Promise<SaldoMontadorDTO> {
    const { inicio, fim } = periodoDoMes(ano, mes);
    const inicioIso = comporInstante(inicio, '00:00', FUSO_OPERACAO);
    const fimIso = new Date(
      new Date(comporInstante(somarDias(fim, 1), '00:00', FUSO_OPERACAO)).getTime() - 1,
    ).toISOString();

    const jornadas = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);
    const minutosTrabalhados = agruparJornadasPorDia(jornadas, FUSO_OPERACAO).reduce(
      (soma, dia) => soma + dia.minutosTrabalhados,
      0,
    );

    const validados = await this.atestados.listarValidadosNoPeriodo(usuarioId, inicio, fim);
    const minutosAbonados = diasAbonados(validados, ano, mes).size * MINUTOS_JORNADA_PADRAO;
    const minutosPrevistos = diasUteisNoMes(ano, mes).length * MINUTOS_JORNADA_PADRAO;

    const snapshot = await this.banco.salvarSnapshot({
      usuarioId,
      ano,
      mes,
      horasTrabalhadas: paraHoras(minutosTrabalhados),
      horasPrevistas: paraHoras(minutosPrevistos),
      saldo: paraHoras(minutosTrabalhados + minutosAbonados - minutosPrevistos),
    });

    return {
      ...snapshot,
      usuarioNome,
      horasAbonadas: paraHoras(minutosAbonados),
      compensacoesPendentes,
    };
  }
}
