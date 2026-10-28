import { Injectable } from '@nestjs/common';
import { statusAluguelEpi } from '@montacontrol/shared';
import type { AluguelEpiDTO, RegistrarAluguelEpiRequest, RegistrarDevolucaoEpiRequest } from '@montacontrol/shared';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { AluguelEpi, AlugueisEpiRepository } from './alugueis-epi.repository';
import { picoDeUso } from './disponibilidade';
import { AluguelEpiJaDevolvidoException } from './exceptions/aluguel-epi-ja-devolvido.exception';
import { AluguelEpiNaoCancelavelException } from './exceptions/aluguel-epi-nao-cancelavel.exception';
import { AluguelEpiNaoEncontradoException } from './exceptions/aluguel-epi-nao-encontrado.exception';
import { ColaboradorInvalidoException } from './exceptions/colaborador-invalido.exception';
import { DevolucaoInvalidaException } from './exceptions/devolucao-invalida.exception';
import { EpiIndisponivelException } from './exceptions/epi-indisponivel.exception';
import { PeriodoAluguelInvalidoException } from './exceptions/periodo-aluguel-invalido.exception';
import { TipoEpiNaoEncontradoException } from './exceptions/tipo-epi-nao-encontrado.exception';

/** Folga para o relógio do navegador do gestor um pouco adiantado em relação ao servidor. */
const TOLERANCIA_RELOGIO_MS = 60 * 1000;

function paraAluguelDTO(aluguel: AluguelEpi, agora: Date): AluguelEpiDTO {
  return {
    id: aluguel.id,
    tipoEpi: aluguel.tipoEpi,
    colaborador: aluguel.usuario,
    quantidade: aluguel.quantidade,
    inicio: aluguel.inicio.toISOString(),
    fimPrevisto: aluguel.fimPrevisto.toISOString(),
    devolvidoEm: aluguel.devolvidoEm?.toISOString() ?? null,
    observacao: aluguel.observacao,
    registradoPor: aluguel.registrador,
    devolucaoRegistradaPor: aluguel.registradorDevolucao,
    status: statusAluguelEpi(aluguel, agora),
  };
}

/**
 * Aluguel de EPIs do almoxarifado pelo gestor: registra o período reservado
 * (início e devolução prevista) e, depois, a devolução real. A reserva só
 * entra se, em nenhum instante do período, faltar unidade no estoque.
 */
@Injectable()
export class AlugueisEpiService {
  constructor(
    private readonly alugueis: AlugueisEpiRepository,
    private readonly usuarios: UsuariosRepository,
  ) {}

  async listar(): Promise<AluguelEpiDTO[]> {
    const agora = new Date();
    return (await this.alugueis.listar()).map((aluguel) => paraAluguelDTO(aluguel, agora));
  }

  async registrar(dados: RegistrarAluguelEpiRequest, gestorId: number): Promise<AluguelEpiDTO> {
    const inicio = new Date(dados.inicio);
    const fimPrevisto = new Date(dados.fimPrevisto);
    if (fimPrevisto <= inicio) throw new PeriodoAluguelInvalidoException();

    const colaborador = await this.usuarios.buscarPorId(dados.usuarioId);
    if (!colaborador?.ativo) throw new ColaboradorInvalidoException();

    const agora = new Date();
    const resultado = await this.alugueis.criarSeCouber(
      {
        tipoEpiId: dados.tipoEpiId,
        usuarioId: dados.usuarioId,
        quantidade: dados.quantidade,
        inicio,
        fimPrevisto,
        observacao: dados.observacao?.trim() || null,
        registradoPor: gestorId,
      },
      (ocupacoes, estoque) => picoDeUso(ocupacoes, inicio, fimPrevisto, agora) + dados.quantidade <= estoque,
    );
    if (resultado === 'TIPO_NAO_ENCONTRADO') throw new TipoEpiNaoEncontradoException();
    if (resultado === 'SEM_ESTOQUE') throw new EpiIndisponivelException();
    return paraAluguelDTO(resultado, agora);
  }

  async registrarDevolucao(id: number, dados: RegistrarDevolucaoEpiRequest, gestorId: number): Promise<AluguelEpiDTO> {
    const aluguel = await this.alugueis.buscarPorId(id);
    if (!aluguel) throw new AluguelEpiNaoEncontradoException();
    if (aluguel.devolvidoEm) throw new AluguelEpiJaDevolvidoException();

    const agora = new Date();
    const devolvidoEm = dados.devolvidoEm ? new Date(dados.devolvidoEm) : agora;
    if (devolvidoEm < aluguel.inicio || devolvidoEm.getTime() > agora.getTime() + TOLERANCIA_RELOGIO_MS) {
      throw new DevolucaoInvalidaException();
    }

    const devolvido = await this.alugueis.registrarDevolucao(id, devolvidoEm, gestorId);
    // Outra requisição devolveu entre a leitura e a escrita.
    if (!devolvido) throw new AluguelEpiJaDevolvidoException();
    return paraAluguelDTO(devolvido, agora);
  }

  async cancelar(id: number): Promise<void> {
    const aluguel = await this.alugueis.buscarPorId(id);
    if (!aluguel) throw new AluguelEpiNaoEncontradoException();
    if (!(await this.alugueis.removerSeReservado(id, new Date()))) throw new AluguelEpiNaoCancelavelException();
  }
}
