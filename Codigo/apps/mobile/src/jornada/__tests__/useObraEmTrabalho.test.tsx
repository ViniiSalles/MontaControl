jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import {
  criarAcaoPendente,
  criarBancoDeTeste,
  gravarLinhasNaReplica,
  linhaDeJornadaAberta,
  linhaDePedido,
} from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { useObraEmTrabalho } from '../useObraEmTrabalho';

beforeEach(() => {
  useSincronizacaoStore.getState().reiniciar();
});

describe('useObraEmTrabalho', () => {
  it('ponto aberto na réplica: devolve a obra dele', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'pedidos', [
      linhaDePedido({ id: '12', numero_pedido: 'PED-000012' }),
    ]);
    await gravarLinhasNaReplica(database, 'jornadas', [
      linhaDeJornadaAberta({ id: '700', pedido_id: '12' }),
    ]);

    const { result } = await renderHook(() => useObraEmTrabalho(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.obra?.numeroPedido).toBe('PED-000012');
    expect(result.current.motivo).toBeNull();
  });

  // Offline: o check-in ainda está na fila, e a obra vem do payload dele.
  it('check-in só na fila também vale como ponto aberto', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'pedidos', [
      linhaDePedido({ id: '12', numero_pedido: 'PED-000012' }),
    ]);
    const agora = new Date().toISOString();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-offline',
      payload: {
        idCliente: 'checkin-offline',
        latitude: -19.9,
        longitude: -43.9,
        registradoEm: agora,
        pedidoId: 12,
      },
      criadoEm: agora,
    });

    const { result } = await renderHook(() => useObraEmTrabalho(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.obra?.id).toBe(12));
  });

  it('sem ponto: sem obra, com o motivo', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'pedidos', [linhaDePedido({ id: '12' })]);

    const { result } = await renderHook(() => useObraEmTrabalho(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.obra).toBeNull();
    expect(result.current.motivo).toBe('sem_ponto');
  });
});
