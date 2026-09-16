import { Injectable } from '@nestjs/common';
import {
  MINUTOS_JORNADA_PADRAO,
  agruparJornadasPorDia,
  comporInstante,
  diasAbonados,
  diasUteisNoMes,
  minutosDaJornada,
  periodoDoMes,
  somarDias,
} from '@montacontrol/shared';
import type { DiaEspelhoDTO, DiaJornadaDTO, EspelhoPontoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { MontadorNaoEncontradoException } from './exceptions/montador-nao-encontrado.exception';

@Injectable()
export class EspelhoPontoService {
  constructor(
    private readonly jornadas: JornadasRepository,
    private readonly atestados: AtestadosRepository,
    private readonly usuarios: UsuariosRepository,
  ) {}

  /**
   * O espelho é um documento de conferência: todos os dias do mês aparecem,
   * mesmo os sem marcação. Dia vazio é informação — é o buraco que o RH
   * precisa enxergar para cobrar o lançamento em atraso.
   *
   * `incluirInativo` é opt-in: por padrão, um montador desligado
   * (`ativo: false`, soft delete) não aparece — só quando o RH pede
   * explicitamente para ver um "excluído".
   */
  async montar(
    usuarioId: number,
    ano: number,
    mes: number,
    incluirInativo = false,
  ): Promise<EspelhoPontoDTO> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario || usuario.perfil !== Perfil.MONTADOR || (!usuario.ativo && !incluirInativo)) {
      throw new MontadorNaoEncontradoException();
    }

    const { inicio, fim } = periodoDoMes(ano, mes);
    const inicioIso = comporInstante(inicio, '00:00', FUSO_OPERACAO);
    const fimIso = new Date(
      new Date(comporInstante(somarDias(fim, 1), '00:00', FUSO_OPERACAO)).getTime() - 1,
    ).toISOString();

    const jornadasDoMes = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);
    const porDia = new Map<string, DiaJornadaDTO>(
      agruparJornadasPorDia(jornadasDoMes, FUSO_OPERACAO).map((dia) => [dia.data, dia]),
    );
    const justificativas = await this.jornadas.mapaJustificativasLancadasNoPeriodo(
      usuarioId,
      inicioIso,
      fimIso,
    );

    const validados = await this.atestados.listarValidadosNoPeriodo(usuarioId, inicio, fim);
    const abonados = diasAbonados(validados, ano, mes);
    const uteis = new Set(diasUteisNoMes(ano, mes));

    const dias: DiaEspelhoDTO[] = [];
    const ultimoDia = Number(fim.slice(8, 10));
    for (let numero = 1; numero <= ultimoDia; numero += 1) {
      const data = `${fim.slice(0, 8)}${String(numero).padStart(2, '0')}`;
      const doDia = porDia.get(data);
      const jornadaEmAtraso = doDia?.jornadas.find((jornada) => jornada.lancadoEmAtraso);

      dias.push({
        data,
        inicio: doDia?.inicio ?? null,
        fim: doDia?.fim ?? null,
        minutosTrabalhados: doDia?.minutosTrabalhados ?? 0,
        emAndamento: doDia?.emAndamento ?? false,
        lancadoEmAtraso: jornadaEmAtraso !== undefined,
        justificativaLancamento: jornadaEmAtraso ? justificativas.get(jornadaEmAtraso.id) ?? null : null,
        abonado: abonados.has(data),
        diaUtil: uteis.has(data),
        turnos: (doDia?.jornadas ?? [])
          .slice()
          .sort((a, b) => (a.checkinAt ?? '').localeCompare(b.checkinAt ?? ''))
          .map((jornada) => ({
            inicio: jornada.checkinAt,
            fim: jornada.checkoutAt,
            minutosTrabalhados: minutosDaJornada(jornada),
            lancadoEmAtraso: jornada.lancadoEmAtraso,
          })),
      });
    }

    const minutosTrabalhados = dias.reduce((soma, dia) => soma + dia.minutosTrabalhados, 0);
    const minutosAbonados = abonados.size * MINUTOS_JORNADA_PADRAO;
    const minutosPrevistos = uteis.size * MINUTOS_JORNADA_PADRAO;

    return {
      usuarioId,
      usuarioNome: usuario.nome,
      ano,
      mes,
      dias,
      minutosTrabalhados,
      minutosPrevistos,
      minutosAbonados,
      saldoMinutos: minutosTrabalhados + minutosAbonados - minutosPrevistos,
    };
  }
}
