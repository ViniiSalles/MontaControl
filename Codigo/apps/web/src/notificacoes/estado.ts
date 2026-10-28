import type { ListaNotificacoesDTO, NotificacaoDTO } from '@montacontrol/shared'

/** Estado puro do centro de notificações — o provedor só o guarda e o troca por estas funções. */
export interface EstadoNotificacoes {
  itens: NotificacaoDTO[]
  naoLidas: number
}

export const ESTADO_NOTIFICACOES_VAZIO: EstadoNotificacoes = { itens: [], naoLidas: 0 }

/** Páginas seguintes (rolagem): anexa ao fim sem repetir ids e adota a contagem mais recente do servidor. */
export function anexarPagina(estado: EstadoNotificacoes, lista: ListaNotificacoesDTO): EstadoNotificacoes {
  const jaPresentes = new Set(estado.itens.map((n) => n.id))
  const novos = lista.itens.filter((n) => !jaPresentes.has(n.id))
  return { itens: [...estado.itens, ...novos], naoLidas: lista.naoLidas }
}

/** Evento ao vivo: vai para o topo; id já presente (evento duplicado ou já vindo do catch-up) é ignorado. */
export function aplicarNova(estado: EstadoNotificacoes, nova: NotificacaoDTO): EstadoNotificacoes {
  if (estado.itens.some((n) => n.id === nova.id)) return estado
  return {
    itens: [nova, ...estado.itens],
    naoLidas: nova.lida ? estado.naoLidas : estado.naoLidas + 1,
  }
}

export function marcarLidaNoEstado(estado: EstadoNotificacoes, id: number): EstadoNotificacoes {
  const alvo = estado.itens.find((n) => n.id === id)
  if (!alvo || alvo.lida) return estado
  return {
    itens: estado.itens.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    naoLidas: Math.max(0, estado.naoLidas - 1),
  }
}

export function marcarTodasNoEstado(estado: EstadoNotificacoes): EstadoNotificacoes {
  return {
    itens: estado.itens.map((n) => (n.lida ? n : { ...n, lida: true })),
    naoLidas: 0,
  }
}

/** Marcações de leitura locais cujo PATCH ainda não terminou (ver `mesclarLista`). */
export interface LeiturasPendentes {
  ids: ReadonlySet<number>
  /** Há um "marcar todas" em voo: toda notificação lida localmente segue lida. */
  todas: boolean
}

export const SEM_LEITURAS_PENDENTES: LeiturasPendentes = { ids: new Set(), todas: false }

/** Desfaz uma marcação otimista que o servidor recusou: volta a não lida e devolve a contagem. */
export function desmarcarLidasNoEstado(
  estado: EstadoNotificacoes,
  ids: readonly number[],
): EstadoNotificacoes {
  const alvos = new Set(ids)
  const revertidas = estado.itens.filter((n) => alvos.has(n.id) && n.lida).length
  if (revertidas === 0) return estado
  return {
    itens: estado.itens.map((n) => (alvos.has(n.id) && n.lida ? { ...n, lida: false } : n)),
    naoLidas: estado.naoLidas + revertidas,
  }
}

/**
 * Primeira página do REST aplicada sobre um estado que pode ter avançado
 * enquanto a requisição voava (catch-up após `connect`, reconciliação de ação):
 * - notificação ao vivo mais nova que o snapshot (id maior que tudo na
 *   resposta) e ausente dele é mantida no topo;
 * - marcação local AINDA PENDENTE (`pendentes`) segue lida mesmo que o snapshot,
 *   anterior ao PATCH, a traga como não lida; quem não está pendente adota o
 *   `lida` do servidor — é isso que faz um PATCH que falhou terminar não lido;
 * - `naoLidas` parte da contagem do servidor e é corrigida por esses dois
 *   ajustes, sem contar duas vezes o que já está na resposta.
 * Páginas mais antigas já carregadas (`carregarMais`) são descartadas — o
 * resultado é só a primeira página — e o provedor reinicia o cursor junto.
 */
export function mesclarLista(
  atual: EstadoNotificacoes,
  lista: ListaNotificacoesDTO,
  pendentes: LeiturasPendentes = SEM_LEITURAS_PENDENTES,
): EstadoNotificacoes {
  const lidasLocalmente = new Set(atual.itens.filter((n) => n.lida).map((n) => n.id))
  const idsDaResposta = new Set(lista.itens.map((n) => n.id))
  const maiorIdDaResposta = lista.itens.reduce((maior, n) => Math.max(maior, n.id), -Infinity)

  let mantidasLidas = 0
  const doServidor = lista.itens.map((n) => {
    const segueLida = lidasLocalmente.has(n.id) && (pendentes.todas || pendentes.ids.has(n.id))
    if (n.lida || !segueLida) return n
    mantidasLidas += 1
    return { ...n, lida: true }
  })
  const maisNovas = atual.itens.filter((n) => !idsDaResposta.has(n.id) && n.id > maiorIdDaResposta)
  const naoLidasMaisNovas = maisNovas.filter((n) => !n.lida).length

  return {
    itens: [...maisNovas, ...doServidor],
    naoLidas: Math.max(0, lista.naoLidas - mantidasLidas + naoLidasMaisNovas),
  }
}
