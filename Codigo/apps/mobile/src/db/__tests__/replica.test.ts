import { Q } from '@nozbe/watermelondb';
import { syncPullFixture, TABELAS_SYNC } from '@montacontrol/shared';
import { criarBancoDeTeste, gravarPullNaReplica } from './apoio';
import { Jornada } from '../Jornada';
import { BancoHoras } from '../BancoHoras';
import { Pedido } from '../Pedido';
import { Ambiente } from '../Ambiente';
import { Peca } from '../Peca';
import { TipoAvaria } from '../TipoAvaria';
import { Avaria } from '../Avaria';
import { Atestado } from '../Atestado';

describe('réplica local — fixture do contrato de pull (#108)', () => {
  it('grava o fixture em todas as tabelas', async () => {
    const database = criarBancoDeTeste();

    await gravarPullNaReplica(database, syncPullFixture);

    for (const tabela of TABELAS_SYNC) {
      const { created, updated } = syncPullFixture.changes[tabela];
      const total = await database.get(tabela).query().fetchCount();
      expect(total).toBe(created.length + updated.length);
    }
  });

  it('jornada: id local é o do servidor e as colunas novas vêm do contrato', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const jornada = await database.get<Jornada>('jornadas').find('502');
    expect(jornada.usuarioId).toBe(7);
    expect(jornada.pedidoId).toBe('12');
    expect(jornada.status).toBe('EM_ANDAMENTO');
    expect(jornada.checkinIdCliente).toBe('0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a03');
    expect(jornada.checkoutIdCliente).toBeNull();
    expect(jornada.checkoutAt).toBeNull();
    expect(jornada.lancadoEmAtraso).toBe(false);

    const emAtraso = await database.get<Jornada>('jornadas').find('498');
    expect(emAtraso.pedidoId).toBeNull();
    expect(emAtraso.checkinLatitude).toBeNull();
    expect(emAtraso.lancadoEmAtraso).toBe(true);
  });

  it('jornada: consulta por pedido_id e checkin_at (colunas indexadas)', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const doPedido = await database.get<Jornada>('jornadas').query(Q.where('pedido_id', '12')).fetch();
    expect(doPedido.map((j) => j.id).sort()).toEqual(['501', '502']);

    const recentes = await database
      .get<Jornada>('jornadas')
      .query(Q.where('checkin_at', Q.gte('2026-10-16T00:00:00.000Z')))
      .fetch();
    expect(recentes.map((j) => j.id)).toEqual(['502']);
  });

  it('banco_horas: consulta por (mes, ano)', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const esperado = syncPullFixture.changes.banco_horas.updated[0];
    const achados = await database
      .get<BancoHoras>('banco_horas')
      .query(Q.where('mes', esperado.mes), Q.where('ano', esperado.ano))
      .fetch();
    expect(achados).toHaveLength(1);
    expect(achados[0].id).toBe(esperado.id);
    expect(achados[0].horasTrabalhadas).toBe(esperado.horas_trabalhadas);
    expect(achados[0].horasPrevistas).toBe(esperado.horas_previstas);
    expect(achados[0].saldo).toBe(esperado.saldo);
  });

  it('pedidos, ambientes e peças: colunas do contrato, incluindo nulos', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const pedidoEsperado = syncPullFixture.changes.pedidos.updated[0];
    const pedido = await database.get<Pedido>('pedidos').find(pedidoEsperado.id);
    expect(pedido.numeroPedido).toBe(pedidoEsperado.numero_pedido);
    expect(pedido.status).toBe(pedidoEsperado.status);
    expect(pedido.clienteId).toBe(pedidoEsperado.cliente_id);
    expect(pedido.clienteNome).toBe(pedidoEsperado.cliente_nome);
    expect(pedido.clienteEndereco).toBe(pedidoEsperado.cliente_endereco);
    expect(pedido.clienteCidade).toBe(pedidoEsperado.cliente_cidade);
    expect(pedido.clienteEstado).toBe(pedidoEsperado.cliente_estado);
    expect(pedido.clienteLatitude).toBe(pedidoEsperado.cliente_latitude);
    expect(pedido.clienteLongitude).toBe(pedidoEsperado.cliente_longitude);

    const ambienteEsperado = syncPullFixture.changes.ambientes.updated[0];
    const ambiente = await database.get<Ambiente>('ambientes').find(ambienteEsperado.id);
    expect(ambiente.pedidoId).toBe(ambienteEsperado.pedido_id);
    expect(ambiente.nome).toBe(ambienteEsperado.nome);
    expect(ambiente.status).toBe(ambienteEsperado.status);

    const semCodigo = syncPullFixture.changes.pecas.updated.find((p) => p.codigo_barras === null);
    expect(semCodigo).toBeDefined();
    const peca = await database.get<Peca>('pecas').find(semCodigo!.id);
    expect(peca.ambienteId).toBe(semCodigo!.ambiente_id);
    expect(peca.codigoBarras).toBeNull();
    expect(peca.descricao).toBe(semCodigo!.descricao);
    expect(peca.quantidade).toBe(semCodigo!.quantidade);
    expect(peca.status).toBe(semCodigo!.status);
  });

  it('tipos de avaria, avarias e atestados: colunas do contrato', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const tipoEsperado = syncPullFixture.changes.tipos_avaria.updated[0];
    const tipo = await database.get<TipoAvaria>('tipos_avaria').find(tipoEsperado.id);
    expect(tipo.nome).toBe(tipoEsperado.nome);
    expect(tipo.descricao).toBe(tipoEsperado.descricao);

    const avariaEsperada = syncPullFixture.changes.avarias.updated[0];
    const avaria = await database.get<Avaria>('avarias').find(avariaEsperada.id);
    expect(avaria.idCliente).toBe(avariaEsperada.id_cliente);
    expect(avaria.pecaId).toBe(avariaEsperada.peca_id);
    expect(avaria.pecaDescricao).toBe(avariaEsperada.peca_descricao);
    expect(avaria.ambienteNome).toBe(avariaEsperada.ambiente_nome);
    expect(avaria.numeroPedido).toBe(avariaEsperada.numero_pedido);
    expect(avaria.tipoAvariaId).toBe(avariaEsperada.tipo_avaria_id);
    expect(avaria.descricao).toBe(avariaEsperada.descricao);
    expect(avaria.status).toBe(avariaEsperada.status);
    expect(avaria.analisadaEm).toBe(avariaEsperada.analisada_em);
    expect(avaria.parecer).toBe(avariaEsperada.parecer);
    expect(avaria.criadoEm).toBe(avariaEsperada.criado_em);

    const atestadoEsperado = syncPullFixture.changes.atestados.updated[0];
    const atestado = await database.get<Atestado>('atestados').find(atestadoEsperado.id);
    expect(atestado.idCliente).toBe(atestadoEsperado.id_cliente);
    expect(atestado.dataInicio).toBe(atestadoEsperado.data_inicio);
    expect(atestado.dataFim).toBe(atestadoEsperado.data_fim);
    expect(atestado.observacao).toBe(atestadoEsperado.observacao);
    expect(atestado.status).toBe(atestadoEsperado.status);
    expect(atestado.motivoRejeicao).toBe(atestadoEsperado.motivo_rejeicao);
    expect(atestado.validadoEm).toBe(atestadoEsperado.validado_em);
    expect(atestado.criadoEm).toBe(atestadoEsperado.criado_em);
  });
});
