import { View } from 'react-native';
import { Texto } from '../ui/Texto';

const PESOS = [400, 500, 600, 700, 800] as const;

/**
 * Tela de verificação visual (não é tela de produto) — Task 8. Renderizada
 * temporariamente em `App.tsx` no lugar do `RootNavigator` (que só existe a
 * partir da Fase 10 / Task 14). Confirma na hora, olhando o Expo Go em
 * Android e iOS, que os 5 pesos de fonte carregados no Task 3 são
 * visualmente distintos — R13 alerta que Android descarta `fontWeight` em
 * fontes customizadas, então essa distinção só existe se `Texto`/`estiloTexto`
 * estiverem trocando `fontFamily`, nunca `fontWeight`.
 */
export function EscadaDePesos() {
  return (
    <View style={{ padding: 32, gap: 16 }}>
      {PESOS.map((peso) => (
        <Texto key={peso} variante="headlineSm" peso={peso}>
          Peso {peso} — MontaControl
        </Texto>
      ))}
    </View>
  );
}
