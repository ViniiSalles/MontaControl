import { ExecutionContext } from '@nestjs/common';
import { Perfil } from '../../../generated/prisma';
import { extrairUsuarioAtual } from './current-user.decorator';
import { UsuarioAutenticado } from '../usuario-autenticado';

describe('extrairUsuarioAtual', () => {
  it('retorna o usuário anexado à requisição pelo SupabaseJwtGuard', () => {
    const usuario: UsuarioAutenticado = {
      id: 1,
      nome: 'Usuário Teste',
      email: 'usuario@teste.montacontrol.local',
      perfil: Perfil.GESTOR,
      ativo: true,
      authUserId: 'auth-user-id',
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: usuario }),
      }),
    } as unknown as ExecutionContext;

    expect(extrairUsuarioAtual(undefined, ctx)).toBe(usuario);
  });
});
