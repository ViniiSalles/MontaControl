import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from './src/db/database';
import { ProvedorAuth, useAuth } from './src/auth/AuthContext';
import { RootNavigator } from './src/navegacao/RootNavigator';

// Segura a splash nativa desde o primeiro frame; sem isso o cold start
// mostra tela branca enquanto fontes e sessão carregam.
void SplashScreen.preventAutoHideAsync();

/**
 * Splash de inicialização — distinta de onboarding, que este app não tem
 * (plano, reinterpretação de #8). Não tem conteúdo, botão nem flag
 * persistida: é a tela nativa de boot, e some sozinha quando o app sabe o
 * que renderizar.
 *
 * "Saber o que renderizar" são duas condições: as 5 faces da Inter
 * carregadas (o Android ignora `fontWeight` em fonte customizada, então
 * texto renderizado antes disso sairia com o peso errado, não só sem
 * estilo) e a restauração da sessão concluída — senão o montador com sessão
 * válida veria o Login piscar antes de cair na Jornada.
 */
function PortaoDeBoot({ fontesCarregadas }: { fontesCarregadas: boolean }) {
  const { restaurando } = useAuth();
  const pronto = fontesCarregadas && !restaurando;

  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync();
  }, [pronto]);

  // Enquanto não está pronto a splash nativa cobre a tela, então não há
  // nada a renderizar por baixo dela.
  if (!pronto) return null;

  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  const [fontesCarregadas] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <DatabaseProvider database={database}>
      <SafeAreaProvider>
        <ProvedorAuth>
          <PortaoDeBoot fontesCarregadas={fontesCarregadas} />
        </ProvedorAuth>
      </SafeAreaProvider>
    </DatabaseProvider>
  );
}
