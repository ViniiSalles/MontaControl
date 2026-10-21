import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Perfil } from '../generated/prisma';
import { criarApp } from './setup/criar-app';
import { apagarObraFixture, criarObraFixture, ObraFixture } from './fixtures/obra.fixture';
import { apagarUsuariosFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

async function login(app: INestApplication, usuario: UsuarioFixture): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: usuario.email, senha: usuario.senha })
    .expect(200);
  return resposta.body.accessToken as string;
}

/** N2T1 — o dashboard gerencial é exclusivo do GESTOR. */
describe('GET /api/dashboard (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];
  const obrasCriadas: ObraFixture[] = [];

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    try {
      for (const obra of obrasCriadas) await apagarObraFixture(app, obra);
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
    await request(app.getHttpServer()).get('/api/dashboard').expect(401);
  });

  it.each([Perfil.MONTADOR, Perfil.DEPOSITO, Perfil.RH])('%s autenticado → 403', async (perfil) => {
    const token = await login(app, await criarFixture(perfil));

    await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GESTOR → 200 com indicadores, produtividade de 7 dias e o pedido sem peças aguardando a fábrica', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const obra = await criarObraFixture(app, [montador.usuarioId]);
    obrasCriadas.push(obra);
    const token = await login(app, await criarFixture(Perfil.GESTOR));

    const resposta = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resposta.body.indicadores).toEqual(
      expect.objectContaining({
        montadoresEmCampo: expect.any(Number),
        avariasHoje: expect.any(Number),
        pecasDescarregadasHoje: expect.any(Number),
      }),
    );
    expect(resposta.body.produtividade).toHaveLength(7);
    expect(Array.isArray(resposta.body.alertas)).toBe(true);
    expect(resposta.body.pedidos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pedidoId: obra.pedidoId,
          etapa: 'AGUARDANDO_FABRICA',
          totalPecas: 0,
          montadores: [montador.nome],
        }),
      ]),
    );
  });
});
