import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { formatarHora } from '../jornada/formatacao';
import type { IdAba } from '../navegacao/abas';
import { abaDaNotificacao, subtituloDeNaoLidas } from '../notificacoes/apresentacao';
import { agruparPorDia } from '../notificacoes/agruparPorDia';
import { CartaoNotificacao } from '../notificacoes/CartaoNotificacao';
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '../notificacoes/clienteNotificacoes';
import { useNotificacoes } from '../notificacoes/useNotificacoes';
import type { NotificacaoLocal } from '../notificacoes/useNotificacoes';
import { sincronizar } from '../sincronizacao/syncManager';
import { useAgora } from '../sincronizacao/useAgora';
import { Alerta } from '../ui/Alerta';
import { Botao } from '../ui/Botao';
import { Icone } from '../ui/Icone';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';

/** Os rótulos "Hoje"/"Ontem" envelhecem: reavalia o dia a cada minuto. */
const INTERVALO_DO_RELOGIO_MS = 60_000;

const MENSAGEM_DE_FALHA =
  'Não foi possível marcar como lida. Verifique a conexão e tente de novo.';

interface PropsNotificacoes {
  aoVoltar: () => void;
  /** Leva à aba onde o assunto da notificação é tratado. */
  aoAbrirAba: (aba: IdAba) => void;
}

/**
 * Centro de notificações do montador: o que a réplica local tem, do mais novo
 * para o mais antigo, agrupado por dia. Ler é offline; marcar como lida passa
 * pela API (não pela fila de ações) e por isso só vale online — depois da
 * resposta, uma sincronização traz o `lida` para a réplica e a lista se
 * atualiza sozinha. Ver detalhes é só navegação e funciona offline.
 */
export function Notificacoes({ aoVoltar, aoAbrirAba }: PropsNotificacoes) {
  const database = useDatabaseOuFalha();
  const { itens, naoLidas } = useNotificacoes();
  const online = useSincronizacaoStore((estado) => estado.online);
  const agora = useAgora(INTERVALO_DO_RELOGIO_MS);
  const [ocupado, setOcupado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = useMemo(() => agruparPorDia(itens, new Date(agora).toISOString()), [itens, agora]);

  /** Escrita na API seguida da sincronização que a reflete na réplica. */
  async function escrever(chamada: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await chamada();
    } catch {
      setErro(MENSAGEM_DE_FALHA);
      setOcupado(false);
      return;
    }
    // A escrita já valeu; se a sincronização falhar, o próximo gatilho repõe a réplica.
    await sincronizar(database).catch(() => undefined);
    setOcupado(false);
  }

  async function atualizar() {
    setAtualizando(true);
    try {
      await sincronizar(database);
    } catch {
      // O status da falha já fica no store de sincronização (botão ⟳).
    } finally {
      setAtualizando(false);
    }
  }

  function abrirDestino(notificacao: NotificacaoLocal, aba: IdAba) {
    // Quem foi ver o assunto já leu o aviso. Melhor esforço, sem prender a
    // navegação: sem rede ou com falha, a notificação só continua não lida.
    if (!notificacao.lida && online) {
      void marcarNotificacaoLida(Number(notificacao.id))
        .then(() => sincronizar(database))
        .catch(() => undefined);
    }
    aoAbrirAba(aba);
  }

  return (
    <Tela rolavel aoAtualizar={() => void atualizar()} atualizando={atualizando}>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[4] }}>
          <View style={{ marginLeft: -espacamento[8] }}>
            <Botao
              variante="icone"
              tamanho={40}
              forma="pilula"
              icone="chevron_left"
              rotuloAcessivel="Voltar"
              aoPressionar={aoVoltar}
            />
          </View>
          <View style={{ flex: 1, gap: espacamento[2] }}>
            <Texto variante="headlineMd">Notificações</Texto>
            <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
              {subtituloDeNaoLidas(naoLidas)}
            </Texto>
          </View>
        </View>

        {/* O botão tem 24 de respiro lateral; -16 deixa o texto alinhado ao conteúdo sem sair da tela. */}
        <View style={{ alignSelf: 'flex-end', marginRight: -espacamento[16] }}>
          <Botao
            variante="fantasma"
            tamanho={40}
            forma="pilula"
            icone="done_all"
            texto="Marcar todas como lidas"
            desabilitado={!online || naoLidas === 0 || ocupado}
            aoPressionar={() => void escrever(marcarTodasNotificacoesLidas)}
          />
        </View>

        {erro && <Alerta variante="erro" mensagem={erro} />}

        {grupos.length === 0 ? (
          <View style={{ alignItems: 'center', gap: espacamento[8], paddingVertical: espacamento[48] }}>
            <Icone nome="notifications" tamanho={espacamento[48]} cor={cores.outline} />
            <Texto variante="titleMd">Nenhuma notificação por aqui</Texto>
            <Texto variante="bodyMd" cor={cores.onSurfaceVariant} alinhamento="centro">
              Avisos sobre suas avarias, atestados e pontos em atraso aparecem aqui.
            </Texto>
          </View>
        ) : (
          grupos.map((grupo) => (
            <View key={grupo.rotulo} style={{ gap: espacamento[12] }}>
              <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                {grupo.rotulo.toUpperCase()}
              </Texto>
              {grupo.itens.map((notificacao) => {
                const aba = abaDaNotificacao(notificacao.tipo);
                return (
                  <CartaoNotificacao
                    key={notificacao.id}
                    notificacao={notificacao}
                    hora={formatarHora(notificacao.criadaEm)}
                    aoPressionar={
                      !notificacao.lida && online && !ocupado
                        ? () => void escrever(() => marcarNotificacaoLida(Number(notificacao.id)))
                        : undefined
                    }
                    desabilitado={!notificacao.lida && (!online || ocupado)}
                    aoAbrir={aba ? () => abrirDestino(notificacao, aba) : undefined}
                  />
                );
              })}
            </View>
          ))
        )}
      </View>
    </Tela>
  );
}
