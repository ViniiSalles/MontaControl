jest.mock('../../avarias/clienteAvarias', () => ({ enviarAvaria: jest.fn() }));
jest.mock('../../jornada/clienteJornadas', () => {
  const real = jest.requireActual('../../jornada/clienteJornadas');
  return {
    ErroApi: real.ErroApi,
    buscarJornadaAtual: jest.fn(),
    buscarHistorico: jest.fn(),
    enviarCheckin: jest.fn(),
    enviarCheckout: jest.fn(),
    enviarSolicitacaoPonto: jest.fn(),
  };
});
jest.mock('../../banco-horas/clienteBancoHoras', () => ({ buscarBancoHoras: jest.fn() }));

import { Q } from '@nozbe/watermelondb';
import type { ReportarAvariaRequest } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { enviarAvaria } from '../../avarias/clienteAvarias';
import { ErroApi, enviarSolicitacaoPonto } from '../../jornada/clienteJornadas';
import { executarAcaoAvaria } from '../outbox';
import { drenarFila } from '../syncManager';

const TOKEN = 'token-de-teste';
const enviarMock = jest.mocked(enviarAvaria);

const PAYLOAD: ReportarAvariaRequest = {
  idCliente: 'id-avaria-1',
  pecaId: 10,
  tipoAvariaId: 2,
  descricao: 'Porta riscada',
};

async function fila(database: ReturnType<typeof criarBancoDeTeste>, status: string) {
  return database.get<AcaoPendente>('acoes_pendentes').query(Q.where('status', status)).fetch();
}

beforeEach(() => jest.clearAllMocks());

describe('executarAcaoAvaria', () => {
  it('online: envia e não deixa nada na fila', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockResolvedValue({} as never);

    expect(await executarAcaoAvaria(database, TOKEN, PAYLOAD)).toEqual({ tipo: 'enviada' });
    expect(enviarMock).toHaveBeenCalledWith(TOKEN, PAYLOAD);
    expect(await fila(database, 'pendente')).toHaveLength(0);
  });

  it('sem rede: fica pendente na fila com o payload inteiro', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockRejectedValue(new TypeError('Network request failed'));

    expect(await executarAcaoAvaria(database, TOKEN, PAYLOAD)).toEqual({ tipo: 'pendente' });
    const pendentes = await fila(database, 'pendente');
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tipo).toBe('avaria');
    expect(JSON.parse(pendentes[0].payload)).toEqual(PAYLOAD);
  });

  it('recusa do servidor: sai da fila e devolve a mensagem', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockRejectedValue(new ErroApi('ERRO', 'Peça não encontrada', 404));

    expect(await executarAcaoAvaria(database, TOKEN, PAYLOAD)).toEqual({
      tipo: 'recusado',
      codigo: 'ERRO',
      mensagem: 'Peça não encontrada',
    });
    expect(await fila(database, 'pendente')).toHaveLength(0);
  });
});

describe('drenarFila com avaria', () => {
  it('reenvia a avaria pendente pela rota de avarias, não pela de ponto', async () => {
    const database = criarBancoDeTeste();
    enviarMock.mockRejectedValueOnce(new TypeError('offline'));
    await executarAcaoAvaria(database, TOKEN, PAYLOAD);
    enviarMock.mockResolvedValue({} as never);

    await drenarFila(database, TOKEN);

    expect(enviarMock).toHaveBeenLastCalledWith(TOKEN, PAYLOAD);
    expect(enviarSolicitacaoPonto).not.toHaveBeenCalled();
    expect(await fila(database, 'pendente')).toHaveLength(0);
  });
});
