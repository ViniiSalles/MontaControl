import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Perfil } from '../generated/prisma';
import { criarApp } from './setup/criar-app';
import { apagarUsuariosFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';
import { apagarObraFixture, criarObraFixture, ObraFixture } from './fixtures/obra.fixture';
import { PrismaService } from '../src/prisma/prisma.service';

async function login(app: INestApplication, usuario: UsuarioFixture): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: usuario.email, senha: usuario.senha })
    .expect(200);
  return resposta.body.accessToken as string;
}

/** Marcação no endereço da obra (sem `obra`, um pedido qualquer — para os testes de borda). */
function corpoCheckin(obra?: ObraFixture): Record<string, unknown> {
  return {
    idCliente: randomUUID(),
    latitude: obra?.latitude ?? -19.9325,
    longitude: obra?.longitude ?? -43.9382,
    registradoEm: new Date().toISOString(),
    pedidoId: obra?.pedidoId ?? 1,
  };
}

describe('Jornadas (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];
  const obrasCriadas: ObraFixture[] = [];

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    try {
      await apagarUsuariosFixture(app, fixturesCriadas);
      for (const obra of obrasCriadas) await apagarObraFixture(app, obra);
    } finally {
      await app.close();
    }
  });

  async function criarFixture(perfil: Perfil): Promise<UsuarioFixture> {
    const fixture = await criarUsuarioFixture(app, { perfil });
    fixturesCriadas.push(fixture);
    return fixture;
  }

  async function criarObra(...montadores: UsuarioFixture[]): Promise<ObraFixture> {
    const obra = await criarObraFixture(app, montadores.map((montador) => montador.usuarioId));
    obrasCriadas.push(obra);
    return obra;
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
    const corpo = corpoCheckin(await criarObra(montador));

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

  it('check-in exige obra do montador dentro do raio; segundo check-in → 409 JORNADA_EM_ANDAMENTO', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const outro = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, montador);
    const obra = await criarObra(montador);
    const alheia = await criarObra(outro);

    // Sem login do `outro`: o limite de login do e2e é apertado.
    const recusar = (corpo: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/jornadas/checkin')
        .set('Authorization', `Bearer ${token}`)
        .send(corpo)
        .expect(400);
    await recusar({ ...corpoCheckin(obra), pedidoId: undefined });
    expect((await recusar(corpoCheckin(alheia))).body.codigo).toBe('PEDIDO_INVALIDO');
    expect((await recusar({ ...corpoCheckin(obra), latitude: obra.latitude + 0.01 })).body.codigo).toBe(
      'FORA_DO_RAIO_TOLERADO',
    );

    await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCheckin(obra))
      .expect(201);

    const conflito = await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCheckin(obra))
      .expect(409);

    expect(conflito.body.codigo).toBe('JORNADA_EM_ANDAMENTO');
  });

  it('check-out encerra a jornada e o histórico passa a contá-la', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, montador);
    const obra = await criarObra(montador);

    await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send(corpoCheckin(obra))
      .expect(201);

    // Saída longe da obra do check-in é recusada.
    const longe = await request(app.getHttpServer())
      .post('/api/jornadas/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...corpoCheckin(obra), latitude: obra.latitude + 0.01, pedidoId: undefined })
      .expect(400);
    expect(longe.body.codigo).toBe('FORA_DO_RAIO_TOLERADO');

    await request(app.getHttpServer())
      .post('/api/jornadas/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...corpoCheckin(obra), pedidoId: undefined })
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

  it('N check-ins paralelos de montadores diferentes geram NSR consecutivo, sem buracos', async () => {
    const prisma = app.get(PrismaService);
    const N = 5;
    const fixturesConcorrentes = await Promise.all(
      Array.from({ length: N }, () => criarFixture(Perfil.MONTADOR)),
    );
    const tokens = await Promise.all(fixturesConcorrentes.map((fixture) => login(app, fixture)));
    const obra = await criarObra(...fixturesConcorrentes);

    const respostas = await Promise.all(
      tokens.map((token) =>
        request(app.getHttpServer())
          .post('/api/jornadas/checkin')
          .set('Authorization', `Bearer ${token}`)
          .send(corpoCheckin(obra))
          .expect(201),
      ),
    );

    const jornadaIds = respostas.map((resposta) => resposta.body.id as number);
    const marcacoes = await prisma.marcacaoPonto.findMany({
      where: { jornadaId: { in: jornadaIds } },
      orderBy: { nsr: 'asc' },
      select: { nsr: true },
    });

    expect(marcacoes).toHaveLength(N);
    const nsrs = marcacoes.map((marcacao) => marcacao.nsr);
    for (let indice = 1; indice < nsrs.length; indice += 1) {
      expect(nsrs[indice]).toBe(nsrs[indice - 1] + 1); // consecutivo — não checa o valor absoluto, só a ausência de buraco
    }
  });
});
