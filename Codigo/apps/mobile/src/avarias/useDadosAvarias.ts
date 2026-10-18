import { useCallback, useMemo } from 'react';
import type { PedidoDoMontadorDTO, TipoAvariaDTO } from '@montacontrol/shared';
import { useConsulta } from '../db/useConsulta';
import { useDatabaseOuFalha } from '../db/useDatabase';
import {
  COLUNAS_OBSERVADAS_DE_AMBIENTE,
  COLUNAS_OBSERVADAS_DE_PECA,
  COLUNAS_OBSERVADAS_DE_PEDIDO_COMPLETO,
  montarPedidosDoMontador,
  paraAmbienteDoMontador,
  paraPecaDoMontador,
  paraPedidoDoMontador,
  queryAmbientesDoMontador,
  queryPecasDoMontador,
  queryPedidosDoMontador,
} from '../pedidos/pedidosDoMontador';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { sincronizar } from '../sincronizacao/syncManager';
import {
  COLUNAS_OBSERVADAS_DE_ACAO,
  COLUNAS_OBSERVADAS_DE_AVARIA,
  COLUNAS_OBSERVADAS_DE_TIPO_AVARIA,
  montarAvariasExibidas,
  paraAvariaDaReplica,
  paraAvariaNaFila,
  paraTipoAvaria,
  queryAcoesDeAvaria,
  queryAvarias,
  queryTiposAvaria,
} from './avariasComPendentes';
import type { AvariaExibida } from './avariasComPendentes';

export interface EstadoDadosAvarias {
  pedidos: PedidoDoMontadorDTO[];
  tipos: TipoAvariaDTO[];
  avarias: AvariaExibida[];
  /** `true` até a réplica e a fila terem emitido a primeira leitura. */
  carregando: boolean;
  /** A última sincronização falhou e não há nenhum dado local para mostrar. */
  erro: boolean;
  /** Dispara uma sincronização e espera ela terminar. */
  recarregar: () => Promise<void>;
}

/**
 * Pedidos do montador (com ambientes e peças), tipos de problema e histórico de
 * reportes, todos lidos da réplica local — o formulário funciona sem sinal. O
 * histórico leva por cima as avarias ainda na fila (`aguardandoEnvio`); a do
 * pull as substitui pelo `idCliente`. Não vai à rede: quem sincroniza é o
 * provider do app, e `recarregar` só pede uma rodada.
 */
export function useDadosAvarias(): EstadoDadosAvarias {
  const database = useDatabaseOuFalha();
  const ultimoErro = useSincronizacaoStore((estado) => estado.ultimoErro);

  const pedidos = useConsulta(queryPedidosDoMontador, COLUNAS_OBSERVADAS_DE_PEDIDO_COMPLETO, paraPedidoDoMontador);
  const ambientes = useConsulta(queryAmbientesDoMontador, COLUNAS_OBSERVADAS_DE_AMBIENTE, paraAmbienteDoMontador);
  const pecas = useConsulta(queryPecasDoMontador, COLUNAS_OBSERVADAS_DE_PECA, paraPecaDoMontador);
  const tipos = useConsulta(queryTiposAvaria, COLUNAS_OBSERVADAS_DE_TIPO_AVARIA, paraTipoAvaria);
  const replica = useConsulta(queryAvarias, COLUNAS_OBSERVADAS_DE_AVARIA, paraAvariaDaReplica);
  const acoes = useConsulta(queryAcoesDeAvaria, COLUNAS_OBSERVADAS_DE_ACAO, paraAvariaNaFila);

  const pedidosCompletos = useMemo(
    () => montarPedidosDoMontador(pedidos ?? [], ambientes ?? [], pecas ?? []),
    [pedidos, ambientes, pecas],
  );
  const tiposOrdenados = useMemo(
    () => [...(tipos ?? [])].sort((a, b) => a.id - b.id),
    [tipos],
  );
  const avarias = useMemo(
    () =>
      montarAvariasExibidas({
        replica: replica ?? [],
        acoes: (acoes ?? []).flatMap((acao) => acao ?? []),
        tipos: tiposOrdenados,
        pedidos: pedidosCompletos,
      }),
    [replica, acoes, tiposOrdenados, pedidosCompletos],
  );

  const carregando = [pedidos, ambientes, pecas, tipos, replica, acoes].some(
    (leitura) => leitura === null,
  );
  const semNenhumDado = pedidosCompletos.length === 0 && tiposOrdenados.length === 0 && avarias.length === 0;
  const recarregar = useCallback(() => sincronizar(database), [database]);

  return {
    pedidos: pedidosCompletos,
    tipos: tiposOrdenados,
    avarias,
    carregando,
    erro: !carregando && ultimoErro !== null && semNenhumDado,
    recarregar,
  };
}
