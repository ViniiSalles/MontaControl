import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsTela } from '@montacontrol/ui-contracts/tela';
import { cores, espacamentoNomeado } from '@montacontrol/design-tokens/native';

/**
 * `testID` fixo, só para o teste deste componente localizar o
 * `KeyboardAvoidingView` — Test Renderer (RNTL v14) só expõe elementos host
 * na árvore, então não há mais como consultar por tipo de composite
 * component (`UNSAFE_getByType` foi removido); ver Task 4/Task 8 e
 * `docs/guides/migration-v14.md` do pacote instalado.
 */
const TESTID_EVITAR_TECLADO = 'tela-keyboard-avoiding-view';

const BarraInferiorPresente = createContext(false);

/**
 * Marca as telas que ficam acima da `BarraNavInferior`: elas terminam na
 * barra, não no fim do aparelho, então não reservam o indicador de gestos —
 * reservar ali abria uma faixa vazia entre o conteúdo e a barra.
 */
export function ComBarraInferior({ children }: { children: ReactNode }) {
  return <BarraInferiorPresente.Provider value>{children}</BarraInferiorPresente.Provider>;
}

const BORDAS_COM_BARRA_INFERIOR = ['top', 'left', 'right'] as const;
const TODAS_AS_BORDAS = ['top', 'left', 'right', 'bottom'] as const;

export function Tela({
  children,
  evitarTeclado = false,
  rolavel = false,
  aoAtualizar,
  atualizando = false,
}: PropsTela) {
  const barraInferiorPresente = useContext(BarraInferiorPresente);
  const padding = { padding: espacamentoNomeado.paddingTelaMobile };
  // No `ScrollView` o padding vai no conteúdo, não no contêiner: no contêiner
  // ele vira uma moldura fixa que corta o conteúdo na borda ao rolar.
  const miolo = rolavel ? (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.background }}
      contentContainerStyle={padding}
      refreshControl={
        aoAtualizar ? (
          <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cores.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: cores.background }, padding]}>{children}</View>
  );
  return (
    <SafeAreaView
      testID="tela-area-segura"
      edges={barraInferiorPresente ? BORDAS_COM_BARRA_INFERIOR : TODAS_AS_BORDAS}
      style={{ flex: 1, backgroundColor: cores.background }}
    >
      {evitarTeclado ? (
        <KeyboardAvoidingView
          testID={TESTID_EVITAR_TECLADO}
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {miolo}
        </KeyboardAvoidingView>
      ) : (
        miolo
      )}
    </SafeAreaView>
  );
}
