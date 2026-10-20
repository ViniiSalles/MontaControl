import type { ReactNode } from 'react';

/**
 * `SafeAreaView` + `paddingTelaMobile` sempre. `evitarTeclado` liga o
 * `KeyboardAvoidingView` — só as telas com campo de texto perto da borda
 * inferior precisam (o Login é o caso citado na spec).
 */
export interface PropsTela {
  children: ReactNode;
  evitarTeclado?: boolean;
  rolavel?: boolean;
  /** Só com `rolavel`: liga o "puxar para atualizar" (mobile). */
  aoAtualizar?: () => void;
  /** Mostra o indicador do "puxar para atualizar" enquanto `true`. */
  atualizando?: boolean;
}
