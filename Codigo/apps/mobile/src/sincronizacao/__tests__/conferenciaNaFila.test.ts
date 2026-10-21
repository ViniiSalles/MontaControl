jest.mock('../../conferencia/clienteConferencia', () => ({ enviarConferencia: jest.fn() }));

import { Q } from '@nozbe/watermelondb';
import { ErroApi } from '../../http/erroApi';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { enviarConferencia } from '../../conferencia/clienteConferencia';
import type { PayloadConferenciaNaFila } from '../../conferencia/conferencia';
import { executarAcaoConferencia } from '../outbox';
import { drenarFila } from '../syncManager';

const enviarMock = jest.mocked(enviarConferencia);

const PAYLOAD: PayloadConferenciaNaFila = {
  idCliente: 'id-leitura-1',
  pedidoId: 3,
  codigoBarras: 'COD-123',
  lidaEm: '2026-10-19T12:00:00.000Z',
};

async function fila(database: ReturnType<typeof criarBancoDeTeste>, status: string) {
  return database.get<AcaoPendente>('acoes_pendentes').query(Q.where('status', status)).fetch();
}

beforeEach(() => jest.clearAllMocks());

describe('executarAcaoConferencia', () => {
  it('online: envia e fica `enviada` até o pull trazer a peça', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockResolvedValue({ resultado: 'CONFERIDA' });

    expect(await executarAcaoConferencia(database, PAYLOAD)).toEqual({ tipo: 'enviada' });
    expect(enviarMock).toHaveBeenCalledWith(PAYLOAD);
    expect(await fila(database, 'enviada')).toHaveLength(1);
  });

  it('N4T3 — sem rede: a leitura fica pendente na fila', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockRejectedValue(new TypeError('Network request failed'));

    expect(await executarAcaoConferencia(database, PAYLOAD)).toEqual({ tipo: 'pendente' });
    const pendentes = await fila(database, 'pendente');
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tipo).toBe('conferencia');
    expect(JSON.parse(pendentes[0].payload)).toEqual(PAYLOAD);
  });

  it('recusa do servidor: sai da fila e devolve a mensagem', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockRejectedValue(new ErroApi('ERRO', 'Pedido não encontrado', 404));

    expect(await executarAcaoConferencia(database, PAYLOAD)).toEqual({
      tipo: 'recusado',
      codigo: 'ERRO',
      mensagem: 'Pedido não encontrado',
    });
    expect(await fila(database, 'pendente')).toHaveLength(0);
  });
});

describe('drenarFila com leitura de peça', () => {
  it('TI05: a leitura feita offline sobe quando a conexão volta', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await executarAcaoConferencia(database, PAYLOAD);

    enviarMock.mockResolvedValue({ resultado: 'CONFERIDA' });
    await drenarFila(database);

    expect(enviarMock).toHaveBeenLastCalledWith(PAYLOAD, expect.anything());
    expect(await fila(database, 'pendente')).toHaveLength(0);
    expect(await fila(database, 'enviada')).toHaveLength(1);
  });
});
