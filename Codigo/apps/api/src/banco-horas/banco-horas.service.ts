import { Injectable } from '@nestjs/common';
import {
  MINUTOS_JORNADA_PADRAO,
  agruparJornadasPorDia,
  comporInstante,
  diaNoFuso,
  diasAbonados,
  diasUteisNoMes,
  periodoDoMes,
  somarDias,
} from '@montacontrol/shared';
import type { BancoHorasDTO, SaldoMontadorDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PontosEmAtrasoRepository } from '../pontos-em-atraso/pontos-em-atraso.repository';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { BancoHorasRepository } from './banco-horas.repository';

interface SaldoCalculado {
  horasTrabalhadas: number;
  horasPrevistas: number;
  horasAbonadas: number;
  saldo: number;
}

function paraHoras(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100;
}

@Injectable()
export class BancoHorasService {
  constructor(
    private readonly bancoHoras: BancoHorasRepository,
    private readonly jornadas: JornadasRepository,
    private readonly atestados: AtestadosRepository,
    private readonly pontos: PontosEmAtrasoRepository,
    private readonly usuarios: UsuariosRepository,
  ) {}

  /** Sem `mes`/`ano`, calcula o mês corrente no fuso de operação. Grava o resultado. */
  async calcular(usuarioId: number, mes?: number, ano?: number): Promise<BancoHorasDTO> {
    const [mesResolvido, anoResolvido] = this.resolverPeriodo(mes, ano);
    const { horasTrabalhadas, horasPrevistas, saldo } = await this.computar(
      usuarioId,
      anoResolvido,
      mesResolvido,
    );

    return this.bancoHoras.salvar({
      usuarioId,
      mes: mesResolvido,
      ano: anoResolvido,
      horasTrabalhadas,
      horasPrevistas,
      saldo,
    });
  }

  /**
   * Recalcula o mês corrente do montador e só grava se o resultado mudou. É o
   * que o pull de sincronização usa: o snapshot em `banco_horas` só é refeito
   * por quem consulta o saldo, e o aparelho só recebe a linha quando o
   * `updated_at` muda — regravar valores iguais reenviaria a linha em todo
   * pull (o upsert sempre renova `calculado_at`, logo `updated_at`).
   */
  async atualizarMesCorrenteSeMudou(usuarioId: number): Promise<BancoHorasDTO> {
    const [mes, ano] = this.resolverPeriodo(undefined, undefined);
    const calculado = await this.computar(usuarioId, ano, mes);
    const existente = await this.bancoHoras.buscar(usuarioId, mes, ano);

    if (
      existente &&
      existente.horasTrabalhadas === calculado.horasTrabalhadas &&
      existente.horasPrevistas === calculado.horasPrevistas &&
      existente.saldo === calculado.saldo
    ) {
      return existente;
    }

    return this.bancoHoras.salvar({
      usuarioId,
      mes,
      ano,
      horasTrabalhadas: calculado.horasTrabalhadas,
      horasPrevistas: calculado.horasPrevistas,
      saldo: calculado.saldo,
    });
  }

  /**
   * Mesmo cálculo de `calcular`, mas sem gravar — para quem consulta o
   * saldo de outra pessoa e não deve, como efeito colateral de uma leitura,
   * sobrescrever o registro calculado de outro usuário.
   */
  async calcularSemPersistir(usuarioId: number, mes?: number, ano?: number): Promise<BancoHorasDTO> {
    const [mesResolvido, anoResolvido] = this.resolverPeriodo(mes, ano);
    const { horasTrabalhadas, horasPrevistas, saldo } = await this.computar(
      usuarioId,
      anoResolvido,
      mesResolvido,
    );
    const existente = await this.bancoHoras.buscar(usuarioId, mesResolvido, anoResolvido);

    return {
      id: existente?.id ?? 0,
      usuarioId,
      mes: mesResolvido,
      ano: anoResolvido,
      horasTrabalhadas,
      horasPrevistas,
      saldo,
    };
  }

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
        await this.montarLinhaEquipe(montador.id, montador.nome, ano, mes, pendentes.get(montador.id) ?? 0),
      );
    }
    return linhas;
  }

  async doMontador(usuarioId: number, ano: number, mes: number): Promise<SaldoMontadorDTO> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    const pendentes = await this.pontos.contarPendentesPorUsuario([usuarioId]);
    return this.montarLinhaEquipe(usuarioId, usuario?.nome ?? '', ano, mes, pendentes.get(usuarioId) ?? 0);
  }

  /** Recalculado a cada consulta (issue #24): sempre substitui o valor gravado antes. */
  private async montarLinhaEquipe(
    usuarioId: number,
    usuarioNome: string,
    ano: number,
    mes: number,
    compensacoesPendentes: number,
  ): Promise<SaldoMontadorDTO> {
    const { horasAbonadas, ...saldo } = await this.computar(usuarioId, ano, mes);
    const snapshot = await this.bancoHoras.salvar({ usuarioId, ano, mes, ...saldo });

    return { ...snapshot, usuarioNome, horasAbonadas, compensacoesPendentes };
  }

  /**
   * Fonte da verdade do mês: jornadas finalizadas + dias abonados por
   * atestado validado. Único ponto de cálculo do banco de horas — usado
   * tanto pela consulta do próprio montador quanto pelo painel do RH, para
   * que a aprovação de um atestado (ou de uma compensação) apareça no saldo
   * sem gatilho nenhum, e não haja dois números diferentes para o mesmo
   * usuário/mês dependendo de quem pergunta.
   */
  private async computar(usuarioId: number, ano: number, mes: number): Promise<SaldoCalculado> {
    const { inicio, fim } = periodoDoMes(ano, mes);
    const inicioIso = comporInstante(inicio, '00:00', FUSO_OPERACAO);
    const fimIso = new Date(
      new Date(comporInstante(somarDias(fim, 1), '00:00', FUSO_OPERACAO)).getTime() - 1,
    ).toISOString();

    const jornadasDoMes = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);
    const minutosTrabalhados = agruparJornadasPorDia(jornadasDoMes, FUSO_OPERACAO).reduce(
      (soma, dia) => soma + dia.minutosTrabalhados,
      0,
    );

    const validados = await this.atestados.listarValidadosNoPeriodo(usuarioId, inicio, fim);
    const minutosAbonados = diasAbonados(validados, ano, mes).size * MINUTOS_JORNADA_PADRAO;
    const minutosPrevistos = diasUteisNoMes(ano, mes).length * MINUTOS_JORNADA_PADRAO;

    return {
      horasTrabalhadas: paraHoras(minutosTrabalhados),
      horasPrevistas: paraHoras(minutosPrevistos),
      horasAbonadas: paraHoras(minutosAbonados),
      saldo: paraHoras(minutosTrabalhados + minutosAbonados - minutosPrevistos),
    };
  }

  private resolverPeriodo(mes: number | undefined, ano: number | undefined): [number, number] {
    if (mes !== undefined && ano !== undefined) return [mes, ano];

    const hoje = diaNoFuso(new Date().toISOString(), FUSO_OPERACAO);
    const [anoAtual, mesAtual] = hoje.split('-').map(Number);
    return [mes ?? mesAtual, ano ?? anoAtual];
  }
}
