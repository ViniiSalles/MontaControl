import { createContext, useContext } from 'react';

/**
 * Diz à aba ativa se ela está à vista. Abrir as notificações esconde a aba em
 * vez de desmontá-la (um formulário não persistido, como o de atestado, perderia
 * o que foi digitado e as fotos), mas uma aba escondida não deve manter a
 * câmera ligada nem disputar o botão voltar do Android.
 */
export const AbaVisivelContext = createContext(true);

export function useAbaVisivel(): boolean {
  return useContext(AbaVisivelContext);
}
