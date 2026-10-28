import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { io } from 'socket.io-client'
import { WS_EVENTS } from '@montacontrol/shared'
import type { NotificacaoDTO } from '@montacontrol/shared'
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from '../api/notificacoes'
import { useAuth } from '../auth/AuthContext'
import {
  anexarPagina,
  aplicarLista,
  aplicarNova,
  ESTADO_NOTIFICACOES_VAZIO,
  marcarLidaNoEstado,
  marcarTodasNoEstado,
} from './estado'
import type { EstadoNotificacoes } from './estado'

interface ContextoNotificacoes {
  itens: NotificacaoDTO[]
  naoLidas: number
  /** `false` enquanto o socket está caído ou reconectando — o estado já carregado continua válido. */
  conectado: boolean
  /** Há página mais antiga a buscar com `carregarMais`. */
  temMais: boolean
  marcarComoLida: (id: number) => Promise<void>
  marcarTodasComoLidas: () => Promise<void>
  carregarMais: () => Promise<void>
}

const ContextoNotificacoesReact = createContext<ContextoNotificacoes | null>(null)

const SEM_SESSAO: ContextoNotificacoes = {
  ...ESTADO_NOTIFICACOES_VAZIO,
  conectado: false,
  temMais: false,
  marcarComoLida: () => Promise.resolve(),
  marcarTodasComoLidas: () => Promise.resolve(),
  carregarMais: () => Promise.resolve(),
}

/**
 * Só abre o socket com sessão (os três perfis web). Sem sessão expõe o estado
 * vazio, então consumidores não precisam checar login antes de chamar o hook.
 */
export function ProvedorNotificacoes({ children }: { children: ReactNode }) {
  const { sessao } = useAuth()

  if (!sessao) {
    return (
      <ContextoNotificacoesReact.Provider value={SEM_SESSAO}>
        {children}
      </ContextoNotificacoesReact.Provider>
    )
  }

  // `key` descarta estado e socket quando o token muda (outro login): nada da
  // sessão anterior sobrevive à nova.
  return (
    <ConexaoNotificacoes key={sessao.accessToken} accessToken={sessao.accessToken}>
      {children}
    </ConexaoNotificacoes>
  )
}

function ConexaoNotificacoes({
  accessToken,
  children,
}: {
  accessToken: string
  children: ReactNode
}) {
  const [estado, setEstado] = useState<EstadoNotificacoes>(ESTADO_NOTIFICACOES_VAZIO)
  const [proximoCursor, setProximoCursor] = useState<number | null>(null)
  const [conectado, setConectado] = useState(false)
  const tokenRef = useRef(accessToken)
  const carregandoMaisRef = useRef(false)

  // Primeira página por REST: carga inicial, catch-up após reconexão e
  // "rollback" de ação otimista que falhou. Falha de rede é silenciosa — o
  // estado atual segue e o próximo `connect` tenta de novo.
  const recarregar = useCallback(async () => {
    try {
      const lista = await listarNotificacoes(tokenRef.current)
      setEstado(aplicarLista(lista))
      setProximoCursor(lista.proximoCursor)
    } catch {
      // mantém o que já está na tela
    }
  }, [])

  useEffect(() => {
    // `connect` dispara também a cada reconexão automática — é o catch-up de
    // eventos perdidos enquanto o socket estava fora. `connect_error` e
    // `disconnect` só sinalizam offline: pode ser oscilação de infraestrutura,
    // por isso não deslogam nem limpam estado, e a reconexão padrão com backoff
    // do Socket.io segue ativa.
    const socket = io({
      path: '/socket.io',
      auth: (entregar) => entregar({ token: tokenRef.current }),
    })

    socket.on('connect', () => {
      setConectado(true)
      void recarregar()
    })
    socket.on('disconnect', () => setConectado(false))
    socket.on('connect_error', () => setConectado(false))
    socket.on(WS_EVENTS.NOTIFICACAO_NOVA, (nova: NotificacaoDTO) => {
      setEstado((atual) => aplicarNova(atual, nova))
    })

    return () => {
      socket.close()
    }
  }, [recarregar])

  // Otimista: a UI muda na hora; se o REST falhar, recarrega a primeira página
  // para voltar ao que o servidor tem.
  const marcarComoLida = useCallback(
    async (id: number) => {
      setEstado((atual) => marcarLidaNoEstado(atual, id))
      try {
        await marcarNotificacaoLida(tokenRef.current, id)
      } catch {
        await recarregar()
      }
    },
    [recarregar],
  )

  const marcarTodasComoLidas = useCallback(async () => {
    setEstado((atual) => marcarTodasNoEstado(atual))
    try {
      await marcarTodasNotificacoesLidas(tokenRef.current)
    } catch {
      await recarregar()
    }
  }, [recarregar])

  const carregarMais = useCallback(async () => {
    if (proximoCursor === null || carregandoMaisRef.current) return
    carregandoMaisRef.current = true
    try {
      const lista = await listarNotificacoes(tokenRef.current, { antesDe: proximoCursor })
      setEstado((atual) => anexarPagina(atual, lista))
      setProximoCursor(lista.proximoCursor)
    } catch {
      // o cursor segue o mesmo: o usuário pode tentar de novo
    } finally {
      carregandoMaisRef.current = false
    }
  }, [proximoCursor])

  const valor = useMemo<ContextoNotificacoes>(
    () => ({
      itens: estado.itens,
      naoLidas: estado.naoLidas,
      conectado,
      temMais: proximoCursor !== null,
      marcarComoLida,
      marcarTodasComoLidas,
      carregarMais,
    }),
    [estado, conectado, proximoCursor, marcarComoLida, marcarTodasComoLidas, carregarMais],
  )

  return (
    <ContextoNotificacoesReact.Provider value={valor}>
      {children}
    </ContextoNotificacoesReact.Provider>
  )
}

export function useNotificacoes(): ContextoNotificacoes {
  const contexto = useContext(ContextoNotificacoesReact)
  if (!contexto) throw new Error('useNotificacoes deve ser usado dentro de <ProvedorNotificacoes>')
  return contexto
}
