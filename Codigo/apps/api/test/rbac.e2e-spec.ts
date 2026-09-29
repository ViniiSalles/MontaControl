import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Perfil } from '../generated/prisma';
import { criarApp } from './setup/criar-app';
import { apagarUsuariosFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

async function login(app: INestApplication, usuario: UsuarioFixture): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: usuario.email, senha: usuario.senha })
    .expect(200);
  return resposta.body.accessToken as string;
}

/** N1T3: GET /api/usuarios é restrito a RH e GESTOR. */
describe('GET /api/usuarios — RBAC (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    try {
      await apagarUsuariosFixture(app, fixturesCriadas);
    } finally {
      await app.close();
    }
  });

  async function criarFixture(perfil: Perfil): Promise<UsuarioFixture> {
    const fixture = await criarUsuarioFixture(app, { perfil });
    fixturesCriadas.push(fixture);
    return fixture;
  }

  it('sem token → 401', async () => {
    await request(app.getHttpServer()).get('/api/usuarios').expect(401);
  });

  it('MONTADOR autenticado → 403', async () => {
    const usuario = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, usuario);

    await request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('DEPOSITO autenticado → 403', async () => {
    const usuario = await criarFixture(Perfil.DEPOSITO);
    const token = await login(app, usuario);

    await request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('RH autenticado → 200, e a própria fixture aparece na listagem', async () => {
    const usuario = await criarFixture(Perfil.RH);
    const token = await login(app, usuario);

    const resposta = await request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(resposta.body)).toBe(true);
    expect(resposta.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: usuario.usuarioId, email: usuario.email })]),
    );
  });

  it('GESTOR autenticado → 200', async () => {
    const usuario = await criarFixture(Perfil.GESTOR);
    const token = await login(app, usuario);

    await request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});

/** Issue #25: GET /api/espelho-ponto/:usuarioId é restrito a RH — usuarioId vem do path, não do token. */
describe('GET /api/espelho-ponto — RBAC (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    try {
      await apagarUsuariosFixture(app, fixturesCriadas);
    } finally {
      await app.close();
    }
  });

  async function criarFixture(perfil: Perfil): Promise<UsuarioFixture> {
    const fixture = await criarUsuarioFixture(app, { perfil });
    fixturesCriadas.push(fixture);
    return fixture;
  }

  it('sem token → 401', async () => {
    await request(app.getHttpServer()).get('/api/espelho-ponto/1?mes=8&ano=2026').expect(401);
  });

  it('MONTADOR autenticado → 403', async () => {
    const usuario = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, usuario);

    await request(app.getHttpServer())
      .get('/api/espelho-ponto/1?mes=8&ano=2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('RH autenticado → 200, consultando o espelho de um montador', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const rh = await criarFixture(Perfil.RH);
    const token = await login(app, rh);

    const resposta = await request(app.getHttpServer())
      .get(`/api/espelho-ponto/${montador.usuarioId}?mes=8&ano=2026`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resposta.body.usuarioId).toBe(montador.usuarioId);
    expect(resposta.body.usuarioNome).toBe(montador.nome);
    expect(Array.isArray(resposta.body.dias)).toBe(true);
  });

  it('RH autenticado consultando usuarioId inexistente → 404', async () => {
    const rh = await criarFixture(Perfil.RH);
    const token = await login(app, rh);

    await request(app.getHttpServer())
      .get('/api/espelho-ponto/999999999?mes=8&ano=2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
