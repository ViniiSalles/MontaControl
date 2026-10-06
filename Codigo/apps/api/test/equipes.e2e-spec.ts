import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
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

/** Equipes e atribuição de montadores à obra — exclusivas do gestor. */
describe('Equipes e atribuição de montadores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fixturesCriadas: UsuarioFixture[] = [];
  const equipesCriadas: number[] = [];
  let clienteId: number;
  let pedidoId: number;
  let montadorA: UsuarioFixture;
  let montadorB: UsuarioFixture;
  let avulso: UsuarioFixture;
  let operador: UsuarioFixture;
  let tokenGestor: string;
  let tokenRh: string;
  let tokenMontadorA: string;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);

    montadorA = await criarFixture(Perfil.MONTADOR);
    montadorB = await criarFixture(Perfil.MONTADOR);
    avulso = await criarFixture(Perfil.MONTADOR);
    operador = await criarFixture(Perfil.DEPOSITO);
    tokenGestor = await login(app, await criarFixture(Perfil.GESTOR));
    tokenRh = await login(app, await criarFixture(Perfil.RH));
    tokenMontadorA = await login(app, montadorA);

    const cliente = await prisma.cliente.create({
      data: {
        nome: 'Cliente Fixture e2e',
        endereco: 'Rua Fixture, 123',
        cidade: 'Belo Horizonte',
        estado: 'MG',
        cep: '30000-000',
        latitude: -19.9325,
        longitude: -43.9382,
        telefone: '31999999999',
      },
    });
    clienteId = cliente.id;
    const pedido = await prisma.pedido.create({
      data: { clienteId, numeroPedido: `PED-E2E-${randomUUID()}` },
    });
    pedidoId = pedido.id;
  });

  afterAll(async () => {
    await prisma.equipe.deleteMany({ where: { id: { in: equipesCriadas } } });
    if (pedidoId) {
      await prisma.pedidoMontador.deleteMany({ where: { pedidoId } });
      await prisma.pedido.delete({ where: { id: pedidoId } });
    }
    if (clienteId) await prisma.cliente.delete({ where: { id: clienteId } });
    for (const fixture of fixturesCriadas.reverse()) {
      await apagarUsuarioFixture(app, fixture);
    }
    await app.close();
  });

  async function criarFixture(perfil: Perfil): Promise<UsuarioFixture> {
    const fixture = await criarUsuarioFixture(app, { perfil });
    fixturesCriadas.push(fixture);
    return fixture;
  }

  it('gestor cria equipe, aplica na obra e ajusta membro a membro', async () => {
    const nome = `Equipe e2e ${randomUUID()}`;
    const criada = await request(app.getHttpServer())
      .post('/api/equipes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ nome, membrosIds: [montadorA.usuarioId, montadorB.usuarioId] })
      .expect(201);
    equipesCriadas.push(criada.body.id);
    expect(criada.body.membros).toHaveLength(2);

    await request(app.getHttpServer())
      .post('/api/equipes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ nome, membrosIds: [] })
      .expect(409);

    // Equipe inteira menos B, mais um avulso que não é da equipe.
    const atribuidos = await request(app.getHttpServer())
      .put(`/api/pedidos/${pedidoId}/montadores`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ usuarioIds: [montadorA.usuarioId, avulso.usuarioId] })
      .expect(200);
    expect(atribuidos.body.map((m: { id: number }) => m.id).sort()).toEqual(
      [montadorA.usuarioId, avulso.usuarioId].sort(),
    );

    const meus = await request(app.getHttpServer())
      .get('/api/pedidos/meus')
      .set('Authorization', `Bearer ${tokenMontadorA}`)
      .expect(200);
    expect(meus.body.map((p: { id: number }) => p.id)).toContain(pedidoId);

    // Remover a equipe não mexe na obra: a atribuição é por pessoa.
    await request(app.getHttpServer())
      .delete(`/api/equipes/${criada.body.id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(204);
    const depois = await request(app.getHttpServer())
      .get(`/api/pedidos/${pedidoId}/montadores`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);
    expect(depois.body).toHaveLength(2);
  });

  it('só montador ativo entra em obra ou equipe (422)', async () => {
    await request(app.getHttpServer())
      .put(`/api/pedidos/${pedidoId}/montadores`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ usuarioIds: [operador.usuarioId] })
      .expect(422);

    await request(app.getHttpServer())
      .post('/api/equipes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ nome: `Equipe e2e ${randomUUID()}`, membrosIds: [operador.usuarioId] })
      .expect(422);
  });

  it('RBAC: RH e montador não gerenciam equipes nem atribuição', async () => {
    for (const token of [tokenRh, tokenMontadorA]) {
      await request(app.getHttpServer())
        .get('/api/equipes')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .put(`/api/pedidos/${pedidoId}/montadores`)
        .set('Authorization', `Bearer ${token}`)
        .send({ usuarioIds: [] })
        .expect(403);
    }
  });
});
