import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarApp } from './setup/criar-app';
import { apagarUsuarioFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

describe('POST /api/auth/refresh (e2e)', () => {
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

  it('refresh token válido → 200 com uma nova sessão', async () => {
    const usuario = await criarUsuarioFixture(app);
    fixturesCriadas.push(usuario);

    const loginResposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: usuario.email, senha: usuario.senha })
      .expect(200);

    const resposta = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginResposta.body.refreshToken })
      .expect(200);

    expect(resposta.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
      usuario: { id: usuario.usuarioId, email: usuario.email },
    });
  });

  it('refresh token inválido/revogado → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'token-que-nunca-existiu' })
      .expect(401);
  });

  it('usuário desativado depois do login → refresh também nega (401)', async () => {
    const usuario = await criarUsuarioFixture(app);
    fixturesCriadas.push(usuario);

    const loginResposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: usuario.email, senha: usuario.senha })
      .expect(200);

    const prisma = app.get(PrismaService);
    await prisma.usuario.update({ where: { id: usuario.usuarioId }, data: { ativo: false } });

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginResposta.body.refreshToken })
      .expect(401);
  });
});
