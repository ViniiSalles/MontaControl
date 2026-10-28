import type { ListaNotificacoesDTO, NotificacaoDTO } from '@montacontrol/shared'

/** Estado puro do centro de notificações — o provedor só o guarda e o troca por estas funções. */
export interface EstadoNotificacoes {
  itens: NotificacaoDTO[]
  naoLidas: number
}

export const ESTADO_NOTIFICACOES_VAZIO: EstadoNotificacoes = { itens: [], naoLidas: 0 }

/** Primeira página vinda do REST: substitui tudo (também no catch-up após reconectar). */
export function aplicarLista(lista: ListaNotificacoesDTO): EstadoNotificacoes {
  return { itens: lista.itens, naoLidas: lista.naoLidas }
}

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
