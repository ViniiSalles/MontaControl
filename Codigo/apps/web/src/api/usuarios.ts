import type { CadastrarUsuarioRequest, InformarCpfRequest, UsuarioDTO } from '@montacontrol/shared'
import { requisitar } from './clienteHttp'

export function listarUsuarios(token: string): Promise<UsuarioDTO[]> {
  return requisitar<UsuarioDTO[]>('/api/usuarios', { token })
}

export function cadastrarUsuario(
  token: string,
  dados: CadastrarUsuarioRequest,
): Promise<UsuarioDTO> {
  return requisitar<UsuarioDTO>('/api/usuarios', { token, metodo: 'POST', corpo: dados })
}

export function alterarAtivoUsuario(
  token: string,
  id: number,
  ativo: boolean,
): Promise<UsuarioDTO> {
  return requisitar<UsuarioDTO>(`/api/usuarios/${id}/ativo`, {
    token,
    metodo: 'PATCH',
    corpo: { ativo },
  })
}

export function informarCpfUsuario(token: string, id: number, cpf: string): Promise<UsuarioDTO> {
  return requisitar<UsuarioDTO>(`/api/usuarios/${id}/cpf`, { token, metodo: 'PATCH', corpo: { cpf } satisfies InformarCpfRequest })
}
