import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Perfil } from '../../generated/prisma';
import { TokenInvalidoException } from '../common/exceptions/token-invalido.exception';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { VerificadorTokenService } from './verificador-token.service';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

const jwtVerifyMock = jwtVerify as jest.Mock;
const ISSUER = 'https://exemplo.supabase.co/auth/v1';

const USUARIO_ATIVO = {
  id: 1,
  nome: 'Maria Montadora',
  email: 'maria@montacontrol.local',
  perfil: Perfil.MONTADOR,
  ativo: true,
  authUserId: '11111111-1111-1111-1111-111111111111',
};

describe('VerificadorTokenService', () => {
  let verificador: VerificadorTokenService;
  let usuarios: { buscarPorAuthUserId: jest.Mock };

  beforeEach(() => {
    jwtVerifyMock.mockReset();
    usuarios = { buscarPorAuthUserId: jest.fn() };
    const config = { getOrThrow: jest.fn().mockReturnValue(ISSUER) } as unknown as ConfigService;
    verificador = new VerificadorTokenService(config, usuarios as unknown as UsuariosRepository);
  });

  it('busca as chaves no JWKS do issuer configurado', () => {
    expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL(`${ISSUER}/.well-known/jwks.json`));
  });

  it('devolve o usuário quando o token é válido e o usuário está ativo', async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: USUARIO_ATIVO.authUserId } });
    usuarios.buscarPorAuthUserId.mockResolvedValue(USUARIO_ATIVO);

    await expect(verificador.verificar('token-valido')).resolves.toEqual(USUARIO_ATIVO);
    expect(jwtVerifyMock).toHaveBeenCalledWith('token-valido', expect.any(Function), {
      issuer: ISSUER,
      audience: 'authenticated',
      algorithms: ['ES256'],
    });
    expect(usuarios.buscarPorAuthUserId).toHaveBeenCalledWith(USUARIO_ATIVO.authUserId);
  });

  it('verificador rejeita token inválido', async () => {
    const erro = new Error('Invalid Compact JWS');
    Object.assign(erro, { code: 'ERR_JWS_INVALID' });
    jwtVerifyMock.mockRejectedValue(erro);

    const promessa = verificador.verificar('nao-e-um-jwt');

    await expect(promessa).rejects.toBeInstanceOf(TokenInvalidoException);
    await expect(promessa).rejects.toThrow('Token inválido ou expirado');
    expect(usuarios.buscarPorAuthUserId).not.toHaveBeenCalled();
  });

  it('rejeita token expirado', async () => {
    const erro = new Error('"exp" claim timestamp check failed');
    Object.assign(erro, { code: 'ERR_JWT_EXPIRED' });
    jwtVerifyMock.mockRejectedValue(erro);

    await expect(verificador.verificar('token-expirado')).rejects.toBeInstanceOf(
      TokenInvalidoException,
    );
  });

  it('rejeita token sem "sub"', async () => {
    jwtVerifyMock.mockResolvedValue({ payload: {} });

    await expect(verificador.verificar('token-sem-sub')).rejects.toBeInstanceOf(
      TokenInvalidoException,
    );
    expect(usuarios.buscarPorAuthUserId).not.toHaveBeenCalled();
  });

  it('rejeita usuário inativo ou inexistente', async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: USUARIO_ATIVO.authUserId } });

    usuarios.buscarPorAuthUserId.mockResolvedValueOnce({ ...USUARIO_ATIVO, ativo: false });
    const inativo = verificador.verificar('token-usuario-inativo');
    await expect(inativo).rejects.toBeInstanceOf(TokenInvalidoException);
    await expect(inativo).rejects.toThrow('Usuário inválido ou inativo');

    usuarios.buscarPorAuthUserId.mockResolvedValueOnce(null);
    const inexistente = verificador.verificar('token-orfao');
    await expect(inexistente).rejects.toBeInstanceOf(TokenInvalidoException);
    await expect(inexistente).rejects.toThrow('Usuário inválido ou inativo');
  });
});
