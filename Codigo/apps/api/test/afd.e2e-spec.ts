import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

/** Ano/mês de referência do teste: o mês corrente, para não depender de dado histórico. */
function competenciaDeHoje(): { ano: number; mes: number } {
  const agora = new Date();
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

describe('GET /api/afd (e2e)', () => {
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
    const { ano, mes } = competenciaDeHoje();
    await request(app.getHttpServer()).get(`/api/afd?ano=${ano}&mes=${mes}`).expect(401);
  });

  it('MONTADOR e GESTOR levam 403', async () => {
    const { ano, mes } = competenciaDeHoje();
    const montador = await criarFixture(Perfil.MONTADOR);
    const gestor = await criarFixture(Perfil.GESTOR);
    const tokenMontador = await login(app, montador);
    const tokenGestor = await login(app, gestor);

    await request(app.getHttpServer())
      .get(`/api/afd?ano=${ano}&mes=${mes}`)
      .set('Authorization', `Bearer ${tokenMontador}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/afd?ano=${ano}&mes=${mes}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(403);
  });

  it('competência inválida é barrada na borda com 400', async () => {
    const rh = await criarFixture(Perfil.RH);
    const tokenRh = await login(app, rh);

    await request(app.getHttpServer())
      .get('/api/afd?ano=abc&mes=13')
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(400);
  });

  it('RH recebe 200 com o arquivo (mês do fixture, sem marcação, só cabeçalho/trailer/assinatura)', async () => {
    const { ano, mes } = competenciaDeHoje();
    const rh = await criarFixture(Perfil.RH);
    const tokenRh = await login(app, rh);

    const resposta = await request(app.getHttpServer())
      .get(`/api/afd?ano=${ano}&mes=${mes}`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(200);

    expect(resposta.headers['content-type']).toContain('text/plain');
    expect(resposta.headers['content-disposition']).toMatch(/^attachment; filename="AFD.*REP_P\.txt"$/);
    const texto = (resposta.body as Buffer).toString('latin1');
    const linhas = texto.split('\r\n');
    expect(linhas[0]).toHaveLength(302); // tipo 1
    expect(linhas[0].slice(0, 10)).toBe('0000000001'); // campo 1 (9 zeros) + campo 2 (tipo "1")
    expect(linhas.at(-1)).toBe(''); // termina em CRLF, sem linha em branco extra
    expect(linhas.at(-2)?.trimEnd()).toBe('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S'); // última linha de dados é a assinatura
  });

  it('RH recebe 200 com marcações reais de um montador com CPF (check-in/check-out no mês)', async () => {
    const { ano, mes } = competenciaDeHoje();
    const rh = await criarFixture(Perfil.RH);
    const montador = await criarFixture(Perfil.MONTADOR);
    const tokenRh = await login(app, rh);
    const tokenMontador = await login(app, montador);

    // Válido (dígitos verificadores conferidos) e distinto dos CPFs de seed
    // (gestor@/rh@/montador@montacontrol.local), para não colidir com a
    // restrição de unicidade de CPF do banco de dev compartilhado.
    const cpfValido = '98765432100';
    await request(app.getHttpServer())
      .patch(`/api/usuarios/${montador.usuarioId}/cpf`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ cpf: cpfValido })
      .expect(200);

    const agora = new Date();
    await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .send({
        idCliente: randomUUID(),
        latitude: -19.93,
        longitude: -43.94,
        registradoEm: new Date(agora.getTime() - 60 * 60_000).toISOString(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/jornadas/checkout')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .send({
        idCliente: randomUUID(),
        latitude: -19.93,
        longitude: -43.94,
        registradoEm: agora.toISOString(),
      })
      .expect(200);

    const resposta = await request(app.getHttpServer())
      .get(`/api/afd?ano=${ano}&mes=${mes}`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(200);

    const linhas = (resposta.body as Buffer).toString('latin1').split('\r\n');
    // Ao menos as 2 marcações deste teste entre as linhas tipo 7 (podem existir mais, de outros e2e do mesmo mês).
    const linhasTipo7 = linhas.filter((linha) => linha.length === 137 && linha[9] === '7');
    expect(linhasTipo7.length).toBeGreaterThanOrEqual(2);
    expect(linhasTipo7.some((linha) => linha.slice(35, 46) === cpfValido)).toBe(true);
  });

  it('RH recebe 422 com o nome do montador sem CPF (mesmo mês, marcação pendente de selagem)', async () => {
    const { ano, mes } = competenciaDeHoje();
    const rh = await criarFixture(Perfil.RH);
    const semCpf = await criarFixture(Perfil.MONTADOR);
    const tokenRh = await login(app, rh);
    const tokenSemCpf = await login(app, semCpf);

    const agora = new Date();
    await request(app.getHttpServer())
      .post('/api/jornadas/checkin')
      .set('Authorization', `Bearer ${tokenSemCpf}`)
      .send({
        idCliente: randomUUID(),
        latitude: -19.93,
        longitude: -43.94,
        registradoEm: agora.toISOString(),
      })
      .expect(201);

    const resposta = await request(app.getHttpServer())
      .get(`/api/afd?ano=${ano}&mes=${mes}`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(422);

    expect((resposta.body as { message: string }).message).toContain(semCpf.nome);
  });
});
