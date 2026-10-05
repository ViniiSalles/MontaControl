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

/** Avarias: operador e montador reportam, gestor analisa; RH fica de fora. */
describe('Avarias (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fixturesCriadas: UsuarioFixture[] = [];
  const pedidosCriados: number[] = [];
  let clienteId: number;
  let tipoAvariaId: number;
  let montador: UsuarioFixture;
  let tokenOperador: string;
  let tokenMontador: string;
  let tokenGestor: string;
  let tokenRh: string;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);

    const operador = await criarFixture(Perfil.DEPOSITO);
    montador = await criarFixture(Perfil.MONTADOR);
    const gestor = await criarFixture(Perfil.GESTOR);
    const rh = await criarFixture(Perfil.RH);
    tokenOperador = await login(app, operador);
    tokenMontador = await login(app, montador);
    tokenGestor = await login(app, gestor);
    tokenRh = await login(app, rh);

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

    const tipo =
      (await prisma.tipoAvaria.findFirst({ select: { id: true } })) ??
      (await prisma.tipoAvaria.create({
        data: { nome: 'Faltante', descricao: 'Fixture e2e' },
        select: { id: true },
      }));
    tipoAvariaId = tipo.id;
  });

  afterAll(async () => {
    for (const pedidoId of pedidosCriados.reverse()) {
      const porPedido = { peca: { ambiente: { pedidoId } } };
      await prisma.avariaFoto.deleteMany({ where: { avaria: porPedido } });
      await prisma.avaria.deleteMany({ where: porPedido });
      await prisma.pedidoMontador.deleteMany({ where: { pedidoId } });
      await prisma.peca.deleteMany({ where: { ambiente: { pedidoId } } });
      await prisma.ambiente.deleteMany({ where: { pedidoId } });
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

  /** Pedido com uma peça; devolve os ids. */
  async function criarPedidoComPeca(): Promise<{ pedidoId: number; pecaId: number }> {
    const pedido = await prisma.pedido.create({
      data: { clienteId, numeroPedido: `PED-E2E-${randomUUID()}` },
    });
    pedidosCriados.push(pedido.id);
    const ambiente = await prisma.ambiente.create({ data: { pedidoId: pedido.id, nome: 'Cozinha' } });
    const peca = await prisma.peca.create({
      data: { ambienteId: ambiente.id, itemId: 0, descricao: 'Porta de armário' },
    });
    return { pedidoId: pedido.id, pecaId: peca.id };
  }

  function reportar(token: string, pecaId: number) {
    return request(app.getHttpServer())
      .post('/api/avarias')
      .set('Authorization', `Bearer ${token}`)
      .send({ idCliente: randomUUID(), pecaId, tipoAvariaId, descricao: 'Peça não veio' });
  }

  it('operador reporta, gestor vê na fila e conduz a análise até RESOLVIDA', async () => {
    const { pecaId } = await criarPedidoComPeca();

    const criada = await reportar(tokenOperador, pecaId).expect(201);
    expect(criada.body).toMatchObject({
      pecaId,
      status: 'REPORTADA',
      registradaPorPerfil: Perfil.DEPOSITO,
    });
    const id = criada.body.id as number;

    const fila = await request(app.getHttpServer())
      .get('/api/avarias?origem=DEPOSITO&status=REPORTADA')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);
    expect(fila.body.map((a: { id: number }) => a.id)).toContain(id);

    await request(app.getHttpServer())
      .patch(`/api/avarias/${id}/status`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ status: 'RESOLVIDA', parecer: 'pulou etapa' })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/api/avarias/${id}/status`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ status: 'EM_ANALISE' })
      .expect(200);

    const resolvida = await request(app.getHttpServer())
      .patch(`/api/avarias/${id}/status`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ status: 'RESOLVIDA', parecer: 'Reposta do estoque' })
      .expect(200);
    expect(resolvida.body).toMatchObject({ status: 'RESOLVIDA', parecer: 'Reposta do estoque' });

    const detalhe = await request(app.getHttpServer())
      .get(`/api/avarias/${id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);
    expect(detalhe.body.analisadaPorNome).toEqual(expect.any(String));
  });

  it('montador só reporta peça de pedido vinculado a ele', async () => {
    const alheio = await criarPedidoComPeca();
    await reportar(tokenMontador, alheio.pecaId).expect(404);

    const proprio = await criarPedidoComPeca();
    await prisma.pedidoMontador.create({
      data: { pedidoId: proprio.pedidoId, usuarioId: montador.usuarioId },
    });
    const meusPedidos = await request(app.getHttpServer())
      .get('/api/pedidos/meus')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .expect(200);
    const idsPedidos = meusPedidos.body.map((p: { id: number }) => p.id);
    expect(idsPedidos).toContain(proprio.pedidoId);
    expect(idsPedidos).not.toContain(alheio.pedidoId);

    const criada = await reportar(tokenMontador, proprio.pecaId).expect(201);
    expect(criada.body.registradaPorPerfil).toBe(Perfil.MONTADOR);

    const minhas = await request(app.getHttpServer())
      .get('/api/avarias/minhas')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .expect(200);
    expect(minhas.body.map((a: { id: number }) => a.id)).toEqual([criada.body.id]);
  });

  it('RBAC: só o gestor lista e decide; RH e gestor não reportam; sem token é 401', async () => {
    const { pecaId } = await criarPedidoComPeca();

    await reportar(tokenGestor, pecaId).expect(403);
    await reportar(tokenRh, pecaId).expect(403);
    for (const token of [tokenOperador, tokenMontador, tokenRh]) {
      await request(app.getHttpServer())
        .get('/api/avarias')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .patch('/api/avarias/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'EM_ANALISE' })
        .expect(403);
    }
    await request(app.getHttpServer()).get('/api/avarias').expect(401);
  });
});
