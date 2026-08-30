import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Perfil } from '../generated/prisma';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarApp } from './setup/criar-app';
import { apagarUsuarioFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

async function login(app: INestApplication, usuario: UsuarioFixture): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: usuario.email, senha: usuario.senha })
    .expect(200);
  return resposta.body.accessToken as string;
}

function corpoCheckin(): Record<string, unknown> {
  return {
    idCliente: randomUUID(),
    latitude: -19.9325,
    longitude: -43.9382,
    registradoEm: new Date().toISOString(),
  };
}

describe('Jornadas (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    // As fixtures MONTADOR desta suíte criam jornadas de verdade via API;
    // sem apagá-las antes, a FK usuario_id→jornada barra o delete do
    // usuário e deixa lixo permanente no MontaControlDev.
    const prisma = app.get(PrismaService);
    for (const fixture of fixturesCriadas.reverse()) {
      if (fixture.usuarioId) {
        await prisma.jornada.deleteMany({ where: { usuarioId: fixture.usuarioId } });
      }
      await apagarUsuarioFixture(app, fixture);
    }
    await app.close();
  });

  async function criarFixture(perfil: Perfil): Promise<UsuarioFixture> {
    const fixture = await criarUsuarioFixture(app, { perfil });
    fixturesCriadas.push(fixture);
    return fixture;
  }

  it('sem token → 401', async () => {
    await request(app.getHttpServer()).post('/api/jornadas/checkin').send(corpoCheckin()).expect(401);
  });

  it('perfil não-MONTADOR → 403', async () => {
    const gestor = await criarFixture(Perfil.GESTOR);
    const token = await login(app, gestor);

    await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCheckin())
      .expect(403);
  });

  it('mesmo idCliente duas vezes devolve a mesma jornada', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, montador);
    const corpo = corpoCheckin();

    const primeira = await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpo)
      .expect(201);

    const segunda = await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpo)
      .expect(201);

    expect(segunda.body.id).toBe(primeira.body.id);
  });

  it('segundo check-in com idCliente diferente → 409 JORNADA_EM_ANDAMENTO', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, montador);

    await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCheckin())
      .expect(201);

    const conflito = await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCheckin())
      .expect(409);

    expect(conflito.body.codigo).toBe('JORNADA_EM_ANDAMENTO');
  });

  it('check-out encerra a jornada e o histórico passa a contá-la', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, montador);

    await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCheckin())
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/jornadas/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...corpoCheckin(), registradoEm: new Date().toISOString() })
      .expect(200);

    const historico = await request(app.getHttpServer())
      .get('/api/jornadas/historico?dias=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(historico.body.dias).toHaveLength(1);
    expect(historico.body.dias[0].emAndamento).toBe(false);
  });

  it('período inválido no histórico → 400', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, montador);

    await request(app.getHttpServer())
      .get('/api/jornadas/historico?dias=7')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
