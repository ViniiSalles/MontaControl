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
}
