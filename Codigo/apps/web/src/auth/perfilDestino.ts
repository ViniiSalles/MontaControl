import { Perfil } from '@montacontrol/shared'

/**
 * MONTADOR nunca aparece aqui — é exclusivo do app mobile (plano, "Destinos
 * de N1T1") e é recusado em `AuthContext.entrar` antes de qualquer roteamento.
 */
export type PerfilWeb = Exclude<Perfil, Perfil.MONTADOR>

/** Tela inicial por perfil administrativo (plano, "Destinos de N1T1"). */
export const CAMINHO_POR_PERFIL: Record<PerfilWeb, string> = {
  [Perfil.GESTOR]: '/dashboard',
  [Perfil.RH]: '/atestados',
  [Perfil.DEPOSITO]: '/triagem',
}
