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
 * sessionStorage (não localStorage): sobrevive a F5 mas some ao fechar a aba,
 * coerente com "refresh token não guardado" — só o access token de vida
 * curta persiste, e só pelo tempo em que a aba está aberta.
 */
const CHAVE_SESSAO = 'montacontrol.sessao'

function lerSessaoPersistida(): SessaoAutenticada | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO)
    return bruto ? (JSON.parse(bruto) as SessaoAutenticada) : null
  } catch {
    return null
  }
}

/**
 * Perfis administrativos (GESTOR/RH/DEPOSITO) autenticam aqui. MONTADOR é
 * recusado com o token nunca persistido no state — mesmo com credenciais
 * válidas (plano: "recusados com mensagem, e o token não é persistido").
 */
export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessaoState] = useState<SessaoAutenticada | null>(lerSessaoPersistida)

  const definirSessao = useCallback((nova: SessaoAutenticada | null) => {
    setSessaoState(nova)
    try {
      if (nova) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(nova))
      else sessionStorage.removeItem(CHAVE_SESSAO)
    } catch {
      // sessionStorage indisponível (ex.: navegação privada) — sessão segue só em memória.
    }
  }, [])

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const resposta = await entrarComCredenciais(email, senha)

      if (resposta.usuario.perfil === Perfil.MONTADOR) {
        throw new ErroAutenticacao(
          'PERFIL_EXCLUSIVO_MOBILE',
          'Este perfil acessa o MontaControl pelo aplicativo mobile.',
        )
      }

      definirSessao({ usuario: resposta.usuario, accessToken: resposta.accessToken })
      return CAMINHO_POR_PERFIL[resposta.usuario.perfil as PerfilWeb]
    },
    [definirSessao],
  )

  const sair = useCallback(() => definirSessao(null), [definirSessao])

  const valor = useMemo(() => ({ sessao, entrar, sair }), [sessao, entrar, sair])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth deve ser usado dentro de <ProvedorAuth>')
  return contexto
}
