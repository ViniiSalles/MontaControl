import { useRef, useState } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import type { PropsCampoTexto } from '@montacontrol/ui-contracts/campo-texto';
import { cores, raio, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Texto } from './Texto';
import { Icone } from './Icone';

const tipoNativoPorTipo = {
  texto: 'default',
  email: 'email-address',
  senha: 'default',
  numero: 'numeric',
} as const;

/**
 * `testID` fixo do `TextInput` — só para o teste deste componente
 * localizar/inspecionar o elemento host. Test Renderer (RNTL v14) removeu
 * `UNSAFE_getByProps`/`UNSAFE_getByType` (ver Task 4/Task 8 e
 * `docs/guides/migration-v14.md` do pacote instalado), então não há mais
 * como consultar por props de composite component — a mesma técnica de
 * `testID` fixo usada em `Tela.tsx`/`Botao.tsx` resolve isso aqui.
 */
const TESTID_INPUT = 'campo-texto-input';

/** Ver `login_montacontrol:107-116` — contrato completo em `@montacontrol/ui-contracts/campo-texto`. */
export function CampoTexto({
  rotulo,
  valor,
  aoAlterar,
  tipo = 'texto',
  placeholder,
  iconeEsquerda,
  acaoRotulo,
  erro,
  ajuda,
  obrigatorio = false,
  desabilitado = false,
}: PropsCampoTexto) {
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const foco = useRef(new Animated.Value(0)).current;
  const ehSenha = tipo === 'senha';
  const mensagem = erro ?? ajuda;

  const aoFocar = () => Animated.timing(foco, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const aoDesfocar = () => Animated.timing(foco, { toValue: 0, duration: 200, useNativeDriver: false }).start();

  return (
    <View style={{ gap: espacamento[6] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Texto variante="labelLg" cor={cores.onSurfaceVariant}>
          {rotulo}
          {obrigatorio ? ' *' : ''}
        </Texto>
        {acaoRotulo && (
          <Pressable onPress={acaoRotulo.aoPressionar}>
            <Texto variante="labelSm" cor={cores.primary} peso={700}>
              {acaoRotulo.texto}
            </Texto>
          </Pressable>
        )}
      </View>
      <View style={{ position: 'relative' }}>
        {iconeEsquerda && (
          <View
            style={{ position: 'absolute', left: espacamento[16], top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}
          >
            <Icone nome={iconeEsquerda} tamanho={espacamento[20]} cor={cores.outline} />
          </View>
        )}
        <TextInput
          testID={TESTID_INPUT}
          value={valor}
          onChangeText={aoAlterar}
          onFocus={aoFocar}
          onBlur={aoDesfocar}
          placeholder={placeholder}
          placeholderTextColor={`${cores.outline}80`}
          editable={!desabilitado}
          secureTextEntry={ehSenha && !senhaVisivel}
          keyboardType={tipoNativoPorTipo[tipo]}
          style={{
            height: espacamentoNomeado.alturaCampo,
            borderRadius: raio.lg,
            backgroundColor: cores.surfaceContainerLow,
            paddingLeft: iconeEsquerda ? espacamento[48] : espacamento[16],
            paddingRight: ehSenha ? espacamento[48] : espacamento[16],
            color: cores.onSurface,
          }}
        />
        {ehSenha && (
          <Pressable
            testID="campo-texto-toggle-senha"
            onPress={() => setSenhaVisivel((v) => !v)}
            style={{ position: 'absolute', right: espacamento[16], top: 0, bottom: 0, justifyContent: 'center' }}
          >
            <Icone nome={senhaVisivel ? 'visibility_off' : 'visibility'} tamanho={espacamento[20]} cor={cores.outline} />
          </Pressable>
        )}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            height: espacamento[2],
            backgroundColor: cores.primary,
            width: foco.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            transform: [{ translateX: foco.interpolate({ inputRange: [0, 1], outputRange: ['0%', '-50%'] }) }],
          }}
        />
      </View>
      {mensagem && (
        <Texto variante="labelMd" cor={erro ? cores.error : cores.onSurfaceVariant}>
          {mensagem}
        </Texto>
      )}
    </View>
  );
}
