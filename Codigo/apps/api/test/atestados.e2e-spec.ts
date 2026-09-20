import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { diaNoFuso, somarDias } from '@montacontrol/shared';
import { Perfil, StatusAtestado } from '../generated/prisma';
import { FUSO_OPERACAO } from '../src/common/fuso';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarApp } from './setup/criar-app';
import { apagarUsuarioFixture, criarUsuarioFixture, UsuarioFixture } from './fixtures/usuarios.fixture';

const UM_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function login(app: INestApplication, usuario: UsuarioFixture): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: usuario.email, senha: usuario.senha })
    .expect(200);
  return resposta.body.accessToken as string;
}

function ontem(): string {
  return somarDias(diaNoFuso(new Date().toISOString(), FUSO_OPERACAO), -1);
}

function corpoEnvio(): Record<string, unknown> {
  return {
    idCliente: randomUUID(),
    dataInicio: ontem(),
    dataFim: ontem(),
    fotos: [{ conteudoBase64: UM_PIXEL_PNG_BASE64, mimeType: 'image/png' }],
  };
}

describe('Atestados (e2e)', () => {
  let app: INestApplication;
  const fixturesCriadas: UsuarioFixture[] = [];
  let montador: UsuarioFixture;
  let rh: UsuarioFixture;
  let tokenMontador: string;
  let tokenRh: string;

  beforeAll(async () => {
    app = await criarApp();
    montador = await criarFixture(Perfil.MONTADOR);
    rh = await criarFixture(Perfil.RH);
    tokenMontador = await login(app, montador);
    tokenRh = await login(app, rh);
  });

  afterAll(async () => {
    // FK atestado_foto → atestado → usuario: limpar de dentro para fora, senão
    // a fixture deixa lixo permanente no MontaControlDev.
    const prisma = app.get(PrismaService);
    for (const fixture of fixturesCriadas.reverse()) {
      if (fixture.usuarioId) {
        await prisma.atestadoFoto.deleteMany({
          where: { atestado: { usuarioId: fixture.usuarioId } },
        });
        await prisma.atestado.deleteMany({ where: { usuarioId: fixture.usuarioId } });
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

  async function enviarAtestado(): Promise<number> {
    const resposta = await request(app.getHttpServer())
      .post('/api/atestados')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .send(corpoEnvio())
      .expect(201);
    return resposta.body.id as number;
  }

  it('MONTADOR envia e o atestado nasce PENDENTE', async () => {
    const id = await enviarAtestado();

    const resposta = await request(app.getHttpServer())
      .get('/api/atestados/meus')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .expect(200);

    const enviado = resposta.body.find((item: { id: number }) => item.id === id);
    expect(enviado.status).toBe(StatusAtestado.PENDENTE);
  });

  // N8T2 — a foto não é acessível fora do perfil de RH.
  it('GESTOR, DEPOSITO e o próprio MONTADOR levam 403 no detalhe do atestado', async () => {
    const id = await enviarAtestado();
    const gestor = await criarFixture(Perfil.GESTOR);
    const deposito = await criarFixture(Perfil.DEPOSITO);
    const tokenGestor = await login(app, gestor);
    const tokenDeposito = await login(app, deposito);

    for (const token of [tokenGestor, tokenDeposito, tokenMontador]) {
      await request(app.getHttpServer())
        .get(`/api/atestados/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    }
  });

  it('sem token, o detalhe responde 401', async () => {
    const id = await enviarAtestado();

    await request(app.getHttpServer()).get(`/api/atestados/${id}`).expect(401);
  });

  it('RH abre o detalhe e recebe URL assinada, nunca o caminho do bucket', async () => {
    const id = await enviarAtestado();

    const resposta = await request(app.getHttpServer())
      .get(`/api/atestados/${id}`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(200);

    expect(resposta.body.fotos).toHaveLength(1);
    expect(resposta.body.fotos[0].url).toContain('token=');
    expect(JSON.stringify(resposta.body)).not.toContain('storagePath');
  });

  it('RH valida o atestado e a segunda análise responde 409', async () => {
    const id = await enviarAtestado();

    const validado = await request(app.getHttpServer())
      .patch(`/api/atestados/${id}/validar`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(200);
    expect(validado.body.status).toBe(StatusAtestado.VALIDADO);
    expect(validado.body.validadoPor).toBe(rh.usuarioId);

    await request(app.getHttpServer())
      .patch(`/api/atestados/${id}/validar`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .expect(409);
  });

  // N8T3 — rejeição com motivo obrigatório.
  it('RH rejeita com motivo e o motivo volta no corpo', async () => {
    const id = await enviarAtestado();

    const rejeitado = await request(app.getHttpServer())
      .patch(`/api/atestados/${id}/rejeitar`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ motivo: 'Documento ilegível na foto enviada.' })
      .expect(200);

    expect(rejeitado.body.status).toBe(StatusAtestado.REJEITADO);
    expect(rejeitado.body.motivoRejeicao).toBe('Documento ilegível na foto enviada.');
  });

  it('rejeição sem motivo é barrada na borda com 400', async () => {
    const id = await enviarAtestado();

    await request(app.getHttpServer())
      .patch(`/api/atestados/${id}/rejeitar`)
      .set('Authorization', `Bearer ${tokenRh}`)
      .send({ motivo: '' })
      .expect(400);
  });
});
