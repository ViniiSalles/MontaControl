import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { Texto } from '../ui/Texto';
import { descreverStatus, faixaVisivel } from './descreverStatus';

/** Mesmas cores do `Badge`, aplicadas a uma faixa. */
const corPorVariante = {
  sucesso: { fundo: cores.successContainer, texto: cores.onSuccessContainer },
  aviso: { fundo: cores.tertiaryFixed, texto: cores.onTertiaryFixedVariant },
  erro: { fundo: cores.errorContainer, texto: cores.onErrorContainer },
  info: { fundo: cores.primaryFixed, texto: cores.onPrimaryFixedVariant },
  neutro: { fundo: cores.surfaceContainerHigh, texto: cores.onSurfaceVariant },
} as const;

/**
 * Faixa de status da sincronização, acima da barra de abas, que só aparece
 * quando o montador precisa saber de algo (`faixaVisivel`): sem conexão,
 * servidor sem resposta, falha ou app desatualizado. Em dia, a faixa não
 * ocupa espaço — o detalhe ("sincronizado há X", fila) fica no
 * `BotaoSincronizacao` do cabeçalho de cada aba. Lê só o store
 * (`useSincronizacaoStore`), alimentado pelo `syncManager` e por `observarFila`.
 */
export function IndicadorDeSincronizacao() {
  const online = useSincronizacaoStore((estado) => estado.online);
  const sincronizando = useSincronizacaoStore((estado) => estado.sincronizando);
  const pendentes = useSincronizacaoStore((estado) => estado.pendentes);
  const ultimaSincronizacaoEm = useSincronizacaoStore((estado) => estado.ultimaSincronizacaoEm);
  const ultimoErro = useSincronizacaoStore((estado) => estado.ultimoErro);

  const entrada = { online, sincronizando, pendentes, ultimaSincronizacaoEm, ultimoErro };
  if (!faixaVisivel(entrada)) return null;

  // Nenhum estado visível mostra o "há X", então o relógio não precisa andar aqui.
  const { variante, texto } = descreverStatus(entrada, Date.now());
  const cor = corPorVariante[variante];

  return (
    <View
      testID="indicador-sincronizacao"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: cor.fundo,
        paddingVertical: espacamento[4],
        paddingHorizontal: espacamento[16],
        alignItems: 'center',
      }}
    >
      <Texto variante="labelSm" cor={cor.texto} numeroDeLinhas={1}>
        {texto}
      </Texto>
    </View>
  );
}
