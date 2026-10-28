import { act, renderHook, waitFor } from '@testing-library/react-native';
import { syncPullFixture } from '@montacontrol/shared';
import { criarBancoDeTeste, gravarPullNaReplica } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { Notificacao } from '../../db/Notificacao';
import { useNotificacoes } from '../useNotificacoes';

describe('useNotificacoes', () => {
  it('lê da réplica, do mais novo para o mais antigo, e conta só as não lidas', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const { result } = await renderHook(() => useNotificacoes(), { wrapper: comBanco(database) });

    await waitFor(() => expect(result.current.itens).toHaveLength(2));
    expect(result.current.itens.map((item) => item.id)).toEqual(['61', '55']);
    expect(result.current.itens[0]).toEqual({
      id: '61',
      tipo: 'AVARIA_ATUALIZADA',
      titulo: 'Avaria em análise',
      mensagem: 'Sua avaria da peça Porta de correr 2,10m está em análise.',
      referenciaTipo: 'AVARIA',
      referenciaId: '77',
      lida: false,
      criadaEm: '2026-10-16T15:00:00.000Z',
    });
    expect(result.current.naoLidas).toBe(1);
  });

  it('banco vazio: lista vazia e zero não lidas', async () => {
    const database = criarBancoDeTeste();

    const { result } = await renderHook(() => useNotificacoes(), { wrapper: comBanco(database) });

    expect(result.current).toEqual({ itens: [], naoLidas: 0 });
  });

  it('marcar como lida pela réplica (pull) reduz o contador sem trocar a ordem', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);
    const { result } = await renderHook(() => useNotificacoes(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.naoLidas).toBe(1));

    await act(async () => {
      const notificacao = await database.get<Notificacao>('notificacoes').find('61');
      await database.write(() =>
        notificacao.update((registro) => {
          registro.lida = true;
        }),
      );
    });

    await waitFor(() => expect(result.current.naoLidas).toBe(0));
    expect(result.current.itens.map((item) => item.id)).toEqual(['61', '55']);
  });

  it('notificação nova entra no topo e conta como não lida', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);
    const { result } = await renderHook(() => useNotificacoes(), { wrapper: comBanco(database) });
    await waitFor(() => expect(result.current.itens).toHaveLength(2));

    await act(async () => {
      await database.write(() =>
        database.get<Notificacao>('notificacoes').create((registro) => {
          registro._raw.id = '70';
          registro.tipo = 'ATESTADO_VALIDADO';
          registro.titulo = 'Atestado validado';
          registro.mensagem = 'Seu atestado foi validado.';
          registro.referenciaTipo = 'ATESTADO';
          registro.referenciaId = '9';
          registro.lida = false;
          registro.criadaEm = '2026-10-17T09:00:00.000Z';
        }),
      );
    });

    await waitFor(() => expect(result.current.itens).toHaveLength(3));
    expect(result.current.itens[0].id).toBe('70');
    expect(result.current.naoLidas).toBe(2);
  });
});
