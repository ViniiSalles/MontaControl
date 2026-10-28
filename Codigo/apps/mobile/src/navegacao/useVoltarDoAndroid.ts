import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useAbaVisivel } from './AbaVisivel';

/**
 * Liga o botão/gesto de voltar do Android às subtelas da aba. A navegação da
 * aba é um `useState` (`PilhaJornada`), então sem isto o voltar do aparelho
 * fecharia o app em vez de voltar para a Jornada. Inativo (na tela raiz), não
 * intercepta nada. Também não intercepta com a aba escondida sob as
 * notificações: quem trata o voltar nesse momento é a casca (`AppAutenticado`).
 */
export function useVoltarDoAndroid(ativo: boolean, aoVoltar: () => void): void {
  const abaVisivel = useAbaVisivel();
  const interceptar = ativo && abaVisivel;

  useEffect(() => {
    if (!interceptar) return;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      aoVoltar();
      return true;
    });
    return () => assinatura.remove();
  }, [interceptar, aoVoltar]);
}
