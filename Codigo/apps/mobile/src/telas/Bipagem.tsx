import { useMemo, useState } from 'react';
import { Vibration, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Alerta } from '../ui/Alerta';
import { Badge } from '../ui/Badge';
import { Botao } from '../ui/Botao';
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
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { executarAcaoConferencia } from '../sincronizacao/outbox';
import { AvisosDeAcoesRecusadas } from './AvisosDeAcoesRecusadas';
import { Opcao } from './avarias/Opcao';
import { CartaoProgresso } from './bipagem/CartaoProgresso';
import { CartaoUltimaLeitura } from './bipagem/CartaoUltimaLeitura';
import { ChecklistPecas } from './bipagem/ChecklistPecas';
import { LeitorCodigoBarras } from './bipagem/LeitorCodigoBarras';

/** Toque curto confirma; o padrão longo avisa sem o montador precisar olhar a tela. */
const VIBRACAO_CONFERIDA = 60;
const VIBRACAO_ALERTA = [0, 250, 120, 250];

/**
 * Bipagem no descarregamento (US02): o montador lê a etiqueta de cada peça e
 * o app confere contra o pedido ativo na hora, sem rede (N4T1-N4T3). A
 * leitura vai para a fila e sobe quando houver sinal; o checklist já a mostra
 * conferida pela sobreposição.
 */
export function Bipagem() {
  const database = useDatabaseOuFalha();
  const { pedidos, leiturasNaFila, carregando, erro, recarregar } = useDadosConferencia();
  const sincronizando = useSincronizacaoStore((estado) => estado.sincronizando);
  const [pedidoEscolhidoId, setPedidoEscolhidoId] = useState<number | null>(null);
  const [ultimaLeitura, setUltimaLeitura] = useState<ResultadoLeitura | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);

  // Sem escolha (ou escolhido que sumiu da réplica), o primeiro pedido é o ativo.
  const pedidoAtivo = pedidos.find((pedido) => pedido.id === pedidoEscolhidoId) ?? pedidos[0] ?? null;
  const conferencia = useMemo(
    () => (pedidoAtivo ? montarConferencia(pedidoAtivo, leiturasNaFila) : null),
    [pedidoAtivo, leiturasNaFila],
  );

  function escolherPedido(id: number) {
    setPedidoEscolhidoId(id);
    setUltimaLeitura(null);
    setRecusa(null);
  }

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
          <Botao
            variante="icone"
            tamanho={40}
            forma="pilula"
            icone="sync"
            rotuloAcessivel="Atualizar"
            carregando={sincronizando}
            aoPressionar={() => void recarregar()}
          />
        </View>

        <AvisosDeAcoesRecusadas />

        {carregando ? (
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
        ) : !conferencia ? (
          <Alerta
            variante="info"
            titulo="Nenhum pedido vinculado"
            mensagem="Você só confere peças dos pedidos em que está trabalhando. Fale com o gestor e toque em Atualizar."
          />
        ) : (
          <>
            {pedidos.length > 1 && (
              <View style={{ gap: espacamento[8] }}>
                <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                  PEDIDO EM DESCARREGAMENTO
                </Texto>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacamento[8] }}>
                  {pedidos.map((pedido) => (
                    <Opcao
                      key={pedido.id}
                      rotulo={`${pedido.numeroPedido} · ${pedido.cliente.nome}`}
                      selecionada={pedido.id === conferencia.pedido.id}
                      aoPressionar={() => escolherPedido(pedido.id)}
                    />
                  ))}
                </View>
              </View>
            )}

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
