import { Injectable } from '@nestjs/common';
import type { SalvarTipoEpiRequest, TipoEpiDTO } from '@montacontrol/shared';
import { AlugueisEpiRepository } from './alugueis-epi.repository';
import { unidadesEmUso } from './disponibilidade';
import { EstoqueAbaixoDoEmUsoException } from './exceptions/estoque-abaixo-do-em-uso.exception';
import { NomeTipoEpiDuplicadoException } from './exceptions/nome-tipo-epi-duplicado.exception';
import { TipoEpiNaoEncontradoException } from './exceptions/tipo-epi-nao-encontrado.exception';
import { DadosTipoEpi, FalhaTipoEpi, TipoEpi, TiposEpiRepository } from './tipos-epi.repository';

function garantirTipo(resultado: TipoEpi | FalhaTipoEpi): TipoEpi {
  if (resultado === 'NOME_DUPLICADO') throw new NomeTipoEpiDuplicadoException();
  if (resultado === 'NAO_ENCONTRADO') throw new TipoEpiNaoEncontradoException();
  return resultado;
}

function normalizar(dados: SalvarTipoEpiRequest): DadosTipoEpi {
  return {
    nome: dados.nome.trim(),
    descricao: dados.descricao.trim(),
    validadeMeses: dados.validadeMeses,
    estoque: dados.estoque,
  };
}

/** Catálogo de EPIs do almoxarifado, com o estoque disponível para aluguel. */
@Injectable()
export class TiposEpiService {
  constructor(
    private readonly tipos: TiposEpiRepository,
    private readonly alugueis: AlugueisEpiRepository,
  ) {}

  async listar(): Promise<TipoEpiDTO[]> {
    const [tipos, emAberto] = await Promise.all([this.tipos.listar(), this.alugueis.listarEmAberto()]);
    const agora = new Date();
    return tipos.map((tipo) => ({
      ...tipo,
      emUso: unidadesEmUso(
        emAberto.filter((ocupacao) => ocupacao.tipoEpiId === tipo.id),
        agora,
      ),
    }));
  }

  async criar(dados: SalvarTipoEpiRequest): Promise<TipoEpiDTO> {
    return { ...garantirTipo(await this.tipos.criar(normalizar(dados))), emUso: 0 };
  }

  async atualizar(id: number, dados: SalvarTipoEpiRequest): Promise<TipoEpiDTO> {
    const emUso = await this.emUsoDoTipo(id);
    if (dados.estoque < emUso) throw new EstoqueAbaixoDoEmUsoException();
    return { ...garantirTipo(await this.tipos.atualizar(id, normalizar(dados))), emUso };
  }

  private async emUsoDoTipo(id: number): Promise<number> {
    const emAberto = await this.alugueis.listarEmAberto();
    return unidadesEmUso(
      emAberto.filter((ocupacao) => ocupacao.tipoEpiId === id),
      new Date(),
    );
  }
}
