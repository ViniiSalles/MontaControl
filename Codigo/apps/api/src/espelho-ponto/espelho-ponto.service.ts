import { Injectable } from '@nestjs/common';
import { agruparJornadasPorDia, limitesDoMes } from '@montacontrol/shared';
import type { EspelhoPontoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { FUSO_OPERACAO } from '../common/fuso';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { MontadorNaoEncontradoException } from './exceptions/montador-nao-encontrado.exception';

@Injectable()
export class EspelhoPontoService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly jornadas: JornadasRepository,
    private readonly bancoHoras: BancoHorasService,
  ) {}

  /**
   * `incluirInativo` é opt-in: por padrão, um montador desligado
   * (`ativo: false`, soft delete) não aparece — só quando o RH pede
   * explicitamente para ver um "excluído".
   */
  async gerar(
    usuarioId: number,
    mes: number,
    ano: number,
    incluirInativo = false,
  ): Promise<EspelhoPontoDTO> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario || usuario.perfil !== Perfil.MONTADOR || (!usuario.ativo && !incluirInativo)) {
      throw new MontadorNaoEncontradoException();
    }

    const { inicioIso, fimIso } = limitesDoMes(mes, ano, FUSO_OPERACAO);
    const jornadasDoMes = await this.jornadas.listarNoPeriodo(usuarioId, inicioIso, fimIso);
    const dias = agruparJornadasPorDia(jornadasDoMes, FUSO_OPERACAO);
    const bancoHoras = await this.bancoHoras.calcularSemPersistir(usuarioId, mes, ano);

    return {
      usuarioId,
      usuarioNome: usuario.nome,
      mes,
      ano,
      dias,
      bancoHoras,
    };
  }
}
