import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Perfil, StatusPedido } from '../generated/prisma';
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

/** TI08/N7 — triagem de peça via código de barras e agrupamento por pedido e ambiente. */
describe('Pecas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fixturesCriadas: UsuarioFixture[] = [];
  const pedidosCriados: number[] = [];
  let clienteId: number;
  let operador: UsuarioFixture;
  let montador: UsuarioFixture;
  let tokenOperador: string;
  let tokenMontador: string;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);

    operador = await criarFixture(Perfil.DEPOSITO);
    montador = await criarFixture(Perfil.MONTADOR);
    tokenOperador = await login(app, operador);
    tokenMontador = await login(app, montador);

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
  });

  afterAll(async () => {
    for (const pedidoId of pedidosCriados.reverse()) {
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

  async function criarPedido(): Promise<string> {
    const numeroPedido = `PED-E2E-${randomUUID()}`;
    const pedido = await prisma.pedido.create({ data: { clienteId, numeroPedido } });
    pedidosCriados.push(pedido.id);
    return numeroPedido;
  }

  it('MONTADOR e requisição sem token levam 403/401 na triagem', async () => {
    const numeroPedido = await criarPedido();

    await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenMontador}`)
      .send({ codigoBarras: randomUUID(), descricao: 'Porta', numeroPedido, ambiente: 'Cozinha' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/pecas')
      .send({ codigoBarras: randomUUID(), descricao: 'Porta', numeroPedido, ambiente: 'Cozinha' })
      .expect(401);
  });

  it('numeroPedido inexistente é barrado com 404', async () => {
    await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({
        codigoBarras: randomUUID(),
        descricao: 'Porta',
        numeroPedido: 'PED-INEXISTENTE',
        ambiente: 'Cozinha',
      })
      .expect(404);
  });

  it('N7T1/TI08: cadastra a peça via código de barras, agrupa por pedido e ambiente, e o pedido sai de AGUARDANDO para EM_TRIAGEM', async () => {
    const numeroPedido = await criarPedido();
    const codigoBarras = randomUUID();

    const resposta = await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ codigoBarras, descricao: 'Porta de armário', numeroPedido, ambiente: 'Cozinha' })
      .expect(201);

    expect(resposta.body).toMatchObject({ codigoBarras, status: 'TRIADA' });

    const pedidoNoBanco = await prisma.pedido.findUnique({ where: { numeroPedido } });
    expect(pedidoNoBanco?.status).toBe(StatusPedido.EM_TRIAGEM);

    const ambienteNoBanco = await prisma.ambiente.findUnique({
      where: { id: resposta.body.ambienteId },
    });
    expect(ambienteNoBanco?.nome).toBe('Cozinha');
  });

  it('N7T2: bloqueia o cadastro de código de barras duplicado com 409', async () => {
    const numeroPedido = await criarPedido();
    const codigoBarras = randomUUID();

    await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ codigoBarras, descricao: 'Porta', numeroPedido, ambiente: 'Cozinha' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ codigoBarras, descricao: 'Porta', numeroPedido, ambiente: 'Cozinha' })
      .expect(409);
  });

  it('N7T3: duas peças no mesmo ambiente agrupam sob o mesmo ambiente; ambientes distintos não se misturam', async () => {
    const numeroPedido = await criarPedido();

    await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ codigoBarras: randomUUID(), descricao: 'Porta', numeroPedido, ambiente: 'Cozinha' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ codigoBarras: randomUUID(), descricao: 'Gaveta', numeroPedido, ambiente: 'Cozinha' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/pecas')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .send({ codigoBarras: randomUUID(), descricao: 'Cama', numeroPedido, ambiente: 'Quarto' })
      .expect(201);

    const resposta = await request(app.getHttpServer())
      .get(`/api/pedidos/${numeroPedido}`)
      .set('Authorization', `Bearer ${tokenOperador}`)
      .expect(200);

    expect(resposta.body.ambientes).toHaveLength(2);
    const cozinha = resposta.body.ambientes.find((ambiente: { nome: string }) => ambiente.nome === 'Cozinha');
    const quarto = resposta.body.ambientes.find((ambiente: { nome: string }) => ambiente.nome === 'Quarto');
    expect(cozinha.pecas).toHaveLength(2);
    expect(quarto.pecas).toHaveLength(1);
  });

  it('GET /pedidos/:numeroPedido inexistente responde 404', async () => {
    await request(app.getHttpServer())
      .get('/api/pedidos/PED-INEXISTENTE')
      .set('Authorization', `Bearer ${tokenOperador}`)
      .expect(404);
  });
});
