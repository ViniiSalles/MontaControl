jest.mock('expo-crypto');
jest.mock('../../localizacao/localizacao');
jest.mock('../../localizacao/nominatim');
jest.mock('../../jornada/clienteJornadas', () => ({
  enviarCheckin: jest.fn(),
  enviarCheckout: jest.fn(),
  enviarSolicitacaoPonto: jest.fn(),
}));

import { randomUUID } from 'expo-crypto';
import { Q } from '@nozbe/watermelondb';
import { renderHook, waitFor } from '@testing-library/react-native';
import { StatusJornada } from '@montacontrol/shared';
import { criarBancoDeTeste, gravarLinhasNaReplica, linhaDePedido } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { AcaoPendente } from '../../db/AcaoPendente';
import { capturarLocalizacao } from '../../localizacao/localizacao';
import { resolverEndereco } from '../../localizacao/nominatim';
import { useObrasDoMontador } from '../../pedidos/useObrasDoMontador';
import { enviarCheckin, enviarCheckout } from '../clienteJornadas';
import { registrarCheckin, registrarCheckout } from '../acoes';
import { lerJornadasComPendentes } from '../jornadasComPendentes';

// Acceptance da #112: o ponto continua funcionando sem rede, com a obra e o raio
// vindos da réplica (tabela `pedidos`). Tudo real (réplica, outbox, sobreposição);
// só GPS, endereço e a rede são falsos — e a rede está fora do ar.

const SEM_REDE = new TypeError('Network request failed');

/** No endereço da obra (a linha da réplica fica em -19.9325, -43.9382). */
const NA_OBRA = { tipo: 'ok', latitude: -19.9325, longitude: -43.9382, precisaoM: 10 };
/** ~1,1 km ao norte: fora do raio de tolerância. */
const LONGE_DA_OBRA = { tipo: 'ok', latitude: -19.9225, longitude: -43.9382, precisaoM: 10 };

async function obraDaReplica(database: ReturnType<typeof criarBancoDeTeste>) {
  const { result } = await renderHook(() => useObrasDoMontador(database), {
    wrapper: comBanco(database),
  });
  await waitFor(() => expect(result.current.obras).toHaveLength(1));
  return result.current.obras[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  (randomUUID as jest.Mock).mockReturnValueOnce('checkin-offline').mockReturnValueOnce('checkout-offline');
  (resolverEndereco as jest.Mock).mockResolvedValue(null);
  (enviarCheckin as jest.Mock).mockRejectedValue(SEM_REDE);
  (enviarCheckout as jest.Mock).mockRejectedValue(SEM_REDE);
});

describe('ponto sem rede, com a obra da réplica', () => {
  it('longe da obra recusa pelo raio da réplica e não grava nada', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'pedidos', [linhaDePedido()]);
    const obra = await obraDaReplica(database);
    (capturarLocalizacao as jest.Mock).mockResolvedValue(LONGE_DA_OBRA);

    const resultado = await registrarCheckin(database, obra);

    expect(resultado.tipo).toBe('fora_do_raio');
    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(0);
    expect(enviarCheckin).not.toHaveBeenCalled();
  });

  it('na obra o check-in entra na fila com o pedido da réplica e aparece na hora', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'pedidos', [linhaDePedido()]);
    const obra = await obraDaReplica(database);
    (capturarLocalizacao as jest.Mock).mockResolvedValue(NA_OBRA);

    const resultado = await registrarCheckin(database, obra);

    expect(resultado.tipo).toBe('ok');
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(1);
    expect(JSON.parse(pendentes[0].payload)).toMatchObject({ idCliente: 'checkin-offline', pedidoId: 10 });
    const jornadas = await lerJornadasComPendentes(database);
    expect(jornadas).toHaveLength(1);
    expect(jornadas[0]).toMatchObject({ status: StatusJornada.EM_ANDAMENTO, pedidoId: 10 });
  });

  it('a saída também é validada contra a obra do check-in (pedido_id da jornada na réplica)', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'pedidos', [linhaDePedido()]);
    const obra = await obraDaReplica(database);
    (capturarLocalizacao as jest.Mock).mockResolvedValue(NA_OBRA);
    await registrarCheckin(database, obra);
    const [aberta] = await lerJornadasComPendentes(database);
    const obraDoCheckin = aberta.pedidoId === obra.id ? obra : null;
    expect(obraDoCheckin).not.toBeNull();

    (capturarLocalizacao as jest.Mock).mockResolvedValue(LONGE_DA_OBRA);
    const longe = await registrarCheckout(database, obraDoCheckin);
    expect(longe.tipo).toBe('fora_do_raio');

    (capturarLocalizacao as jest.Mock).mockResolvedValue(NA_OBRA);
    const perto = await registrarCheckout(database, obraDoCheckin);

    expect(perto.tipo).toBe('ok');
    const jornadas = await lerJornadasComPendentes(database);
    expect(jornadas).toHaveLength(1);
    expect(jornadas[0].status).toBe(StatusJornada.FINALIZADA);
    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(2);
  });
});
