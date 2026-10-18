import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SYNC_SCHEMA_VERSION, TABELAS_SYNC } from '@montacontrol/shared';
import type { SyncPullResponse, TabelaSync } from '@montacontrol/shared';
import { Perfil, StatusAtestado, StatusAvaria, StatusJornada } from '../generated/prisma';
import { BancoHorasService } from '../src/banco-horas/banco-horas.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarApp } from './setup/criar-app';
import {
  apagarUsuariosFixture,
  criarUsuarioFixture,
  UsuarioFixture,
} from './fixtures/usuarios.fixture';

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const LATITUDE = -19.9325;
const LONGITUDE = -43.9382;

/** Linhas gravadas "há dois dias": fora da margem de segurança de qualquer pull feito agora. */
const ANTIGO = new Date(Date.now() - 2 * DIA_MS);
const haDias = (dias: number): Date => new Date(Date.now() - dias * DIA_MS);

async function login(app: INestApplication, usuario: UsuarioFixture): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: usuario.email, senha: usuario.senha })
    .expect(200);
  return resposta.body.accessToken as string;
}

/** Mês/ano de `n` meses atrás (UTC; a janela do banco de horas é de 3 meses, então não há folga crítica). */
function mesesAtras(n: number): { mes: number; ano: number } {
  const data = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - n, 1));
  return { mes: data.getUTCMonth() + 1, ano: data.getUTCFullYear() };
}

interface ObraSync {
  clienteId: number;
  pedidoId: number;
  ambienteId: number;
  pecaId: number;
}

