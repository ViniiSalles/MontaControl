import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { diaNoFuso, somarDias } from '@montacontrol/shared';
import { Perfil } from '../generated/prisma';
import { FUSO_OPERACAO } from '../src/common/fuso';
import { criarApp } from './setup/criar-app';
import { apagarUsuariosFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

async function login(app: INestApplication, usuario: UsuarioFixture): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: usuario.email, senha: usuario.senha })
    .expect(200);
  return resposta.body.accessToken as string;
}

/** Ontem no fuso de operação: dentro da janela retroativa e sem jornada para sobrepor. */
function ontem(): string {
  return somarDias(diaNoFuso(new Date().toISOString(), FUSO_OPERACAO), -1);
}

function corpoSolicitacao(): Record<string, unknown> {
  return {
    idCliente: randomUUID(),
    data: ontem(),
    horaInicio: '08:00',
    horaFim: '17:00',
    justificativa: 'Fiquei sem bateria no celular a manhã inteira.',
  };
}

describe('Pontos em atraso (e2e)', () => {
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

  it('MONTADOR com corpo válido → 201 e solicitação PENDENTE', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const token = await login(app, montador);
    const corpo = corpoSolicitacao();

    const resposta = await request(app.getHttpServer())
      .post('/api/pontos-em-atraso')
      .set('Authorization', `Bearer ${token}`)
      .send(corpo)
      .expect(201);

    expect(resposta.body).toMatchObject({
      usuarioId: montador.usuarioId,
      usuarioNome: montador.nome,
      data: corpo.data,
      status: 'PENDENTE',
      // 08:00 → 17:00 = 9h, e a conta é sobre instantes no fuso de operação.
      minutosSolicitados: 540,
      jornadaId: null,
    });
    expect(resposta.body.id).toEqual(expect.any(Number));
  });

  it('GESTOR consulta a solicitação criada → 200 com o mesmo registro', async () => {
    const montador = await criarFixture(Perfil.MONTADOR);
    const gestor = await criarFixture(Perfil.GESTOR);

    const criada = await request(app.getHttpServer())
      .post('/api/pontos-em-atraso')
      .set('Authorization', `Bearer ${await login(app, montador)}`)
      .send(corpoSolicitacao())
      .expect(201);

    const detalhe = await request(app.getHttpServer())
      .get(`/api/pontos-em-atraso/${criada.body.id}`)
      .set('Authorization', `Bearer ${await login(app, gestor)}`)
      .expect(200);

    expect(detalhe.body.id).toBe(criada.body.id);
    expect(detalhe.body.justificativa).toBe(criada.body.justificativa);
    expect(detalhe.body.usuarioNome).toBe(montador.nome);
  });
});
