import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { CAMINHO_POR_PERFIL } from './perfilDestino'
import type { PerfilWeb } from './perfilDestino'

/** `/` — sem sessão vai ao Login; com sessão, direto ao destino do perfil. */
export function RotaInicial() {
  const { sessao } = useAuth()

  if (!sessao) return <Navigate to="/login" replace />

  return <Navigate to={CAMINHO_POR_PERFIL[sessao.usuario.perfil as PerfilWeb]} replace />
}
