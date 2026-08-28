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
import { EscadaDePesos } from './src/telas-dev/EscadaDePesos';

SplashScreen.preventAutoHideAsync();

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

  // PROVISÓRIO (Task 8): renderiza a tela de verificação visual da escada de
  // pesos de fonte no lugar da `View` vazia do Task 3. `RootNavigator` ainda
  // não existe (chega no Task 14 / Fase 10) — reverter esta troca lá.
  return (
    <View style={{ flex: 1 }} onLayout={aoLayoutRaiz}>
      <EscadaDePesos />
    </View>
  );
}
