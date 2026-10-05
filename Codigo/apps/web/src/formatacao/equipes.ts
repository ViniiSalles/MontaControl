import { Perfil } from '@montacontrol/shared'
import type { EquipeDTO, MontadorResumoDTO, UsuarioDTO } from '@montacontrol/shared'

/** Só montador ativo pode ir para obra ou equipe — mesma regra da API. */
export function montadoresDisponiveis(usuarios: UsuarioDTO[]): MontadorResumoDTO[] {
  return usuarios
    .filter((usuario) => usuario.perfil === Perfil.MONTADOR && usuario.ativo)
    .map(({ id, nome, ativo }) => ({ id, nome, ativo }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * Aplicar equipe soma os membros ativos dela ao que já está marcado — não
 * apaga ninguém que o gestor tenha escolhido avulso.
 */
export function aplicarEquipe(selecionados: number[], equipe: EquipeDTO): number[] {
  const ativos = equipe.membros.filter((membro) => membro.ativo).map((membro) => membro.id)
  return [...new Set([...selecionados, ...ativos])]
}

export function alternarSelecao(selecionados: number[], id: number): number[] {
  return selecionados.includes(id) ? selecionados.filter((atual) => atual !== id) : [...selecionados, id]
}

/** Busca por nome, sem diferenciar acento nem caixa. */
export function filtrarPorNome<T extends { nome: string }>(itens: T[], busca: string): T[] {
  const normalizar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const termo = normalizar(busca.trim())
  return termo ? itens.filter((item) => normalizar(item.nome).includes(termo)) : itens
}

export function textoQuantidadeMontadores(quantidade: number): string {
  if (quantidade === 0) return 'Nenhum montador'
  return `${quantidade} ${quantidade === 1 ? 'montador' : 'montadores'}`
}
