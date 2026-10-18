import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { Texto } from '../ui/Texto';
import { descreverStatus } from './descreverStatus';
import { useAgora } from './useAgora';

/** Mesmas cores do `Badge`, aplicadas a uma faixa. */
const corPorVariante = {
  sucesso: { fundo: cores.successContainer, texto: cores.onSuccessContainer },
  aviso: { fundo: cores.tertiaryFixed, texto: cores.onTertiaryFixedVariant },
  erro: { fundo: cores.errorContainer, texto: cores.onErrorContainer },
  info: { fundo: cores.primaryFixed, texto: cores.onPrimaryFixedVariant },
  neutro: { fundo: cores.surfaceContainerHigh, texto: cores.onSurfaceVariant },
} as const;

/** O "há X" envelhece sozinho: reavalia a cada meio minuto. */
const INTERVALO_DO_RELOGIO_MS = 30_000;

/**
 * Faixa de status da sincronização, fixa acima da barra de abas: o montador vê
 * em qualquer tela se está em dia, sem conexão, com ações na fila ou com falha.
 * Lê só o store (`useSincronizacaoStore`), alimentado pelo `syncManager` e por
 * `observarFila`.
 */
export function IndicadorDeSincronizacao() {
  const online = useSincronizacaoStore((estado) => estado.online);
  const sincronizando = useSincronizacaoStore((estado) => estado.sincronizando);
  const pendentes = useSincronizacaoStore((estado) => estado.pendentes);
  const ultimaSincronizacaoEm = useSincronizacaoStore((estado) => estado.ultimaSincronizacaoEm);
  const ultimoErro = useSincronizacaoStore((estado) => estado.ultimoErro);
  const agora = useAgora(INTERVALO_DO_RELOGIO_MS);

  const { variante, texto } = descreverStatus(
    { online, sincronizando, pendentes, ultimaSincronizacaoEm, ultimoErro },
    agora,
  );
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
