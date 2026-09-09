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
import type { DiaEspelhoDTO, DiaJornadaDTO, EspelhoPontoDTO } from '@montacontrol/shared';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { FUSO_OPERACAO } from '../common/fuso';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { UsuarioNaoEncontradoException } from '../usuarios/exceptions/usuario-nao-encontrado.exception';
import { UsuariosRepository } from '../usuarios/usuarios.repository';

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
   */
  async montar(usuarioId: number, ano: number, mes: number): Promise<EspelhoPontoDTO> {
    const usuario = (await this.usuarios.listar()).find((item) => item.id === usuarioId);
    if (!usuario) throw new UsuarioNaoEncontradoException();

    const { inicio, fim } = periodoDoMes(ano, mes);
    const inicioIso = comporInstante(inicio, '00:00', FUSO_OPERACAO);
    const fimIso = new Date(
      new Date(comporInstante(somarDias(fim, 1), '00:00', FUSO_OPERACAO)).getTime() - 1,
    ).toISOString();

    const jornadas = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);
    const porDia = new Map<string, DiaJornadaDTO>(
      agruparJornadasPorDia(jornadas, FUSO_OPERACAO).map((dia) => [dia.data, dia]),
    );

    const validados = await this.atestados.listarValidadosNoPeriodo(usuarioId, inicio, fim);
    const abonados = diasAbonados(validados, ano, mes);
    const uteis = new Set(diasUteisNoMes(ano, mes));

    const dias: DiaEspelhoDTO[] = [];
    const ultimoDia = Number(fim.slice(8, 10));
    for (let numero = 1; numero <= ultimoDia; numero += 1) {
      const data = `${fim.slice(0, 8)}${String(numero).padStart(2, '0')}`;
      const doDia = porDia.get(data);

      dias.push({
        data,
        inicio: doDia?.inicio ?? null,
        fim: doDia?.fim ?? null,
        minutosTrabalhados: doDia?.minutosTrabalhados ?? 0,
        emAndamento: doDia?.emAndamento ?? false,
        lancadoEmAtraso: doDia?.jornadas.some((jornada) => jornada.lancadoEmAtraso) ?? false,
        abonado: abonados.has(data),
        diaUtil: uteis.has(data),
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
