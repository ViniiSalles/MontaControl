import { View } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Botao } from '../ui/Botao';
import { Texto } from '../ui/Texto';
import { rotuloDoContador } from './apresentacao';
import { useNotificacoes } from './useNotificacoes';

interface PropsBotaoNotificacoes {
  /** Abre a tela de notificações. */
  aoPressionar: () => void;
}

const TAMANHO_DO_SELO = espacamento[16];

/**
 * Sino do cabeçalho das abas: abre a tela de notificações e carrega o contador
 * de não lidas (lido da réplica local, então funciona offline e se atualiza
 * sozinho quando o WebSocket ou o pull trazem uma nova). O selo fica por cima
 * do botão e não captura toque — o sino inteiro continua sendo um alvo só.
 */
export function BotaoNotificacoes({ aoPressionar }: PropsBotaoNotificacoes) {
  const { naoLidas } = useNotificacoes();
  const rotulo = `Notificações, ${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}`;

  return (
    <View>
      <Botao
        variante="icone"
        tamanho={40}
        forma="pilula"
        icone="notifications"
        rotuloAcessivel={rotulo}
        aoPressionar={aoPressionar}
      />
      {naoLidas > 0 && (
        <View
          testID="selo-notificacoes"
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: espacamento[2],
            right: espacamento[2],
            minWidth: TAMANHO_DO_SELO,
            height: TAMANHO_DO_SELO,
            paddingHorizontal: espacamento[4],
            borderRadius: raio.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: cores.error,
          }}
        >
          <Texto variante="labelSm" cor={cores.onError} alinhamento="centro">
            {rotuloDoContador(naoLidas)}
          </Texto>
        </View>
      )}
    </View>
  );
}
