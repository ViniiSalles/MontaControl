import { Injectable } from '@nestjs/common';
import type { EquipeDTO, SalvarEquipeRequest } from '@montacontrol/shared';
import { MontadoresInvalidosException } from '../usuarios/exceptions/montadores-invalidos.exception';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { EquipesRepository, FalhaEquipe } from './equipes.repository';
import { EquipeNaoEncontradaException } from './exceptions/equipe-nao-encontrada.exception';
import { NomeEquipeDuplicadoException } from './exceptions/nome-equipe-duplicado.exception';

function garantirEquipe(resultado: EquipeDTO | FalhaEquipe): EquipeDTO {
  if (resultado === 'NOME_DUPLICADO') throw new NomeEquipeDuplicadoException();
  if (resultado === 'NAO_ENCONTRADA') throw new EquipeNaoEncontradaException();
  return resultado;
}

/**
 * Equipe é um atalho do gestor para atribuir várias pessoas à obra de uma
 * vez. Só montador ativo entra; equipe vazia é permitida (montada aos poucos).
 */
@Injectable()
export class EquipesService {
  constructor(
    private readonly equipes: EquipesRepository,
    private readonly usuarios: UsuariosRepository,
  ) {}

  async listar(): Promise<EquipeDTO[]> {
    return this.equipes.listar();
  }

  async criar(dados: SalvarEquipeRequest): Promise<EquipeDTO> {
    const { nome, membrosIds } = await this.validar(dados);
    return garantirEquipe(await this.equipes.criar(nome, membrosIds));
  }

  async atualizar(id: number, dados: SalvarEquipeRequest): Promise<EquipeDTO> {
    const { nome, membrosIds } = await this.validar(dados);
    return garantirEquipe(await this.equipes.atualizar(id, nome, membrosIds));
  }

  async remover(id: number): Promise<void> {
    if (!(await this.equipes.remover(id))) throw new EquipeNaoEncontradaException();
  }

  private async validar(dados: SalvarEquipeRequest): Promise<SalvarEquipeRequest> {
    const membrosIds = [...new Set(dados.membrosIds)];
    const validos = await this.usuarios.filtrarMontadoresAtivos(membrosIds);
    if (validos.length !== membrosIds.length) throw new MontadoresInvalidosException();
    return { nome: dados.nome.trim(), membrosIds };
  }
}
