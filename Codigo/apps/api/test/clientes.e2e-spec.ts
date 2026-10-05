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

const CLIENTE = {
  nome: 'Cliente e2e',
  endereco: 'Rua Fixture, 123',
  cidade: 'Belo Horizonte',
  estado: 'MG',
  cep: '30130100',
  telefone: '(31) 99999-8888',
  latitude: -19.9325,
  longitude: -43.9382,
};

/** Cadastro de clientes (locais de obra) — exclusivo do gestor. */
describe('Clientes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fixturesCriadas: UsuarioFixture[] = [];
  const clientesCriados: number[] = [];
  let tokenGestor: string;
  let tokenRh: string;
  let tokenOperador: string;

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);
    tokenGestor = await login(app, await criarFixture(Perfil.GESTOR));
    tokenRh = await login(app, await criarFixture(Perfil.RH));
    tokenOperador = await login(app, await criarFixture(Perfil.DEPOSITO));
  });

  afterAll(async () => {
    await prisma.cliente.deleteMany({ where: { id: { in: clientesCriados } } });
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

  it('gestor cadastra, consulta e corrige o cliente, com CEP e telefone normalizados', async () => {
    const criado = await request(app.getHttpServer())
      .post('/api/clientes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send(CLIENTE)
      .expect(201);
    clientesCriados.push(criado.body.id);
    expect(criado.body).toMatchObject({ cep: '30130-100', telefone: '31999998888', latitude: -19.9325 });

    await request(app.getHttpServer())
      .put(`/api/clientes/${criado.body.id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ ...CLIENTE, endereco: 'Rua Corrigida, 50' })
      .expect(200);

    const detalhe = await request(app.getHttpServer())
      .get(`/api/clientes/${criado.body.id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .expect(200);
    expect(detalhe.body.endereco).toBe('Rua Corrigida, 50');
  });

  it('dados inválidos são barrados na borda (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/clientes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ ...CLIENTE, estado: 'XX', latitude: 200 })
      .expect(400);
  });

  it('RBAC: RH e operador não cadastram clientes', async () => {
    for (const token of [tokenRh, tokenOperador]) {
      await request(app.getHttpServer())
        .post('/api/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send(CLIENTE)
        .expect(403);
    }
  });
});