describe('GET /api/sync/pull (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fixturesCriadas: UsuarioFixture[] = [];
  const obrasCriadas: ObraSync[] = [];
  let tipoAvariaId: number;
  let montadorA: UsuarioFixture;
  let montadorB: UsuarioFixture;
  let tokenA: string;
  let tokenB: string;
  let tokenGestor: string;
  let tokenRh: string;
  let tokenDeposito: string;
  let obraA: ObraSync;
  let obraB: ObraSync;
  const idsA: Record<string, number> = {};
  const idsB: Record<string, number> = {};

  const consultar = (token: string | null, consulta: string) => {
    const requisicao = request(app.getHttpServer()).get(`/api/sync/pull?${consulta}`);
    return token ? requisicao.set('Authorization', `Bearer ${token}`) : requisicao;
  };

  const puxar = async (token: string, lastPulledAt?: number): Promise<SyncPullResponse> => {
    const consulta =
      `schemaVersion=${SYNC_SCHEMA_VERSION}` +
      (lastPulledAt === undefined ? '' : `&lastPulledAt=${lastPulledAt}`);
    const resposta = await consultar(token, consulta).expect(200);
    return resposta.body as SyncPullResponse;
  };

  const atualizados = (resposta: SyncPullResponse, tabela: TabelaSync): string[] =>
    (resposta.changes[tabela].updated as Array<{ id: string }>).map((linha) => linha.id);

  async function criarFixture(perfil: Perfil, nome?: string): Promise<UsuarioFixture> {
    const fixture = await criarUsuarioFixture(app, { perfil, nome });
    fixturesCriadas.push(fixture);
    return fixture;
  }

  /** Obra com atribuição, ambiente e peça, tudo datado de dois dias atrás. */
  async function criarObra(montadorIds: number[]): Promise<ObraSync> {
    const cliente = await prisma.cliente.create({
      data: {
        nome: 'Cliente Sync e2e',
        endereco: 'Rua Sync, 10',
        cidade: 'Belo Horizonte',
        estado: 'MG',
        cep: '30000-000',
        latitude: LATITUDE,
        longitude: LONGITUDE,
        telefone: '31999999999',
        createdAt: ANTIGO,
        updatedAt: ANTIGO,
      },
    });
    const pedido = await prisma.pedido.create({
      data: {
        clienteId: cliente.id,
        numeroPedido: `PED-SYNC-${randomUUID()}`,
        createdAt: ANTIGO,
        updatedAt: ANTIGO,
        montadores: {
          create: montadorIds.map((usuarioId) => ({ usuarioId, createdAt: ANTIGO })),
        },
      },
    });
    const ambiente = await prisma.ambiente.create({
      data: { pedidoId: pedido.id, nome: 'Cozinha', updatedAt: ANTIGO },
    });
    const peca = await prisma.peca.create({
      data: {
        ambienteId: ambiente.id,
        itemId: 0,
        descricao: 'Armário aéreo',
        quantidade: 2,
        createdAt: ANTIGO,
        updatedAt: ANTIGO,
      },
    });
    const obra = {
      clienteId: cliente.id,
      pedidoId: pedido.id,
      ambienteId: ambiente.id,
      pecaId: peca.id,
    };
    obrasCriadas.push(obra);
    return obra;
  }

  async function apagarObra(obra: ObraSync): Promise<void> {
    await prisma.syncExclusao.deleteMany({
      where: {
        OR: [
          { entidade: 'pedidos', registroId: String(obra.pedidoId) },
          { entidade: 'ambientes', registroId: String(obra.ambienteId) },
          { entidade: 'pecas', registroId: String(obra.pecaId) },
        ],
      },
    });
    await prisma.avaria.deleteMany({ where: { pecaId: obra.pecaId } });
    await prisma.peca.deleteMany({ where: { ambienteId: obra.ambienteId } });
    await prisma.ambiente.deleteMany({ where: { pedidoId: obra.pedidoId } });
    await prisma.jornada.updateMany({
      where: { pedidoId: obra.pedidoId },
      data: { pedidoId: null },
    });
    await prisma.pedidoMontador.deleteMany({ where: { pedidoId: obra.pedidoId } });
    await prisma.pedido.delete({ where: { id: obra.pedidoId } });
    await prisma.cliente.delete({ where: { id: obra.clienteId } });
  }

  /** Dados do montador: um item de cada tabela dentro da janela e outro fora dela. */
  async function popularMontador(
    montador: UsuarioFixture,
    obra: ObraSync,
    marcador: string,
    ids: Record<string, number>,
  ): Promise<void> {
    const usuarioId = montador.usuarioId;
    const jornada = await prisma.jornada.create({
      data: {
        usuarioId,
        pedidoId: obra.pedidoId,
        status: StatusJornada.FINALIZADA,
        checkinIdCliente: randomUUID(),
        checkinLatitude: LATITUDE,
        checkinLongitude: LONGITUDE,
        checkinEndereco: `${marcador} checkin`,
        checkinAt: haDias(3),
        checkoutIdCliente: randomUUID(),
        checkoutLatitude: LATITUDE,
        checkoutLongitude: LONGITUDE,
        checkoutAt: new Date(haDias(3).getTime() + 8 * HORA_MS),
        createdAt: haDias(3),
        updatedAt: ANTIGO,
      },
    });
    const atrasada = await prisma.jornada.create({
      data: {
        usuarioId,
        status: StatusJornada.FINALIZADA,
        checkinAt: haDias(5),
        checkoutAt: new Date(haDias(5).getTime() + 8 * HORA_MS),
        createdAt: haDias(5),
        updatedAt: ANTIGO,
      },
    });
    await prisma.solicitacaoPonto.create({
      data: {
        usuarioId,
        idCliente: randomUUID(),
        data: haDias(5),
        inicio: haDias(5),
        fim: new Date(haDias(5).getTime() + 8 * HORA_MS),
        minutosSolicitados: 480,
        justificativa: `${marcador} justificativa`,
        status: 'APROVADA',
        jornadaId: atrasada.id,
      },
    });
    const jornadaAntiga = await prisma.jornada.create({
      data: {
        usuarioId,
        status: StatusJornada.FINALIZADA,
        checkinAt: haDias(40),
        checkoutAt: new Date(haDias(40).getTime() + 8 * HORA_MS),
        createdAt: haDias(40),
        updatedAt: ANTIGO,
      },
    });
    const antigo = mesesAtras(6);
    // Linha do mês corrente já no valor que o pull calcularia (o pull recalcula o mês corrente
    // do montador): só muda se algo mudar de verdade, e fica datada de dois dias atrás.
    const banco = await app.get(BancoHorasService).calcular(usuarioId);
    await prisma.bancoHoras.update({ where: { id: banco.id }, data: { updatedAt: ANTIGO } });
    const bancoAntigo = await prisma.bancoHoras.create({
      data: {
        usuarioId,
        ...antigo,
        horasTrabalhadas: 100,
        horasPrevistas: 100,
        saldo: 0,
        updatedAt: ANTIGO,
      },
    });
    const atestado = await prisma.atestado.create({
      data: {
        usuarioId,
        idCliente: randomUUID(),
        dataInicio: new Date('2026-09-22T00:00:00.000Z'),
        dataFim: new Date('2026-09-23T00:00:00.000Z'),
        observacao: `${marcador} atestado`,
        createdAt: haDias(10),
        updatedAt: ANTIGO,
      },
    });
    const atestadoAntigo = await prisma.atestado.create({
      data: {
        usuarioId,
        idCliente: randomUUID(),
        dataInicio: new Date('2026-05-01T00:00:00.000Z'),
        dataFim: new Date('2026-05-01T00:00:00.000Z'),
        createdAt: haDias(100),
        updatedAt: ANTIGO,
      },
    });
    const avaria = await prisma.avaria.create({
      data: {
        pecaId: obra.pecaId,
        tipoAvariaId,
        registradaPor: usuarioId,
        idCliente: randomUUID(),
        descricao: `${marcador} avaria`,
        status: StatusAvaria.REPORTADA,
        createdAt: haDias(2),
        updatedAt: ANTIGO,
      },
    });
    const avariaAntiga = await prisma.avaria.create({
      data: {
        pecaId: obra.pecaId,
        tipoAvariaId,
        registradaPor: usuarioId,
        descricao: `${marcador} avaria antiga`,
        createdAt: haDias(40),
        updatedAt: ANTIGO,
      },
    });
    Object.assign(ids, {
      jornada: jornada.id,
      atrasada: atrasada.id,
      jornadaAntiga: jornadaAntiga.id,
      banco: banco.id,
      bancoAntigo: bancoAntigo.id,
      atestado: atestado.id,
      atestadoAntigo: atestadoAntigo.id,
      avaria: avaria.id,
      avariaAntiga: avariaAntiga.id,
    });
  }

  beforeAll(async () => {
    app = await criarApp();
    prisma = app.get(PrismaService);

    montadorA = await criarFixture(Perfil.MONTADOR, 'Montador A Sync');
    montadorB = await criarFixture(Perfil.MONTADOR, 'Montador B Sync');
    const gestor = await criarFixture(Perfil.GESTOR);
    const rh = await criarFixture(Perfil.RH);
    const deposito = await criarFixture(Perfil.DEPOSITO);
    tokenA = await login(app, montadorA);
    tokenB = await login(app, montadorB);
    tokenGestor = await login(app, gestor);
    tokenRh = await login(app, rh);
    tokenDeposito = await login(app, deposito);

    const tipo = await prisma.tipoAvaria.create({
      data: {
        nome: `Tipo Sync e2e ${randomUUID()}`,
        descricao: 'Criado pelo e2e do pull.',
        createdAt: ANTIGO,
        updatedAt: ANTIGO,
      },
    });
    tipoAvariaId = tipo.id;

    obraA = await criarObra([montadorA.usuarioId]);
    obraB = await criarObra([montadorB.usuarioId]);
    await popularMontador(montadorA, obraA, 'segredo-A', idsA);
    await popularMontador(montadorB, obraB, 'segredo-B', idsB);
  });

  afterAll(async () => {
    try {
      // Usuários primeiro: apagam jornadas, avarias, atestados, banco e tombstones deles.
      await apagarUsuariosFixture(app, fixturesCriadas);
      for (const obra of obrasCriadas) await apagarObra(obra);
      await prisma.tipoAvaria.deleteMany({ where: { id: tipoAvariaId } });
    } finally {
      await app.close();
    }
  });

  describe('autenticação e autorização', () => {
    it('sem token → 401', async () => {
      await consultar(null, `schemaVersion=${SYNC_SCHEMA_VERSION}`).expect(401);
    });

    it.each([
      ['GESTOR', () => tokenGestor],
      ['RH', () => tokenRh],
      ['DEPOSITO', () => tokenDeposito],
    ])('perfil %s → 403', async (_perfil, token) => {
      await consultar(token(), `schemaVersion=${SYNC_SCHEMA_VERSION}`).expect(403);
    });
  });

  describe('validação da query', () => {
    it.each([
      ['sem schemaVersion', ''],
      ['schemaVersion não numérico', 'schemaVersion=abc'],
      ['schemaVersion decimal', 'schemaVersion=2.5'],
      ['schemaVersion vazio', 'schemaVersion='],
      ['lastPulledAt negativo', `schemaVersion=${SYNC_SCHEMA_VERSION}&lastPulledAt=-1`],
      ['lastPulledAt não numérico', `schemaVersion=${SYNC_SCHEMA_VERSION}&lastPulledAt=abc`],
      ['lastPulledAt decimal', `schemaVersion=${SYNC_SCHEMA_VERSION}&lastPulledAt=1.5`],
      [
        'lastPulledAt fora do intervalo de datas',
        `schemaVersion=${SYNC_SCHEMA_VERSION}&lastPulledAt=9000000000000000`,
      ],
      ['parâmetro desconhecido', `schemaVersion=${SYNC_SCHEMA_VERSION}&usuarioId=1`],
    ])('%s → 400', async (_caso, consulta) => {
      await consultar(tokenA, consulta).expect(400);
    });

    it('lastPulledAt vazio é tratado como ausente (primeiro pull)', async () => {
      const resposta = await consultar(
        tokenA,
        `schemaVersion=${SYNC_SCHEMA_VERSION}&lastPulledAt=`,
      ).expect(200);

      expect(resposta.body.changes.jornadas.deleted).toEqual([]);
    });

    it.each([SYNC_SCHEMA_VERSION - 1, SYNC_SCHEMA_VERSION + 1, 999])(
      'schemaVersion %i incompatível → 426 VERSAO_SCHEMA_INCOMPATIVEL',
      async (versao) => {
        const resposta = await consultar(tokenA, `schemaVersion=${versao}`).expect(426);

        expect(resposta.body.codigo).toBe('VERSAO_SCHEMA_INCOMPATIVEL');
      },
    );
  });

  describe('primeiro pull', () => {
    it('devolve a réplica do montador dentro das janelas, sem created nem deleted', async () => {
      const antes = Date.now();
      const resposta = await puxar(tokenA);
      const depois = Date.now();

      expect(resposta.timestamp).toBeGreaterThanOrEqual(antes - 1000);
      expect(resposta.timestamp).toBeLessThanOrEqual(depois + 1000);
      for (const tabela of TABELAS_SYNC) {
        expect(resposta.changes[tabela].created).toEqual([]);
        expect(resposta.changes[tabela].deleted).toEqual([]);
      }

      const { changes } = resposta;
      expect(atualizados(resposta, 'pedidos')).toEqual([String(obraA.pedidoId)]);
      expect(atualizados(resposta, 'ambientes')).toEqual([String(obraA.ambienteId)]);
      expect(atualizados(resposta, 'pecas')).toEqual([String(obraA.pecaId)]);
      expect(atualizados(resposta, 'jornadas').sort()).toEqual(
        [String(idsA.jornada), String(idsA.atrasada)].sort(),
      );
      expect(atualizados(resposta, 'banco_horas')).toEqual([String(idsA.banco)]);
      expect(atualizados(resposta, 'atestados')).toEqual([String(idsA.atestado)]);
      expect(atualizados(resposta, 'avarias')).toEqual([String(idsA.avaria)]);
      expect(atualizados(resposta, 'tipos_avaria')).toContain(String(tipoAvariaId));

      expect(changes.pedidos.updated[0]).toMatchObject({
        id: String(obraA.pedidoId),
        status: 'AGUARDANDO',
        cliente_id: String(obraA.clienteId),
        cliente_nome: 'Cliente Sync e2e',
        cliente_endereco: 'Rua Sync, 10',
        cliente_cidade: 'Belo Horizonte',
        cliente_estado: 'MG',
        cliente_latitude: LATITUDE,
        cliente_longitude: LONGITUDE,
      });
      expect(changes.ambientes.updated[0]).toMatchObject({
        pedido_id: String(obraA.pedidoId),
        nome: 'Cozinha',
        status: 'PENDENTE',
      });
      expect(changes.pecas.updated[0]).toMatchObject({
        ambiente_id: String(obraA.ambienteId),
        codigo_barras: null,
        descricao: 'Armário aéreo',
        quantidade: 2,
      });
      const bancoGravado = await prisma.bancoHoras.findUniqueOrThrow({ where: { id: idsA.banco } });
      expect(changes.banco_horas.updated[0]).toMatchObject({
        id: String(idsA.banco),
        horas_trabalhadas: bancoGravado.horasTrabalhadas.toNumber(),
        horas_previstas: bancoGravado.horasPrevistas.toNumber(),
        saldo: bancoGravado.saldo.toNumber(),
      });
      expect(changes.avarias.updated[0]).toMatchObject({
        peca_id: String(obraA.pecaId),
        peca_descricao: 'Armário aéreo',
        ambiente_nome: 'Cozinha',
        tipo_avaria_id: String(tipoAvariaId),
        descricao: 'segredo-A avaria',
        status: 'REPORTADA',
        analisada_em: null,
        parecer: null,
      });
      expect(changes.avarias.updated[0].numero_pedido).toMatch(/^PED-SYNC-/);
      expect(changes.atestados.updated[0]).toMatchObject({
        data_inicio: '2026-09-22',
        data_fim: '2026-09-23',
        observacao: 'segredo-A atestado',
        status: StatusAtestado.PENDENTE,
        motivo_rejeicao: null,
        validado_em: null,
      });
    });

    it('jornada: dados do check-in e marca de ponto em atraso', async () => {
      const { changes } = await puxar(tokenA);
      const porId = new Map(changes.jornadas.updated.map((linha) => [linha.id, linha]));

      expect(porId.get(String(idsA.jornada))).toMatchObject({
        usuario_id: montadorA.usuarioId,
        pedido_id: String(obraA.pedidoId),
        status: 'FINALIZADA',
        checkin_latitude: LATITUDE,
        checkin_longitude: LONGITUDE,
        checkin_endereco: 'segredo-A checkin',
        lancado_em_atraso: false,
      });
      expect(porId.get(String(idsA.jornada))?.checkin_id_cliente).toEqual(expect.any(String));
      expect(porId.get(String(idsA.jornada))?.checkout_id_cliente).toEqual(expect.any(String));
      expect(porId.get(String(idsA.atrasada))).toMatchObject({
        pedido_id: null,
        checkin_latitude: null,
        checkin_id_cliente: null,
        lancado_em_atraso: true,
      });
    });

    it('não devolve linhas fora das janelas (jornada 30d, avaria 30d, atestado 90d, banco de horas 3 meses)', async () => {
      const resposta = await puxar(tokenA);

      expect(atualizados(resposta, 'jornadas')).not.toContain(String(idsA.jornadaAntiga));
      expect(atualizados(resposta, 'avarias')).not.toContain(String(idsA.avariaAntiga));
      expect(atualizados(resposta, 'atestados')).not.toContain(String(idsA.atestadoAntigo));
      expect(atualizados(resposta, 'banco_horas')).not.toContain(String(idsA.bancoAntigo));
    });

    it('lastPulledAt=0 equivale ao primeiro pull', async () => {
      const resposta = await puxar(tokenA, 0);

      expect(atualizados(resposta, 'pedidos')).toEqual([String(obraA.pedidoId)]);
      expect(resposta.changes.pedidos.deleted).toEqual([]);
    });
  });

  describe('escopo: nunca devolve dados de outro montador', () => {
    it('montador A e B recebem só o que é deles', async () => {
      const respostaA = await puxar(tokenA);
      const respostaB = await puxar(tokenB);

      expect(atualizados(respostaB, 'pedidos')).toEqual([String(obraB.pedidoId)]);
      expect(atualizados(respostaB, 'ambientes')).toEqual([String(obraB.ambienteId)]);
      expect(atualizados(respostaB, 'pecas')).toEqual([String(obraB.pecaId)]);
      expect(atualizados(respostaB, 'jornadas')).toEqual(
        expect.arrayContaining([String(idsB.jornada), String(idsB.atrasada)]),
      );
      expect(atualizados(respostaB, 'atestados')).toEqual([String(idsB.atestado)]);
      expect(atualizados(respostaB, 'avarias')).toEqual([String(idsB.avaria)]);
      expect(atualizados(respostaB, 'banco_horas')).toEqual([String(idsB.banco)]);

      const textoA = JSON.stringify(respostaA);
      const textoB = JSON.stringify(respostaB);
      expect(textoA).not.toContain('segredo-B');
      expect(textoB).not.toContain('segredo-A');
      expect(textoA).not.toContain(`"usuario_id":${montadorB.usuarioId}`);
      expect(textoB).not.toContain(`"usuario_id":${montadorA.usuarioId}`);
      for (const linha of respostaA.changes.jornadas.updated) {
        expect(linha.usuario_id).toBe(montadorA.usuarioId);
      }
    });

    it('avaria de outro montador na peça do pedido de A não aparece para A', async () => {
      const intrusa = await prisma.avaria.create({
        data: {
          pecaId: obraA.pecaId,
          tipoAvariaId,
          registradaPor: montadorB.usuarioId,
          descricao: 'segredo-B avaria na peça do A',
          createdAt: haDias(1),
          updatedAt: ANTIGO,
        },
      });

      const resposta = await puxar(tokenA);

      expect(atualizados(resposta, 'avarias')).not.toContain(String(intrusa.id));
      expect(JSON.stringify(resposta)).not.toContain('segredo-B');
    });

    it('pedido só vinculado por jornada (sem atribuição) não entra na réplica', async () => {
      // A jornada de A aponta para a obra de B, mas A não está atribuído a ela.
      const jornada = await prisma.jornada.create({
        data: {
          usuarioId: montadorA.usuarioId,
          pedidoId: obraB.pedidoId,
          status: StatusJornada.FINALIZADA,
          checkinAt: haDias(1),
          checkoutAt: new Date(haDias(1).getTime() + 8 * HORA_MS),
          createdAt: haDias(1),
          updatedAt: ANTIGO,
        },
      });

      const resposta = await puxar(tokenA);

      expect(atualizados(resposta, 'jornadas')).toContain(String(jornada.id));
      expect(atualizados(resposta, 'pedidos')).not.toContain(String(obraB.pedidoId));
      expect(atualizados(resposta, 'pecas')).not.toContain(String(obraB.pecaId));
    });
  });

  describe('pull incremental', () => {
    it('sem mudanças depois de lastPulledAt (com a margem) devolve tudo vazio', async () => {
      const futuro = Date.now() + HORA_MS;

      const resposta = await puxar(tokenA, futuro);

      for (const tabela of TABELAS_SYNC) {
        expect(resposta.changes[tabela]).toEqual({ created: [], updated: [], deleted: [] });
      }
    });

    it('linhas gravadas há mais que a margem de segurança antes de lastPulledAt não voltam', async () => {
      const primeiro = await puxar(tokenA);

      const resposta = await puxar(tokenA, primeiro.timestamp);

      // As linhas do montador A foram datadas de dois dias atrás; só mudanças de outros testes podem aparecer.
      expect(atualizados(resposta, 'pedidos')).not.toContain(String(obraA.pedidoId));
      expect(atualizados(resposta, 'atestados')).not.toContain(String(idsA.atestado));
      // O mês corrente é recalculado a cada pull (e o teste anterior pode ter mexido nas jornadas
      // de A), então só o mês antigo, que ninguém tocou, prova que linha intocada não volta.
      expect(atualizados(resposta, 'banco_horas')).not.toContain(String(idsA.bancoAntigo));
    });

    it('check-in feito depois do timestamp aparece no pull seguinte', async () => {
      const primeiro = await puxar(tokenA);
      const jornadasAntes = atualizados(primeiro, 'jornadas');

      const checkin = await request(app.getHttpServer())
        .post('/api/jornadas/checkin')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          idCliente: randomUUID(),
          latitude: LATITUDE,
          longitude: LONGITUDE,
          registradoEm: new Date().toISOString(),
          pedidoId: obraA.pedidoId,
        })
        .expect(201);
      const novaJornadaId = String(checkin.body.id);

      const seguinte = await puxar(tokenA, primeiro.timestamp);

      expect(jornadasAntes).not.toContain(novaJornadaId);
      expect(atualizados(seguinte, 'jornadas')).toEqual([novaJornadaId]);
      expect(seguinte.changes.jornadas.updated[0]).toMatchObject({
        usuario_id: montadorA.usuarioId,
        pedido_id: String(obraA.pedidoId),
        status: 'EM_ANDAMENTO',
        checkout_at: null,
        lancado_em_atraso: false,
      });
      expect(seguinte.timestamp).toBeGreaterThanOrEqual(primeiro.timestamp);

      // Encerra a jornada para não atrapalhar os demais testes do montador A.
      await request(app.getHttpServer())
        .post('/api/jornadas/checkout')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          idCliente: randomUUID(),
          latitude: LATITUDE,
          longitude: LONGITUDE,
          registradoEm: new Date().toISOString(),
        })
        .expect(200);

      const aposCheckout = await puxar(tokenA, seguinte.timestamp);
      expect(aposCheckout.changes.jornadas.updated).toEqual([
        expect.objectContaining({ id: novaJornadaId, status: 'FINALIZADA' }),
      ]);
    });

    it('alterações em pedido, cliente, ambiente, peça, catálogo, atestado e avaria chegam como updated', async () => {
      const primeiro = await puxar(tokenA);

      await prisma.cliente.update({
        where: { id: obraA.clienteId },
        data: { nome: 'Cliente Renomeado' },
      });
      await prisma.ambiente.update({
        where: { id: obraA.ambienteId },
        data: { status: 'EM_PROGRESSO' },
      });
      await prisma.peca.update({
        where: { id: obraA.pecaId },
        data: { status: 'TRIADA', codigoBarras: `7890${Date.now()}` },
      });
      await prisma.tipoAvaria.update({
        where: { id: tipoAvariaId },
        data: { nome: 'Tipo Renomeado' },
      });
      await prisma.atestado.update({
        where: { id: idsA.atestado },
        data: {
          status: StatusAtestado.REJEITADO,
          motivoRejeicao: 'Ilegível',
          validadoAt: new Date(),
        },
      });
      await prisma.avaria.update({
        where: { id: idsA.avaria },
        data: { status: StatusAvaria.EM_ANALISE, parecer: 'Analisando' },
      });

      const seguinte = await puxar(tokenA, primeiro.timestamp);

      expect(seguinte.changes.pedidos.updated).toEqual([
        expect.objectContaining({ id: String(obraA.pedidoId), cliente_nome: 'Cliente Renomeado' }),
      ]);
      expect(seguinte.changes.ambientes.updated).toEqual([
        expect.objectContaining({ id: String(obraA.ambienteId), status: 'EM_PROGRESSO' }),
      ]);
      expect(seguinte.changes.pecas.updated).toEqual([
        expect.objectContaining({ id: String(obraA.pecaId), status: 'TRIADA' }),
      ]);
      expect(seguinte.changes.pecas.updated[0].codigo_barras).toMatch(/^7890/);
      expect(seguinte.changes.tipos_avaria.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: String(tipoAvariaId), nome: 'Tipo Renomeado' }),
        ]),
      );
      expect(seguinte.changes.atestados.updated).toEqual([
        expect.objectContaining({
          id: String(idsA.atestado),
          status: 'REJEITADO',
          motivo_rejeicao: 'Ilegível',
        }),
      ]);
      expect(seguinte.changes.avarias.updated).toEqual([
        expect.objectContaining({
          id: String(idsA.avaria),
          status: 'EM_ANALISE',
          parecer: 'Analisando',
        }),
      ]);
    });
  });

  describe('linhas antigas que mudaram', () => {
    it('avaria, jornada, atestado e banco de horas fora da janela do primeiro pull chegam no incremental', async () => {
      const primeiro = await puxar(tokenA);
      expect(atualizados(primeiro, 'avarias')).not.toContain(String(idsA.avariaAntiga));

      // Avaria criada há 40 dias e analisada agora: o aparelho não pode ficar com REPORTADA.
      await prisma.avaria.update({
        where: { id: idsA.avariaAntiga },
        data: { status: StatusAvaria.RESOLVIDA, parecer: 'Resolvida tardiamente' },
      });
      await prisma.jornada.update({
        where: { id: idsA.jornadaAntiga },
        data: { checkoutEndereco: 'Endereço corrigido' },
      });
      await prisma.atestado.update({
        where: { id: idsA.atestadoAntigo },
        data: { status: StatusAtestado.VALIDADO, validadoAt: new Date() },
      });
      await prisma.bancoHoras.update({ where: { id: idsA.bancoAntigo }, data: { saldo: 5 } });

      const seguinte = await puxar(tokenA, primeiro.timestamp);

      expect(seguinte.changes.avarias.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: String(idsA.avariaAntiga),
            status: 'RESOLVIDA',
            parecer: 'Resolvida tardiamente',
          }),
        ]),
      );
      expect(seguinte.changes.jornadas.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: String(idsA.jornadaAntiga),
            checkout_endereco: 'Endereço corrigido',
          }),
        ]),
      );
      expect(seguinte.changes.atestados.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: String(idsA.atestadoAntigo), status: 'VALIDADO' }),
        ]),
      );
      expect(seguinte.changes.banco_horas.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: String(idsA.bancoAntigo), saldo: 5 }),
        ]),
      );
    });
  });

  describe('saldo do mês corrente', () => {
    let montadorC: UsuarioFixture;
    let tokenC: string;
    let obraC: ObraSync;

    const linhaDoMes = async () => {
      const atual = await app.get(BancoHorasService).calcularSemPersistir(montadorC.usuarioId);
      return prisma.bancoHoras.findUniqueOrThrow({
        where: {
          usuarioId_mes_ano: { usuarioId: montadorC.usuarioId, mes: atual.mes, ano: atual.ano },
        },
      });
    };

    const registrarPonto = (rota: 'checkin' | 'checkout', registradoEm: Date) =>
      request(app.getHttpServer())
        .post(`/api/jornadas/${rota}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          idCliente: randomUUID(),
          latitude: LATITUDE,
          longitude: LONGITUDE,
          registradoEm: registradoEm.toISOString(),
          ...(rota === 'checkin' ? { pedidoId: obraC.pedidoId } : {}),
        });

    beforeAll(async () => {
      montadorC = await criarFixture(Perfil.MONTADOR, 'Montador C Sync');
      tokenC = await login(app, montadorC);
      obraC = await criarObra([montadorC.usuarioId]);
    });

    it('check-in e check-out feitos depois do último pull chegam no pull seguinte com o saldo recalculado', async () => {
      const primeiro = await puxar(tokenC);
      const linhasPrimeiro = primeiro.changes.banco_horas.updated;
      expect(linhasPrimeiro).toHaveLength(1);
      expect(linhasPrimeiro[0].horas_trabalhadas).toBe(0);

      await registrarPonto('checkin', new Date(Date.now() - 90 * 60 * 1000)).expect(201);
      await registrarPonto('checkout', new Date()).expect(200);

      const seguinte = await puxar(tokenC, primeiro.timestamp);

      expect(seguinte.changes.banco_horas.updated).toEqual([
        expect.objectContaining({
          id: linhasPrimeiro[0].id,
          horas_trabalhadas: 1.5,
          horas_previstas: linhasPrimeiro[0].horas_previstas,
          saldo: Math.round((linhasPrimeiro[0].saldo + 1.5) * 100) / 100,
        }),
      ]);
    });

    it('pull sem mudanças no mês não regrava a linha (updated_at e calculado_at intactos)', async () => {
      const antes = await linhaDoMes();

      await puxar(tokenC, Date.now());
      await puxar(tokenC);

      const depois = await linhaDoMes();
      expect(depois.updatedAt).toEqual(antes.updatedAt);
      expect(depois.calculadoAt).toEqual(antes.calculadoAt);
    });

    it('o pull de um montador não recalcula o mês de outro', async () => {
      const antes = await linhaDoMes();
      await prisma.jornada.create({
        data: {
          usuarioId: montadorC.usuarioId,
          status: StatusJornada.FINALIZADA,
          checkinAt: new Date(Date.now() - 4 * HORA_MS),
          checkoutAt: new Date(Date.now() - 2 * HORA_MS),
        },
      });

      await puxar(tokenA);

      const depois = await linhaDoMes();
      expect(depois.horasTrabalhadas.toNumber()).toBe(antes.horasTrabalhadas.toNumber());
      expect(depois.updatedAt).toEqual(antes.updatedAt);

      // O pull do próprio dono, sim, recalcula.
      const proprio = await puxar(tokenC);
      expect(proprio.changes.banco_horas.updated[0].horas_trabalhadas).toBe(
        antes.horasTrabalhadas.toNumber() + 2,
      );
    });
  });

  describe('exclusões (desalocação)', () => {
    it('desalocar o montador manda o pedido, os ambientes e as peças em deleted só para ele; reatribuir não os apaga', async () => {
      const obraC = await criarObra([montadorA.usuarioId, montadorB.usuarioId]);
      const pedidoC = String(obraC.pedidoId);
      const ambienteC = String(obraC.ambienteId);
      const pecaC = String(obraC.pecaId);

      const primeiroA = await puxar(tokenA);
      const primeiroB = await puxar(tokenB);
      expect(atualizados(primeiroA, 'pedidos')).toContain(pedidoC);
      expect(atualizados(primeiroB, 'pedidos')).toContain(pedidoC);

      // Gestor tira o montador A da obra.
      await request(app.getHttpServer())
        .put(`/api/pedidos/${obraC.pedidoId}/montadores`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ usuarioIds: [montadorB.usuarioId] })
        .expect(200);

      const aposSaida = await puxar(tokenA, primeiroA.timestamp);
      expect(aposSaida.changes.pedidos.deleted).toContain(pedidoC);
      expect(aposSaida.changes.ambientes.deleted).toContain(ambienteC);
      expect(aposSaida.changes.pecas.deleted).toContain(pecaC);
      expect(atualizados(aposSaida, 'pedidos')).not.toContain(pedidoC);

      // O montador B, que ficou, não recebe a exclusão.
      const aposSaidaB = await puxar(tokenB, primeiroB.timestamp);
      expect(aposSaidaB.changes.pedidos.deleted).not.toContain(pedidoC);
      expect(aposSaidaB.changes.ambientes.deleted).not.toContain(ambienteC);
      expect(aposSaidaB.changes.pecas.deleted).not.toContain(pecaC);

      // Gestor reatribui A: tombstone antigo e nova atribuição caem depois do mesmo lastPulledAt.
      await request(app.getHttpServer())
        .put(`/api/pedidos/${obraC.pedidoId}/montadores`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ usuarioIds: [montadorA.usuarioId, montadorB.usuarioId] })
        .expect(200);

      const aposVolta = await puxar(tokenA, primeiroA.timestamp);
      expect(atualizados(aposVolta, 'pedidos')).toContain(pedidoC);
      expect(atualizados(aposVolta, 'ambientes')).toContain(ambienteC);
      expect(atualizados(aposVolta, 'pecas')).toContain(pecaC);
      expect(aposVolta.changes.pedidos.deleted).not.toContain(pedidoC);
      expect(aposVolta.changes.ambientes.deleted).not.toContain(ambienteC);
      expect(aposVolta.changes.pecas.deleted).not.toContain(pecaC);
    });

    it('pedido antigo atribuído depois de lastPulledAt chega com seus ambientes e peças', async () => {
      const primeiro = await puxar(tokenB);
      const obraD = await criarObra([montadorA.usuarioId]); // tudo datado de 2 dias atrás

      await request(app.getHttpServer())
        .put(`/api/pedidos/${obraD.pedidoId}/montadores`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({ usuarioIds: [montadorA.usuarioId, montadorB.usuarioId] })
        .expect(200);

      const seguinte = await puxar(tokenB, primeiro.timestamp);

      expect(atualizados(seguinte, 'pedidos')).toContain(String(obraD.pedidoId));
      expect(atualizados(seguinte, 'ambientes')).toContain(String(obraD.ambienteId));
      expect(atualizados(seguinte, 'pecas')).toContain(String(obraD.pecaId));
    });
  });
});
