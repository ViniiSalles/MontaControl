import { useCallback } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { BarraNavInferior } from './src/ui/BarraNavInferior';

SplashScreen.preventAutoHideAsync();

// PROVISÓRIO (Task 14): dados de exemplo só para verificação visual manual do
// `BarraNavInferior` fora de teste. Reverter para uma `View` vazia (ou trocar
// pelo `RootNavigator` real) antes de qualquer PR — `RootNavigator` chega só
// na Fase 10.
const itensDeExemplo = [
  { rotulo: 'Jornada', icone: 'event_note', ativo: true } as const,
  { rotulo: 'Bipagem', icone: 'barcode_scanner', ativo: false, desabilitado: true } as const,
  { rotulo: 'Histórico', icone: 'description', ativo: false, desabilitado: true } as const,
  { rotulo: 'Manual', icone: 'menu_book', ativo: false, desabilitado: true } as const,
];

export default function App() {
  const [fontesCarregadas] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const aoLayoutRaiz = useCallback(async () => {
    if (fontesCarregadas) await SplashScreen.hideAsync();
  }, [fontesCarregadas]);

  if (!fontesCarregadas) return null;

  return (
    <View style={{ flex: 1 }} onLayout={aoLayoutRaiz}>
      <View style={{ flex: 1 }} />
      <BarraNavInferior itens={itensDeExemplo} />
    </View>
  );
}
