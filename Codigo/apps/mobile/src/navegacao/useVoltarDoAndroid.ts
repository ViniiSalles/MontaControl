import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Liga o botão/gesto de voltar do Android às subtelas da aba. A navegação da
 * aba é um `useState` (`PilhaJornada`), então sem isto o voltar do aparelho
 * fecharia o app em vez de voltar para a Jornada. Inativo (na tela raiz), não
 * intercepta nada.
 */
export function useVoltarDoAndroid(ativo: boolean, aoVoltar: () => void): void {
  useEffect(() => {
    if (!ativo) return;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      aoVoltar();
      return true;
    });
    return () => assinatura.remove();
  }, [ativo, aoVoltar]);
}
