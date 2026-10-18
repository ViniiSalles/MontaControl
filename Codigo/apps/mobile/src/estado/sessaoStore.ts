import { create } from 'zustand';
import type { UsuarioDTO } from '@montacontrol/shared';

export interface EstadoDaSessao {
  /** `null` = sem sessão. Durante a restauração de boot é `null` com `restaurando = true`. */
  usuario: UsuarioDTO | null;
  /** Verdadeiro só até a sessão guardada ser lida — segura a splash. Nunca espera a rede. */
  restaurando: boolean;
}

export const ESTADO_INICIAL_DA_SESSAO: EstadoDaSessao = { usuario: null, restaurando: true };

/**
 * Quem está logado, em MEMÓRIA — sem `persist`, de propósito: o usuário
 * (nome, e-mail) é dado pessoal e só pode ficar no SecureStore (`mc.sessao.v2`,
 * junto dos tokens, em `armazenamentoSessao`), de onde o `AuthContext` o
 * restaura no boot. Este store só substitui o `useState` do antigo provider,
 * para que qualquer lugar (inclusive fora do React) leia a sessão atual.
 *
 * Só o `AuthContext` escreve aqui; as telas leem por `useAuth`.
 */
export const useSessaoStore = create<EstadoDaSessao>()(() => ESTADO_INICIAL_DA_SESSAO);

/** Volta ao estado de boot — entre testes. */
export function reiniciarSessaoStore(): void {
  useSessaoStore.setState(ESTADO_INICIAL_DA_SESSAO);
}
