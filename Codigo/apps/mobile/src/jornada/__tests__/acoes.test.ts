jest.mock('expo-crypto');
jest.mock('../../localizacao/localizacao');
jest.mock('../../localizacao/nominatim');
jest.mock('../../sincronizacao/outbox', () => ({
  executarAcaoJornada: jest.fn(),
}));

import { randomUUID } from 'expo-crypto';
import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { capturarLocalizacao } from '../../localizacao/localizacao';
import { resolverEndereco } from '../../localizacao/nominatim';
import { executarAcaoJornada } from '../../sincronizacao/outbox';
import { registrarCheckin, registrarCheckout } from '../acoes';

const TOKEN = 'token-de-teste';

const JORNADA_FALSA: JornadaDTO = {
  id: 1,
  usuarioId: 10,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: '2026-08-29T12:00:00.000Z',
  checkinLatitude: -19.9325,
  checkinLongitude: -43.9382,
  checkinEndereco: 'Rua dos Aimorés, 1000 — Funcionários, Belo Horizonte',
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: '2026-08-29T12:00:00.000Z',
};

describe('registrarCheckin / registrarCheckout', () => {
  const database = criarBancoDeTeste();

  beforeEach(() => {
    jest.clearAllMocks();
    (randomUUID as jest.Mock).mockReturnValue('id-cliente-falso');
    (capturarLocalizacao as jest.Mock).mockResolvedValue({
      tipo: 'ok',
      latitude: -19.9325,
      longitude: -43.9382,
      precisaoM: 10,
    });
    (resolverEndereco as jest.Mock).mockResolvedValue(
      'Rua dos Aimorés, 1000 — Funcionários, Belo Horizonte',
    );
    (executarAcaoJornada as jest.Mock).mockResolvedValue({ tipo: 'ok', dado: JORNADA_FALSA });
  });

  it('sucesso: chama a outbox com tipo checkin e o payload com localização', async () => {
    const resultado = await registrarCheckin(TOKEN, database);

    expect(resultado).toEqual({ tipo: 'ok', jornada: JORNADA_FALSA });
    expect(executarAcaoJornada).toHaveBeenCalledWith(
      database,
      'checkin',
      TOKEN,
      expect.objectContaining({
        idCliente: 'id-cliente-falso',
        latitude: -19.9325,
        longitude: -43.9382,
        endereco: 'Rua dos Aimorés, 1000 — Funcionários, Belo Horizonte',
      }),
    );
  });

  it('permissão negada: não chama a outbox e devolve o motivo', async () => {
    (capturarLocalizacao as jest.Mock).mockResolvedValue({ tipo: 'permissao_negada' });

    const resultado = await registrarCheckin(TOKEN, database);

    expect(resultado).toEqual({ tipo: 'sem_localizacao', motivo: 'permissao_negada' });
    expect(executarAcaoJornada).not.toHaveBeenCalled();
  });

  it('Nominatim sem resposta: o payload vai sem endereço', async () => {
    (resolverEndereco as jest.Mock).mockResolvedValue(null);

    await registrarCheckin(TOKEN, database);

    const [, , , payload] = (executarAcaoJornada as jest.Mock).mock.calls[0];
    expect(payload.endereco).toBeUndefined();
  });

  it('recusa da outbox: devolve recusado com o código', async () => {
    (executarAcaoJornada as jest.Mock).mockResolvedValue({
      tipo: 'recusado',
      codigo: 'JORNADA_EM_ANDAMENTO',
    });

    const resultado = await registrarCheckin(TOKEN, database);

    expect(resultado).toEqual({ tipo: 'recusado', codigo: 'JORNADA_EM_ANDAMENTO' });
  });

  it('registrarCheckout chama a outbox com tipo checkout', async () => {
    const resultado = await registrarCheckout(TOKEN, database);

    expect(resultado).toEqual({ tipo: 'ok', jornada: JORNADA_FALSA });
    expect(executarAcaoJornada).toHaveBeenCalledWith(
      database,
      'checkout',
      TOKEN,
      expect.anything(),
    );
  });
});
