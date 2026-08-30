jest.mock('expo-crypto');
jest.mock('../../localizacao/localizacao');
jest.mock('../../localizacao/nominatim');
jest.mock('../clienteJornadas', () => {
  const real = jest.requireActual('../clienteJornadas');
  return {
    ErroApi: real.ErroApi,
    enviarCheckin: jest.fn(),
    enviarCheckout: jest.fn(),
  };
});

import { randomUUID } from 'expo-crypto';
import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { capturarLocalizacao } from '../../localizacao/localizacao';
import { resolverEndereco } from '../../localizacao/nominatim';
import { ErroApi, enviarCheckin, enviarCheckout } from '../clienteJornadas';
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
    (enviarCheckin as jest.Mock).mockResolvedValue(JORNADA_FALSA);
    (enviarCheckout as jest.Mock).mockResolvedValue(JORNADA_FALSA);
  });

  it('sucesso: envia latitude, longitude e endereço, e devolve a jornada', async () => {
    const resultado = await registrarCheckin(TOKEN);

    expect(resultado).toEqual({ tipo: 'ok', jornada: JORNADA_FALSA });
    expect(enviarCheckin).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({
        idCliente: 'id-cliente-falso',
        latitude: -19.9325,
        longitude: -43.9382,
        endereco: 'Rua dos Aimorés, 1000 — Funcionários, Belo Horizonte',
      }),
    );
  });

  it('permissão negada: não chama a API e devolve o motivo', async () => {
    (capturarLocalizacao as jest.Mock).mockResolvedValue({ tipo: 'permissao_negada' });

    const resultado = await registrarCheckin(TOKEN);

    expect(resultado).toEqual({ tipo: 'sem_localizacao', motivo: 'permissao_negada' });
    expect(enviarCheckin).not.toHaveBeenCalled();
  });

  it('Nominatim sem resposta: o check-in acontece sem endereço no payload', async () => {
    (resolverEndereco as jest.Mock).mockResolvedValue(null);

    const resultado = await registrarCheckin(TOKEN);

    expect(resultado).toEqual({ tipo: 'ok', jornada: JORNADA_FALSA });
    const [, payload] = (enviarCheckin as jest.Mock).mock.calls[0];
    expect(payload.endereco).toBeUndefined();
  });

  it('erro 409 da API: devolve recusado com o código', async () => {
    (enviarCheckin as jest.Mock).mockRejectedValue(
      new ErroApi('JORNADA_EM_ANDAMENTO', 'Já existe uma jornada em andamento.', 409),
    );

    const resultado = await registrarCheckin(TOKEN);

    expect(resultado).toEqual({ tipo: 'recusado', codigo: 'JORNADA_EM_ANDAMENTO' });
  });

  it('falha de rede: devolve sem_rede', async () => {
    (enviarCheckin as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    const resultado = await registrarCheckin(TOKEN);

    expect(resultado).toEqual({ tipo: 'sem_rede' });
  });

  it('registrarCheckout chama enviarCheckout, não enviarCheckin', async () => {
    const resultado = await registrarCheckout(TOKEN);

    expect(resultado).toEqual({ tipo: 'ok', jornada: JORNADA_FALSA });
    expect(enviarCheckout).toHaveBeenCalled();
    expect(enviarCheckin).not.toHaveBeenCalled();
  });
});
