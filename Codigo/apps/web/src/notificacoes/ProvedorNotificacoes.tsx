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
  aplicarNova,
  desmarcarLidasNoEstado,
  ESTADO_NOTIFICACOES_VAZIO,
  marcarLidaNoEstado,
  marcarTodasNoEstado,
  mesclarLista,
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
  // Lido só na criação: correto porque `ProvedorNotificacoes` remonta este
  // componente (`key={accessToken}`) a cada token novo — se essa `key` sair,
  // o ref precisa passar a acompanhar a prop.
  const tokenRef = useRef(accessToken)
  const carregandoMaisRef = useRef(false)
  // Geração da lista: cada recarga abre uma nova; resposta de geração anterior
  // (recarga sobreposta ou `carregarMais` que voou durante a recarga) é descartada.
  const geracaoRef = useRef(0)
  // Recargas em voo: `carregarMais` não começa enquanto houver uma, senão a
  // recarga voltaria a lista à página 1 e a página antiga anexada deixaria um
  // buraco de itens nunca carregados.
  const recargasEmVooRef = useRef(0)
  // Marcações de leitura locais cujo PATCH ainda não terminou: só elas
  // sobrevivem a um snapshot mais antigo (ver `mesclarLista`).
  const lidasPendentesRef = useRef(new Set<number>())
  const todasPendentesRef = useRef(0)
  // Espelho do estado para saber, ao marcar, o que estava não lido (para desfazer em falha).
  const estadoRef = useRef(estado)
  useEffect(() => {
    estadoRef.current = estado
  }, [estado])

  // Primeira página por REST: carga inicial, catch-up após reconexão e
  // "rollback" de ação otimista que falhou. É MESCLADA ao estado atual (evento
  // ao vivo e marcação local posteriores ao snapshot sobrevivem). Falha de
  // rede é silenciosa — o estado atual segue e o próximo `connect` tenta de novo.
  const recarregar = useCallback(async () => {
    const geracao = ++geracaoRef.current
    recargasEmVooRef.current += 1
    try {
      const lista = await listarNotificacoes(tokenRef.current)
      if (geracao !== geracaoRef.current) return
      const pendentes = {
        ids: new Set(lidasPendentesRef.current),
        todas: todasPendentesRef.current > 0,
      }
      setEstado((atual) => mesclarLista(atual, lista, pendentes))
      setProximoCursor(lista.proximoCursor)
    } catch {
      // mantém o que já está na tela
    } finally {
      recargasEmVooRef.current -= 1
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

  // Otimista: a UI muda na hora e o id fica "pendente" até o PATCH terminar —
  // enquanto isso um snapshot mais antigo não o reverte. Em falha, a marcação é
  // desfeita localmente. Sucesso ou falha, termina com uma recarga: ela invalida
  // (geração) qualquer recarga iniciada antes do fim do PATCH, que poderia trazer
  // o item como não lido, e deixa o servidor decidir o estado final. Nunca rejeita.
  const marcarComoLida = useCallback(
    async (id: number) => {
      const eraNaoLida = estadoRef.current.itens.some((n) => n.id === id && !n.lida)
      lidasPendentesRef.current.add(id)
      setEstado((atual) => marcarLidaNoEstado(atual, id))
      try {
        await marcarNotificacaoLida(tokenRef.current, id)
      } catch {
        if (eraNaoLida) setEstado((atual) => desmarcarLidasNoEstado(atual, [id]))
      } finally {
        lidasPendentesRef.current.delete(id)
      }
      await recarregar()
    },
    [recarregar],
  )

  // Mesma lógica de `marcarComoLida`, para todas as que estavam não lidas; o
  // "pendente" aqui é um contador porque podem se sobrepor. Também nunca rejeita.
  const marcarTodasComoLidas = useCallback(async () => {
    const eramNaoLidas = estadoRef.current.itens.filter((n) => !n.lida).map((n) => n.id)
    todasPendentesRef.current += 1
    setEstado((atual) => marcarTodasNoEstado(atual))
    try {
      await marcarTodasNotificacoesLidas(tokenRef.current)
    } catch {
      setEstado((atual) => desmarcarLidasNoEstado(atual, eramNaoLidas))
    } finally {
      todasPendentesRef.current -= 1
    }
    await recarregar()
  }, [recarregar])

  const carregarMais = useCallback(async () => {
    if (proximoCursor === null || carregandoMaisRef.current || recargasEmVooRef.current > 0) return
    carregandoMaisRef.current = true
    const geracao = geracaoRef.current
    try {
      const lista = await listarNotificacoes(tokenRef.current, { antesDe: proximoCursor })
      if (geracao !== geracaoRef.current) return
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
