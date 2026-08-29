import { Perfil } from '@montacontrol/shared';
import type { LoginResponse, UsuarioDTO } from '@montacontrol/shared';

export const montador: UsuarioDTO = {
  id: 1,
  nome: 'Vinicius Salles',
  email: 'montador@montacontrol.com.br',
  perfil: Perfil.MONTADOR,
  ativo: true,
};

export const gestor: UsuarioDTO = { ...montador, id: 2, email: 'gestor@montacontrol.com.br', perfil: Perfil.GESTOR };

export function sessaoDe(usuario: UsuarioDTO, sufixo = ''): LoginResponse {
  return {
    accessToken: `access${sufixo}`,
    refreshToken: `refresh${sufixo}`,
    expiresIn: 3600,
    usuario,
  };
}

/** Resposta `fetch` mínima — só o que `clienteAuth` realmente lê. */
export function respostaJson(status: number, corpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response;
}
