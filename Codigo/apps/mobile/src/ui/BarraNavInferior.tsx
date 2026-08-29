import { Platform, Pressable, View } from 'react-native';
import type { PropsBarraNavInferior } from '@montacontrol/ui-contracts/barra-nav-inferior';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { sombraPorNivel } from '@montacontrol/design-tokens/native/sombra';
import { Texto } from './Texto';
import { Icone } from './Icone';

/**
 * Ver `jornada_home:216-242`: 5 abas, ícone `preenchido` só na ativa.
 * Sprint 1 entrega 1 aba ativa (Jornada) e 4 desabilitadas — comportamento
 * de navegação real (troca de tela) chega só na Fase 10, junto do
 * `RootNavigator`.
 */
export function BarraNavInferior({ itens }: PropsBarraNavInferior) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: espacamentoNomeado.alturaBarraInferior,
          backgroundColor: cores.surface,
        },
        sombraPorNivel('nav', Platform.OS === 'android' ? 'android' : 'ios'),
      ]}
    >
      {itens.map((item) => (
        <Pressable
          key={item.rotulo}
          disabled={item.desabilitado}
          onPress={item.aoPressionar}
          style={{
            alignItems: 'center',
            gap: espacamento[2],
            opacity: item.desabilitado ? 0.4 : item.ativo ? 1 : 0.7,
          }}
        >
          <Icone
            nome={item.icone}
            preenchido={item.ativo}
            cor={item.ativo ? cores.primary : cores.onSurfaceVariant}
          />
          <Texto variante="labelSm" cor={item.ativo ? cores.primary : cores.onSurfaceVariant}>
            {item.rotulo}
          </Texto>
        </Pressable>
      ))}
    </View>
  );
}
