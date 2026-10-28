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
import {
  ATRASO_INICIAL,
  deveFazerPolling,
  INTERVALO_PLANO_B_MS,
  proximoAtraso,
  urlDoSocket,
} from './tempoReal'

interface ContextoNotificacoes {
  itens: NotificacaoDTO[]
  naoLidas: number
  /** `false` enquanto o socket está caído ou reconectando — o estado já carregado continua válido. */
  conectado: boolean
  /** Há página mais antiga a buscar com `carregarMais`. */
  temMais: boolean
  /**
   * Quantas notificações NOVAS chegaram ao vivo desde que a sessão abriu. Só o
   * evento do socket incrementa (carga inicial, catch-up e marcar como lida
   * não) — telas que reagem a "algo aconteceu" (dashboard) observam este número.
   */
  contadorNovas: number
  marcarComoLida: (id: number) => Promise<void>
  marcarTodasComoLidas: () => Promise<void>
  carregarMais: () => Promise<void>
}

const ContextoNotificacoesReact = createContext<ContextoNotificacoes | null>(null)

const SEM_SESSAO: ContextoNotificacoes = {
  ...ESTADO_NOTIFICACOES_VAZIO,
  conectado: false,
  temMais: false,
  contadorNovas: 0,
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
  const [contadorNovas, setContadorNovas] = useState(0)
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

  // Primeira página por REST: carga inicial, plano B com o socket fora,
  // catch-up após (re)conexão e reconciliação de marcação. É MESCLADA ao estado
  // atual (evento ao vivo e marcação local posteriores ao snapshot sobrevivem).
  // Toda recarga passa por aqui, então a geração descarta resposta superada.
  // Falha de rede é silenciosa — o estado atual segue e o plano B (ou o
  // próximo `connect`) tenta de novo.
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

  // Carga inicial por REST, independente do socket (spec §3.3): handshake
  // recusado ou API inalcançável pelo socket não deixam o sino e a lista vazios.
  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Plano B: enquanto o socket estiver fora, a lista se atualiza por REST.
  useEffect(() => {
    if (!deveFazerPolling(conectado)) return
    const intervalo = window.setInterval(() => void recarregar(), INTERVALO_PLANO_B_MS)
    return () => window.clearInterval(intervalo)
  }, [conectado, recarregar])

  useEffect(() => {
    // `connect` dispara também a cada reconexão — é o catch-up de eventos
    // perdidos enquanto o socket estava fora (inclusive no intervalo entre a
    // carga inicial e a entrada na sala).
    //
    // Falha de transporte: o Manager do Socket.io reconecta sozinho, com
    // backoff (`socket.active` segue `true`). Recusa do servidor (`connect_error`
    // do handshake ou `io server disconnect`): o socket.io-client DESTRÓI o
    // socket (`active` = false) e não tenta de novo — a retentativa é daqui,
    // com espera de 2 s dobrando até 60 s, de volta a 2 s após um `connect`.
    // Nenhum dos casos desloga nem limpa estado: pode ser falha transitória.
    const opcoes = {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (entregar: (dados: { token: string }) => void) => entregar({ token: tokenRef.current }),
    }
    const url = urlDoSocket(import.meta.env)
    const socket = url ? io(url, opcoes) : io(opcoes)

    let temporizador: number | null = null
    let atraso = ATRASO_INICIAL

    const cancelarRetentativa = () => {
      if (temporizador !== null) window.clearTimeout(temporizador)
      temporizador = null
    }

    const agendarRetentativa = () => {
      // `active`: o Manager ainda está tentando (falha de transporte) — não duplicar.
      if (socket.active || temporizador !== null) return
      const espera = atraso
      atraso = proximoAtraso(atraso)
      temporizador = window.setTimeout(() => {
        temporizador = null
        if (!socket.active) socket.connect()
      }, espera)
    }

    socket.on('connect', () => {
      cancelarRetentativa()
      atraso = ATRASO_INICIAL
      setConectado(true)
      void recarregar()
    })
    socket.on('disconnect', (motivo) => {
      setConectado(false)
      if (motivo === 'io server disconnect') agendarRetentativa()
    })
    socket.on('connect_error', () => {
      setConectado(false)
      agendarRetentativa()
    })
    socket.on(WS_EVENTS.NOTIFICACAO_NOVA, (nova: NotificacaoDTO) => {
      setEstado((atual) => aplicarNova(atual, nova))
      setContadorNovas((atual) => atual + 1)
    })

    return () => {
      cancelarRetentativa()
      socket.close()
    }
  }, [recarregar])

  // Otimista: a UI muda na hora e o id fica "pendente" até o PATCH terminar —
  // enquanto isso um snapshot mais antigo não o reverte. Depois do PATCH:
  // - falha: desfaz a marcação localmente e recarrega (o servidor decide);
  // - sucesso: só recarrega se houver recarga EM VOO — ela partiu antes de o
  //   PATCH terminar, pode trazer o item como não lido e, com a pendência já
  //   liberada, revertê-lo; a nova recarga a invalida pela geração. Sem recarga
  //   em voo, qualquer recarga futura já lê o estado gravado, e não recarregar
  //   preserva as páginas carregadas por `carregarMais`.
  // Nunca rejeita.
  const marcarComoLida = useCallback(
    async (id: number) => {
      const eraNaoLida = estadoRef.current.itens.some((n) => n.id === id && !n.lida)
      lidasPendentesRef.current.add(id)
      setEstado((atual) => marcarLidaNoEstado(atual, id))
      let falhou = false
      try {
        await marcarNotificacaoLida(tokenRef.current, id)
      } catch {
        falhou = true
        if (eraNaoLida) setEstado((atual) => desmarcarLidasNoEstado(atual, [id]))
      } finally {
        lidasPendentesRef.current.delete(id)
      }
      if (falhou || recargasEmVooRef.current > 0) await recarregar()
    },
    [recarregar],
  )

  // Mesma lógica de `marcarComoLida`, para todas as que estavam não lidas; o
  // "pendente" aqui é um contador porque podem se sobrepor. Também nunca rejeita.
  const marcarTodasComoLidas = useCallback(async () => {
    const eramNaoLidas = estadoRef.current.itens.filter((n) => !n.lida).map((n) => n.id)
    todasPendentesRef.current += 1
    setEstado((atual) => marcarTodasNoEstado(atual))
    let falhou = false
    try {
      await marcarTodasNotificacoesLidas(tokenRef.current)
    } catch {
      falhou = true
      setEstado((atual) => desmarcarLidasNoEstado(atual, eramNaoLidas))
    } finally {
      todasPendentesRef.current -= 1
    }
    if (falhou || recargasEmVooRef.current > 0) await recarregar()
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
      contadorNovas,
      marcarComoLida,
      marcarTodasComoLidas,
      carregarMais,
    }),
    [estado, conectado, proximoCursor, contadorNovas, marcarComoLida, marcarTodasComoLidas, carregarMais],
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
