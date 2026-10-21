import { useMemo, useState } from 'react';
import { Vibration, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import { Botao } from '../ui/Botao';
import { BotaoSincronizacao } from '../sincronizacao/BotaoSincronizacao';
import { Carregando } from '../ui/Carregando';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import {
  classificarLeitura,
  deveEnfileirar,
  montarConferencia,
} from '../conferencia/conferencia';
import type { ResultadoLeitura } from '../conferencia/conferencia';
import { useDadosConferencia } from '../conferencia/useDadosConferencia';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { useObraEmTrabalho } from '../jornada/useObraEmTrabalho';
import type { PropsTelaDaAba } from '../navegacao/telaDaAba';
import { executarAcaoConferencia } from '../sincronizacao/outbox';
import { AvisosDeAcoesRecusadas } from './AvisosDeAcoesRecusadas';
import { CartaoProgresso } from './bipagem/CartaoProgresso';
import { CartaoUltimaLeitura } from './bipagem/CartaoUltimaLeitura';
import { ChecklistPecas } from './bipagem/ChecklistPecas';
import { LeitorCodigoBarras } from './bipagem/LeitorCodigoBarras';
import { BloqueioSemObra } from './jornada/BloqueioSemObra';
import { CartaoObra } from './jornada/CartaoObra';

/** Toque curto confirma; o padrão longo avisa sem o montador precisar olhar a tela. */
const VIBRACAO_CONFERIDA = 60;
const VIBRACAO_ALERTA = [0, 250, 120, 250];

/**
 * Bipagem no descarregamento (US02): o montador lê a etiqueta de cada peça e
 * o app confere contra o pedido na hora, sem rede (N4T1-N4T3). O pedido
 * conferido é sempre o da obra do ponto de entrada em andamento
 * (`useObraEmTrabalho`); sem ponto aberto a tela bloqueia. A leitura vai para
 * a fila e sobe quando houver sinal; o checklist já a mostra conferida pela
 * sobreposição.
 */
export function Bipagem({ aoIrParaJornada }: PropsTelaDaAba) {
  const database = useDatabaseOuFalha();
  const { pedidos, leiturasNaFila, carregando, erro, recarregar } = useDadosConferencia();
  const { obra, motivo, carregando: carregandoObra } = useObraEmTrabalho();
  const [ultimaLeitura, setUltimaLeitura] = useState<ResultadoLeitura | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);

  // O pedido conferido é sempre o da obra do ponto: sem fallback para o primeiro
  // da réplica, que conferia peças de uma obra onde o montador não estava.
  const pedidoAtivo = obra ? (pedidos.find((pedido) => pedido.id === obra.id) ?? null) : null;
  const conferencia = useMemo(
    () => (pedidoAtivo ? montarConferencia(pedidoAtivo, leiturasNaFila) : null),
    [pedidoAtivo, leiturasNaFila],
  );

  async function aoLer(codigoBarras: string) {
    if (!conferencia) return;
    const resultado = classificarLeitura(codigoBarras, conferencia, pedidos);
    setUltimaLeitura(resultado);
    setRecusa(null);
    Vibration.vibrate(
      resultado.tipo === 'outro_pedido' || resultado.tipo === 'nao_encontrada'
        ? VIBRACAO_ALERTA
        : VIBRACAO_CONFERIDA,
    );

    const pedidoId = conferencia.pedido.id;
    if (!deveEnfileirar(resultado, pedidoId, leiturasNaFila)) return;
    try {
      const envio = await executarAcaoConferencia(database, {
        idCliente: randomUUID(),
        pedidoId,
        codigoBarras,
        lidaEm: new Date().toISOString(),
      });
      if (envio.tipo === 'recusado') setRecusa(envio.mensagem);
    } catch {
      setRecusa('Não foi possível registrar a leitura no aparelho. Leia a peça de novo.');
    }
  }

  const faltam = conferencia ? conferencia.total - conferencia.conferidas : 0;

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha, paddingBottom: espacamento[24] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
          <View style={{ flex: 1 }}>
            <Texto variante="headlineMd">Bipagem</Texto>
          </View>
          <BotaoSincronizacao aoSincronizar={() => void recarregar()} />
        </View>

        <AvisosDeAcoesRecusadas />

        {carregando || carregandoObra ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : erro ? (
          <>
            <Alerta
              variante="erro"
              titulo="Não foi possível carregar"
              mensagem="Ainda não há pedidos no aparelho. Conecte-se à internet e tente de novo."
            />
            <Botao
              variante="tonal"
              tamanho={48}
              forma="pilula"
              texto="Tentar de novo"
              larguraTotal
              aoPressionar={() => void recarregar()}
            />
          </>
        ) : !obra ? (
          <BloqueioSemObra
            titulo="Bata o ponto de entrada para conferir peças"
            motivo={motivo ?? 'sem_ponto'}
            aoIrParaJornada={aoIrParaJornada}
          />
        ) : !conferencia ? (
          <>
            <CartaoObra obra={obra} />
            <Alerta
              variante="aviso"
              titulo="Dados da obra fora do aparelho"
              mensagem="As peças desta obra ainda não estão no aparelho. Sincronize pelo botão do topo para conferir."
            />
          </>
        ) : (
          <>
            <CartaoObra obra={obra} />

            <LeitorCodigoBarras aoLer={(codigo) => void aoLer(codigo)} />

            {recusa && <Alerta variante="erro" titulo="Leitura recusada" mensagem={recusa} />}

            <CartaoProgresso conferidas={conferencia.conferidas} total={conferencia.total} />

            {ultimaLeitura && (
              <View style={{ gap: espacamento[8] }}>
                <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                  ÚLTIMA LEITURA
                </Texto>
                <CartaoUltimaLeitura
                  leitura={ultimaLeitura}
                  numeroPedidoAtivo={conferencia.pedido.numeroPedido}
                />
              </View>
            )}

            {conferencia.total > 0 && faltam === 0 && (
              <Alerta
                variante="sucesso"
                titulo="Conferência completa"
                mensagem={`Todas as peças do pedido ${conferencia.pedido.numeroPedido} foram conferidas.`}
              />
            )}

            <View style={{ gap: espacamento[12] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
                <View style={{ flex: 1 }}>
                  <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                    CHECKLIST DE PEÇAS
                  </Texto>
                </View>
                {faltam > 0 && <Badge variante="aviso" texto={`Faltam ${faltam}`} />}
              </View>
              {conferencia.ambientes.length === 0 ? (
                <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
                  Este pedido ainda não tem peças cadastradas.
                </Texto>
              ) : (
                <ChecklistPecas ambientes={conferencia.ambientes} />
              )}
            </View>
          </>
        )}
      </View>
    </Tela>
  );
}
