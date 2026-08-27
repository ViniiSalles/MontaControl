import { INestApplication } from '@nestjs/common';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarApp } from './setup/criar-app';
import { apagarUsuarioFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

/**
 * TI02: qualquer variação de token inválido numa rota autenticada
 * (`SupabaseJwtGuard`) devolve sempre o mesmo `codigo` `TOKEN_EXPIRADO` —
 * malformado, assinado por chave/`kid` desconhecido do JWKS, ou usuário
 * desativado depois de emitido um access token ainda tecnicamente válido.
 * A mensagem varia por etapa (ver `SupabaseJwtGuard.canActivate`).
 */
describe('GET /api/auth/me — token inválido (e2e, TI02)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    for (const fixture of fixturesCriadas.reverse()) {
      await apagarUsuarioFixture(app, fixture);
    }
    await app.close();
  });

  it('token ausente → 401', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(resposta.body).toEqual({ codigo: 'TOKEN_EXPIRADO', message: 'Token ausente' });
  });

  it('token malformado (não é um JWT) → 401', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer isto-nao-e-um-jwt')
      .expect(401);
    expect(resposta.body).toEqual({ codigo: 'TOKEN_EXPIRADO', message: 'Token inválido ou expirado' });
  });

  it('JWT com assinatura/kid desconhecidos do JWKS do GoTrue → 401', async () => {
    const { privateKey } = await generateKeyPair('ES256');
    const token = await new SignJWT({ aud: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'chave-nao-cadastrada-no-jwks' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setSubject('11111111-1111-1111-1111-111111111111')
      .sign(privateKey);

    const resposta = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(resposta.body).toEqual({ codigo: 'TOKEN_EXPIRADO', message: 'Token inválido ou expirado' });
  });

  it('access token válido de usuário desativado depois do login → 401', async () => {
    const usuario = await criarUsuarioFixture(app);
    fixturesCriadas.push(usuario);

    const loginResposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: usuario.email, senha: usuario.senha })
      .expect(200);
    const token = loginResposta.body.accessToken as string;

    // Guard recarrega o usuário do banco a cada requisição — desativação surte efeito imediato.
    const prisma = app.get(PrismaService);
    await prisma.usuario.update({ where: { id: usuario.usuarioId }, data: { ativo: false } });

    const resposta = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(resposta.body).toEqual({ codigo: 'TOKEN_EXPIRADO', message: 'Usuário inválido ou inativo' });
  });
});
