import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import type { PropsPulsoAtividade } from '@montacontrol/ui-contracts/pulso-atividade';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';

/** Ver `login_montacontrol:144` — 8px, `cores.primary`, loop de pulso. */
export function PulsoAtividade({ ativo = true }: PropsPulsoAtividade) {
  const opacidade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ativo) {
      opacidade.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidade, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    // Limpeza obrigatória: sem isso, o loop segue rodando após o unmount.
    return () => loop.stop();
  }, [ativo, opacidade]);

  return (
    <Animated.View
      testID="pulso-atividade"
      style={{
        width: espacamento[8],
        height: espacamento[8],
        borderRadius: raio.xs,
        backgroundColor: cores.primary,
        opacity: opacidade,
      }}
    />
  );
}
