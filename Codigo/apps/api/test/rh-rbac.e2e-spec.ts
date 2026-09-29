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

const COMPETENCIA = { ano: 2026, mes: 9 };

describe('Rotas de RH — autorização (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];
  let rh: UsuarioFixture;
  let montador: UsuarioFixture;
  let tokenRh: string;
  let tokenMontador: string;

  beforeAll(async () => {
    app = await criarApp();
    rh = await criarFixture(Perfil.RH);
    montador = await criarFixture(Perfil.MONTADOR);
    tokenRh = await login(app, rh);
    tokenMontador = await login(app, montador);
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

  it('MONTADOR leva 403 no banco de horas, no espelho e na inativação', async () => {
    await request(app.getHttpServer())
      .get('/api/banco-horas/equipe')
      .query(COMPETENCIA)
      .set('Authorization', `Bearer ${tokenMontador}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/espelho-ponto/${montador.usuarioId}`)
      .query(COMPETENCIA)
      .set('Authorization', `Bearer ${tokenMontador}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/usuarios/${montador.usuarioId}/ativo`)
      .set('Authorization', `Bearer ${tokenMontador}`)
      .send({ ativo: false })
      .expect(403);
  });

  it('MONTADOR leva 403 ao informar CPF', async () => {
    await request(app.getHttpServer())
      .patch(`/api/usuarios/${montador.usuarioId}/cpf`)
      .set('Authorization', `Bearer ${tokenMontador}`)
      .send({ cpf: '52998224725' })
      .expect(403);
  });

  it('RH com CPF inválido leva 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/usuarios/${montador.usuarioId}/cpf`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ cpf: '11111111111' })
      .expect(400);
  });

  it('RH não consegue sobrescrever CPF já informado — segunda PATCH leva 409', async () => {
    // Fixture própria (não a `montador` compartilhada): o CPF gravado aqui
    // fica definitivo para o usuário, e não pode colidir com outro teste.
    const semCpfAinda = await criarFixture(Perfil.MONTADOR);

    await request(app.getHttpServer())
      .patch(`/api/usuarios/${semCpfAinda.usuarioId}/cpf`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ cpf: '11122233396' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/usuarios/${semCpfAinda.usuarioId}/cpf`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ cpf: '98765432100' })
      .expect(409);
  });

  it('sem token, todas respondem 401', async () => {
    await request(app.getHttpServer()).get('/api/banco-horas').query(COMPETENCIA).expect(401);
    await request(app.getHttpServer()).get('/api/pontos-em-atraso/pendentes').expect(401);
  });

  it('RH lê banco de horas e espelho de ponto', async () => {
    const banco = await request(app.getHttpServer())
      .get('/api/banco-horas/equipe')
      .query(COMPETENCIA)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(200);
    expect(Array.isArray(banco.body)).toBe(true);

    const espelho = await request(app.getHttpServer())
      .get(`/api/espelho-ponto/${montador.usuarioId}`)
      .query(COMPETENCIA)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(200);
    expect(espelho.body.dias).toHaveLength(30);
  });

  it('competência inválida é barrada na borda com 400', async () => {
    await request(app.getHttpServer())
      .get('/api/banco-horas/equipe')
      .query({ ano: 2026, mes: 13 })
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(400);
  });

  it('RH inativa o montador e o token dele deixa de valer na hora', async () => {
    await request(app.getHttpServer())
      .patch(`/api/usuarios/${montador.usuarioId}/ativo`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ ativo: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/jornadas/atual')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .expect(401);
  });

  it('RH não consegue inativar a si mesmo', async () => {
    await request(app.getHttpServer())
      .patch(`/api/usuarios/${rh.usuarioId}/ativo`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ ativo: false })
      .expect(409);
  });
});
