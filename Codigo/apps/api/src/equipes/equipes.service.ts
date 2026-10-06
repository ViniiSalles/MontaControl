import { Injectable } from '@nestjs/common';
import type { EquipeDTO, SalvarEquipeRequest } from '@montacontrol/shared';
import { MontadoresInvalidosException } from '../usuarios/exceptions/montadores-invalidos.exception';
import { FotosUsuarios } from '../usuarios/fotos-usuarios';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { EquipeComMembros, EquipesRepository, FalhaEquipe } from './equipes.repository';
import { EquipeNaoEncontradaException } from './exceptions/equipe-nao-encontrada.exception';
import { NomeEquipeDuplicadoException } from './exceptions/nome-equipe-duplicado.exception';

function garantirEquipe(resultado: EquipeComMembros | FalhaEquipe): EquipeComMembros {
  if (resultado === 'NOME_DUPLICADO') throw new NomeEquipeDuplicadoException();
  if (resultado === 'NAO_ENCONTRADA') throw new EquipeNaoEncontradaException();
  return resultado;
}

function paraEquipeDTO(equipe: EquipeComMembros, urlPorId: Map<number, string | null>): EquipeDTO {
  return {
    id: equipe.id,
    nome: equipe.nome,
    membros: equipe.membros.map((membro) => ({
      id: membro.id,
      nome: membro.nome,
      ativo: membro.ativo,
      email: membro.email,
      telefone: membro.telefone,
      fotoUrl: urlPorId.get(membro.id) ?? null,
    })),
  };
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
    private readonly fotos: FotosUsuarios,
  ) {}

  async listar(): Promise<EquipeDTO[]> {
    const equipes = await this.equipes.listar();
    // Uma assinatura em lote para todos os membros de todas as equipes.
    const membros = await this.fotos.comUrls(equipes.flatMap((equipe) => equipe.membros));
    const urlPorId = new Map(membros.map((membro) => [membro.id, membro.fotoUrl]));
    return equipes.map((equipe) => paraEquipeDTO(equipe, urlPorId));
  }

  async criar(dados: SalvarEquipeRequest): Promise<EquipeDTO> {
    const { nome, membrosIds } = await this.validar(dados);
    return this.comFotos(garantirEquipe(await this.equipes.criar(nome, membrosIds)));
  }

  async atualizar(id: number, dados: SalvarEquipeRequest): Promise<EquipeDTO> {
    const { nome, membrosIds } = await this.validar(dados);
    return this.comFotos(garantirEquipe(await this.equipes.atualizar(id, nome, membrosIds)));
  }

  async remover(id: number): Promise<void> {
    if (!(await this.equipes.remover(id))) throw new EquipeNaoEncontradaException();
  }

  private async comFotos(equipe: EquipeComMembros): Promise<EquipeDTO> {
    const membros = await this.fotos.comUrls(equipe.membros);
    return paraEquipeDTO(equipe, new Map(membros.map((membro) => [membro.id, membro.fotoUrl])));
  }

  private async validar(dados: SalvarEquipeRequest): Promise<SalvarEquipeRequest> {
    const membrosIds = [...new Set(dados.membrosIds)];
    const validos = await this.usuarios.filtrarMontadoresAtivos(membrosIds);
    if (validos.length !== membrosIds.length) throw new MontadoresInvalidosException();
    return { nome: dados.nome.trim(), membrosIds };
  }
}
