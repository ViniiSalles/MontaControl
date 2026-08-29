import { Modal as ModalNativo, Pressable, ScrollView, View } from 'react-native';
import { BlurView } from 'expo-blur';
import type { PropsModal } from '@montacontrol/ui-contracts/modal';
import { cores, raio, espacamento } from '@montacontrol/design-tokens/native';
import { Texto } from './Texto';
import { Icone } from './Icone';
import { Botao } from './Botao';

const estiloContainerPorApresentacao = {
  centro: { justifyContent: 'center', padding: espacamento[24] },
  folha: { justifyContent: 'flex-end' },
  tela: { justifyContent: 'flex-start' },
} as const;

/** Ver `gest_o_de_ferramentas:378-449` — header (título + fechar) / conteúdo rolável / rodapé de ações. */
export function Modal({ visivel, apresentacao, titulo, conteudo, acoes, aoFechar }: PropsModal) {
  return (
    <ModalNativo visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <BlurView intensity={20} tint="dark" style={{ flex: 1, backgroundColor: `${cores.scrim}66` }}>
        <View style={[{ flex: 1 }, estiloContainerPorApresentacao[apresentacao]]}>
          <Pressable testID="modal-overlay" style={{ position: 'absolute', inset: 0 }} onPress={aoFechar} />
          <View
            style={{
              backgroundColor: cores.surfaceContainerLowest,
              borderRadius: apresentacao === 'tela' ? 0 : raio.xxl,
              maxHeight: apresentacao === 'tela' ? undefined : '85%',
              flex: apresentacao === 'tela' ? 1 : undefined,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: espacamento[24] }}>
              <Texto variante="headlineMd">{titulo}</Texto>
              <Pressable onPress={aoFechar} accessibilityLabel="Fechar" accessibilityRole="button">
                <Icone nome="close" cor={cores.onSurfaceVariant} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: espacamento[24] }}>{conteudo}</ScrollView>
            {acoes && acoes.length > 0 && (
              <View style={{ flexDirection: 'row', gap: espacamento[16], padding: espacamento[24] }}>
                {acoes.map((acao) => (
                  <View key={acao.texto} style={{ flex: 1 }}>
                    <Botao
                      variante={acao.variante ?? 'primario'}
                      tamanho={48}
                      forma="retangular"
                      texto={acao.texto}
                      larguraTotal
                      aoPressionar={acao.aoPressionar}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </BlurView>
    </ModalNativo>
  );
}
