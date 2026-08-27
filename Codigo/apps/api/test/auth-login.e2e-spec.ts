import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Perfil } from '../generated/prisma';
import { criarApp } from './setup/criar-app';
import { apagarUsuarioFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'Credenciais inválidas';

describe('POST /api/auth/login (e2e)', () => {
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

  async function criarFixture(opcoes: Parameters<typeof criarUsuarioFixture>[1] = {}): Promise<UsuarioFixture> {
    const fixture = await criarUsuarioFixture(app, opcoes);
    fixturesCriadas.push(fixture);
    return fixture;
  }

  // N1T1
  it('credenciais válidas de usuário ativo → 200 com tokens e usuário', async () => {
    const usuario = await criarFixture({ perfil: Perfil.MONTADOR });

    const resposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: usuario.email, senha: usuario.senha })
      .expect(200);

    expect(resposta.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
      usuario: {
        id: usuario.usuarioId,
        email: usuario.email,
        perfil: Perfil.MONTADOR,
        ativo: true,
      },
    });
  });

  // N1T2: senha errada, usuário sem linha em `usuario`, e usuário inativo — mesmo 401 genérico.
  it('senha errada → 401 genérico', async () => {
    const usuario = await criarFixture();

    const resposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: usuario.email, senha: 'senha-errada-123' })
      .expect(401);

    expect(resposta.body).toEqual({
      codigo: 'CREDENCIAIS_INVALIDAS',
      message: MENSAGEM_CREDENCIAIS_INVALIDAS,
    });
  });

  it('usuário existe no GoTrue mas não tem linha em `usuario` → 401 genérico (mesmo corpo)', async () => {
    const usuario = await criarFixture({ semLinhaUsuario: true });

    const resposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: usuario.email, senha: usuario.senha })
      .expect(401);

    expect(resposta.body).toEqual({
      codigo: 'CREDENCIAIS_INVALIDAS',
      message: MENSAGEM_CREDENCIAIS_INVALIDAS,
    });
  });

  it('usuário desativado → 401 genérico (mesmo corpo)', async () => {
    const usuario = await criarFixture({ ativo: false });

    const resposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: usuario.email, senha: usuario.senha })
      .expect(401);

    expect(resposta.body).toEqual({
      codigo: 'CREDENCIAIS_INVALIDAS',
      message: MENSAGEM_CREDENCIAIS_INVALIDAS,
    });
  });

  // TI01: 10 tentativas/min na rota de login — a 11ª é bloqueada.
  it('mais de 10 tentativas em 1 minuto → 429', async () => {
    const usuario = await criarFixture();
    const corpo = { email: usuario.email, senha: 'senha-errada-123' };

    for (let tentativa = 0; tentativa < 10; tentativa++) {
      await request(app.getHttpServer()).post('/api/auth/login').send(corpo);
    }

    await request(app.getHttpServer()).post('/api/auth/login').send(corpo).expect(429);
  });
});
