import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil } from '../../../generated/prisma';
import { UsuarioAutenticado } from '../usuario-autenticado';
import { RolesGuard } from './roles.guard';

function criarContexto(user: UsuarioAutenticado | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function criarUsuario(perfil: Perfil): UsuarioAutenticado {
  return {
    id: 1,
    nome: 'Usuário Teste',
    email: 'usuario@montacontrol.local',
    perfil,
    ativo: true,
    authUserId: '11111111-1111-1111-1111-111111111111',
  };
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('permite acesso quando a rota não declara @Roles()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(criarContexto(criarUsuario(Perfil.MONTADOR)))).toBe(true);
  });

  it('permite acesso quando o perfil do usuário está entre os permitidos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Perfil.GESTOR, Perfil.RH]);

    expect(guard.canActivate(criarContexto(criarUsuario(Perfil.GESTOR)))).toBe(true);
  });

  it('nega acesso (403) quando o perfil do usuário não está entre os permitidos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Perfil.GESTOR, Perfil.RH]);

    expect(() => guard.canActivate(criarContexto(criarUsuario(Perfil.MONTADOR)))).toThrow(
      'Acesso negado para o perfil atual',
    );
  });

  it('nega acesso quando não há usuário autenticado na requisição', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Perfil.GESTOR]);

    expect(() => guard.canActivate(criarContexto(undefined))).toThrow();
  });
});
