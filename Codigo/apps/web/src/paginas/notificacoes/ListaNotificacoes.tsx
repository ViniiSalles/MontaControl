import { useNavigate } from 'react-router-dom'
import type { NotificacaoDTO } from '@montacontrol/shared'
import { useAuth } from '../../auth/AuthContext'
import type { PerfilWeb } from '../../auth/perfilDestino'
import { tempoRelativo } from '../../formatacao/dashboard'
import { ICONE_NOTIFICACAO, rotaDaNotificacao, TOM_NOTIFICACAO } from '../../formatacao/notificacoes'
import { useNotificacoes } from '../../notificacoes/ProvedorNotificacoes'
import { SimboloMaterial } from '../../ui/SimboloMaterial'

interface PropsListaNotificacoes {
  /** Chamado depois de "Ver Detalhes" navegar — a gaveta usa para se fechar. */
  aoNavegar?: () => void
}

interface PropsConteudoItem {
  notificacao: NotificacaoDTO
  agora: Date
}

function ConteudoItem({ notificacao, agora }: PropsConteudoItem) {
  return (
    <div className="flex items-start gap-16">
      <span
        className={`flex h-48 w-48 shrink-0 items-center justify-center rounded-full ${TOM_NOTIFICACAO[notificacao.tipo]}`}
      >
        <SimboloMaterial nome={ICONE_NOTIFICACAO[notificacao.tipo]} className="text-2xl" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-12">
          <p className="text-title-sm text-on-surface">{notificacao.titulo}</p>
          <time dateTime={notificacao.criadaEm} className="shrink-0 text-label-sm text-on-surface-variant">
            {tempoRelativo(notificacao.criadaEm, agora)}
          </time>
        </div>
        <p className="line-clamp-2 text-body-md text-on-surface-variant">{notificacao.mensagem}</p>
      </div>
    </div>
  )
}

function BotaoVerDetalhes({ aoPressionar }: { aoPressionar: () => void }) {
  return (
    <div className="pl-64 pt-12">
      <button
        type="button"
        onClick={aoPressionar}
        className="rounded-full bg-primary px-16 py-6 text-label-lg text-on-primary hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      >
        Ver Detalhes
      </button>
    </div>
  )
}

interface PropsItemNotificacao extends PropsConteudoItem {
  rota: string | null
  aoMarcarLida: () => void
  aoVerDetalhes: () => void
}

function ItemNotificacao({ notificacao, agora, rota, aoMarcarLida, aoVerDetalhes }: PropsItemNotificacao) {
  if (notificacao.lida) {
    return (
      <li className="border-l-4 border-transparent px-20 py-16">
        <ConteudoItem notificacao={notificacao} agora={agora} />
        {rota && <BotaoVerDetalhes aoPressionar={aoVerDetalhes} />}
      </li>
    )
  }

  return (
    <li className="border-l-4 border-primary bg-primary-fixed/30 px-20 py-16">
      <button
        type="button"
        onClick={aoMarcarLida}
        aria-label={`${notificacao.titulo}. Marcar como lida`}
        className="block w-full text-left"
      >
        <ConteudoItem notificacao={notificacao} agora={agora} />
      </button>
      {rota && <BotaoVerDetalhes aoPressionar={aoVerDetalhes} />}
    </li>
  )
}

/** Itens do centro de notificações — compartilhada pela gaveta do sino e pela página `/notificacoes`. */
export function ListaNotificacoes({ aoNavegar }: PropsListaNotificacoes) {
  const { sessao } = useAuth()
  const navigate = useNavigate()
  const { itens, temMais, marcarComoLida, carregarMais } = useNotificacoes()
  const perfil = sessao?.usuario.perfil as PerfilWeb | undefined
  const agora = new Date()

  if (itens.length === 0) {
    return (
      <p className="px-24 py-40 text-center text-body-md text-on-surface-variant">Nenhuma notificação por aqui.</p>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-outline-variant/30">
        {itens.map((notificacao) => {
          const rota = perfil ? rotaDaNotificacao(notificacao, perfil) : null
          return (
            <ItemNotificacao
              key={notificacao.id}
              notificacao={notificacao}
              agora={agora}
              rota={rota}
              aoMarcarLida={() => void marcarComoLida(notificacao.id)}
              aoVerDetalhes={() => {
                if (!notificacao.lida) void marcarComoLida(notificacao.id)
                if (rota) navigate(rota)
                aoNavegar?.()
              }}
            />
          )
        })}
      </ul>
      {temMais && (
        <div className="flex justify-center p-16">
          <button
            type="button"
            onClick={() => void carregarMais()}
            className="rounded-full px-16 py-8 text-label-lg text-primary hover:bg-primary-container/10"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  )
}
