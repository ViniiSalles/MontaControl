import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';
import { Perfil } from '../../../generated/prisma';
import { UsuariosRepository } from '../../usuarios/usuarios.repository';
import { SupabaseJwtGuard } from './supabase-jwt.guard';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

const jwtVerifyMock = jwtVerify as jest.Mock;

function criarContexto(headers: Record<string, string>, ehPublica = false): {
  context: ExecutionContext;
  request: { headers: Record<string, string>; user?: unknown };
} {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
  jest.spyOn(Reflector.prototype, 'getAllAndOverride').mockReturnValue(ehPublica);
  return { context, request };
}

describe('SupabaseJwtGuard', () => {
  let guard: SupabaseJwtGuard;
  let usuarios: { buscarPorAuthUserId: jest.Mock };
  let config: ConfigService;

  beforeEach(() => {
    jwtVerifyMock.mockReset();
    usuarios = { buscarPorAuthUserId: jest.fn() };
    config = {
      getOrThrow: jest.fn().mockReturnValue('https://jtwuwsdmrncaqirqrjrt.supabase.co/auth/v1'),
    } as unknown as ConfigService;
    guard = new SupabaseJwtGuard(new Reflector(), config, usuarios as unknown as UsuariosRepository);
  });

  it('permite acesso sem verificar token em rota marcada @Public()', async () => {
    const { context } = criarContexto({}, true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });

  it('rejeita (401) quando não há cabeçalho Authorization', async () => {
    const { context } = criarContexto({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('autentica e anexa o usuário à requisição quando o token é válido e o usuário está ativo', async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: { sub: '11111111-1111-1111-1111-111111111111' },
    });
    usuarios.buscarPorAuthUserId.mockResolvedValue({
      id: 1,
      nome: 'Maria Montadora',
      email: 'maria@montacontrol.local',
      perfil: Perfil.MONTADOR,
      ativo: true,
      authUserId: '11111111-1111-1111-1111-111111111111',
    });
    const { context, request } = criarContexto({ authorization: 'Bearer token-valido' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ perfil: Perfil.MONTADOR, ativo: true });
  });

  it('rejeita (401) quando o token está expirado', async () => {
    const erroExpirado = new Error('"exp" claim timestamp check failed');
    Object.assign(erroExpirado, { code: 'ERR_JWT_EXPIRED' });
    jwtVerifyMock.mockRejectedValue(erroExpirado);
    const { context } = criarContexto({ authorization: 'Bearer token-expirado' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita (401) quando o token é malformado', async () => {
    const erroMalformado = new Error('Invalid Compact JWS');
    Object.assign(erroMalformado, { code: 'ERR_JWS_INVALID' });
    jwtVerifyMock.mockRejectedValue(erroMalformado);
    const { context } = criarContexto({ authorization: 'Bearer nao-e-um-jwt' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita (401) quando o "kid" do token é desconhecido no JWKS', async () => {
    const erroKidDesconhecido = new Error('no applicable key found in the JSON Web Key Set');
    Object.assign(erroKidDesconhecido, { code: 'ERR_JWKS_NO_MATCHING_KEY' });
    jwtVerifyMock.mockRejectedValue(erroKidDesconhecido);
    const { context } = criarContexto({ authorization: 'Bearer token-kid-desconhecido' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita (401) quando o usuário do token está inativo', async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: { sub: '22222222-2222-2222-2222-222222222222' },
    });
    usuarios.buscarPorAuthUserId.mockResolvedValue({
      id: 2,
      nome: 'Ex-Montador',
      email: 'ex@montacontrol.local',
      perfil: Perfil.MONTADOR,
      ativo: false,
      authUserId: '22222222-2222-2222-2222-222222222222',
    });
    const { context } = criarContexto({ authorization: 'Bearer token-usuario-inativo' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita (401) quando o token é válido mas não há usuário correspondente', async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: { sub: '33333333-3333-3333-3333-333333333333' },
    });
    usuarios.buscarPorAuthUserId.mockResolvedValue(null);
    const { context } = criarContexto({ authorization: 'Bearer token-orfao' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
