import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Perfil } from '@montacontrol/shared'
import type { UsuarioDTO } from '@montacontrol/shared'
import { entrarComCredenciais, ErroAutenticacao } from './clienteAuth'
import { CAMINHO_POR_PERFIL } from './perfilDestino'
import type { PerfilWeb } from './perfilDestino'

/**
 * Refresh token deliberadamente não guardado — a renovação silenciosa em
 * 401 (TI02) é um problema do cliente mobile (ver plano, "Interceptors");
 * aqui uma sessão expirada simplesmente devolve o usuário ao Login.
 */
interface SessaoAutenticada {
  usuario: UsuarioDTO
  accessToken: string
}

interface ContextoAuth {
  sessao: SessaoAutenticada | null
  /** Resolve com o caminho de destino do perfil (`CAMINHO_POR_PERFIL`) em caso de sucesso. */
  entrar: (email: string, senha: string) => Promise<string>
  sair: () => void
}

const AuthContext = createContext<ContextoAuth | null>(null)

/**
 * Perfis administrativos (GESTOR/RH/DEPOSITO) autenticam aqui. MONTADOR é
 * recusado com o token nunca persistido no state — mesmo com credenciais
 * válidas (plano: "recusados com mensagem, e o token não é persistido").
 */
export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<SessaoAutenticada | null>(null)

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await entrarComCredenciais(email, senha)

    if (resposta.usuario.perfil === Perfil.MONTADOR) {
      throw new ErroAutenticacao(
        'PERFIL_EXCLUSIVO_MOBILE',
        'Este perfil acessa o MontaControl pelo aplicativo mobile.',
      )
    }

    setSessao({ usuario: resposta.usuario, accessToken: resposta.accessToken })
    return CAMINHO_POR_PERFIL[resposta.usuario.perfil as PerfilWeb]
  }, [])

  const sair = useCallback(() => setSessao(null), [])

  const valor = useMemo(() => ({ sessao, entrar, sair }), [sessao, entrar, sair])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth deve ser usado dentro de <ProvedorAuth>')
  return contexto
}
