import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { CAMINHO_POR_PERFIL } from './perfilDestino'
import type { PerfilWeb } from './perfilDestino'

interface PropsRotaProtegida {
  perfilExigido: PerfilWeb
  children: ReactNode
}

/**
 * Sem sessão → `/login`. Sessão de outro perfil → devolve ao próprio destino
 * (nunca 403 silencioso: cada perfil administrativo só tem uma tela hoje).
 */
export function RotaProtegida({ perfilExigido, children }: PropsRotaProtegida) {
  const { sessao } = useAuth()

  if (!sessao) return <Navigate to="/login" replace />

  if (sessao.usuario.perfil !== perfilExigido) {
    return <Navigate to={CAMINHO_POR_PERFIL[sessao.usuario.perfil as PerfilWeb]} replace />
  }

  return <>{children}</>
}
