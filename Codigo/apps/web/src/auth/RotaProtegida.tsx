import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { CAMINHO_POR_PERFIL } from './perfilDestino'
import type { PerfilWeb } from './perfilDestino'

interface PropsRotaProtegida {
  /** Um perfil, ou a lista dos que podem ver a tela (ex.: notificações, comum aos três). */
  perfilExigido: PerfilWeb | readonly PerfilWeb[]
  children: ReactNode
}

/**
 * Sem sessão → `/login`. Sessão de outro perfil → devolve ao próprio destino
 * (nunca 403 silencioso: cada perfil administrativo só tem uma tela hoje).
 */
export function RotaProtegida({ perfilExigido, children }: PropsRotaProtegida) {
  const { sessao } = useAuth()

  if (!sessao) return <Navigate to="/login" replace />

  const permitidos: readonly string[] = Array.isArray(perfilExigido) ? perfilExigido : [perfilExigido]
  if (!permitidos.includes(sessao.usuario.perfil)) {
    return <Navigate to={CAMINHO_POR_PERFIL[sessao.usuario.perfil as PerfilWeb]} replace />
  }

  return <>{children}</>
}
