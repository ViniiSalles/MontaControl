import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Perfil } from '@montacontrol/shared'
import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import type { PerfilWeb } from '../auth/perfilDestino'
import { useAuth } from '../auth/AuthContext'
import { rotuloAcessivelSino, rotuloContadorNotificacoes } from '../notificacoes/tempoReal'
import { useNotificacoes } from '../notificacoes/ProvedorNotificacoes'
import { Avatar } from '../ui/Avatar'
import { GavetaLateral } from '../ui/GavetaLateral'
import { SimboloMaterial } from '../ui/SimboloMaterial'
import { ListaNotificacoes } from './notificacoes/ListaNotificacoes'

interface ItemMenu {
  rotulo: string
  caminho: string
  icone: NomeIcone
}

/**
 * Menu da sidebar por perfil, na ordem do Stitch. Itens do mockup sem tela
 * construída (Ferramentas, EPIs, Perfil) ficam de fora — não há
 * link morto.
 */
const ITENS_POR_PERFIL: Record<PerfilWeb, ItemMenu[]> = {
  [Perfil.RH]: [
    { rotulo: 'Montadores', caminho: '/montadores', icone: 'groups' },
    { rotulo: 'Atestados', caminho: '/atestados', icone: 'description' },
    { rotulo: 'Banco de Horas', caminho: '/banco-horas', icone: 'pending_actions' },
    { rotulo: 'Espelho de Ponto', caminho: '/espelho-ponto', icone: 'edit_document' },
  ],
  [Perfil.GESTOR]: [
    { rotulo: 'Dashboard', caminho: '/dashboard', icone: 'dashboard' },
    { rotulo: 'Pedidos', caminho: '/pedidos', icone: 'event_note' },
    { rotulo: 'Clientes', caminho: '/clientes', icone: 'home_work' },
    { rotulo: 'Equipes', caminho: '/equipes', icone: 'groups' },
    { rotulo: 'Avarias', caminho: '/avarias', icone: 'report' },
    { rotulo: 'Colaboradores', caminho: '/colaboradores', icone: 'account_circle' },
  ],
  [Perfil.DEPOSITO]: [{ rotulo: 'Triagem de Peças', caminho: '/triagem', icone: 'conveyor_belt' }],
}

const ROTULO_PERFIL: Record<PerfilWeb, string> = {
  [Perfil.RH]: 'Recursos Humanos',
  [Perfil.GESTOR]: 'Gestão',
  [Perfil.DEPOSITO]: 'Depósito',
}

interface PropsLayoutAutenticado {
  /** Caminho do item de menu ativo (ex.: `/banco-horas`). */
  itemAtivo: string
  titulo: string
  /** Selo, breadcrumb ou sub-abas ao lado do título. */
  complementoTitulo?: ReactNode
  children: ReactNode
}

interface PropsSinoNotificacoes {
  naoLidas: number
  conectado: boolean
  aoAbrir: () => void
}

function SinoNotificacoes({ naoLidas, conectado, aoAbrir }: PropsSinoNotificacoes) {
  const contador = rotuloContadorNotificacoes(naoLidas)
  return (
    <button
      type="button"
      onClick={(evento) => {
        // Safari não foca o botão ao clicar; sem isso a gaveta não teria para
        // onde devolver o foco ao fechar.
        evento.currentTarget.focus()
        aoAbrir()
      }}
      aria-label={rotuloAcessivelSino(naoLidas)}
      aria-haspopup="dialog"
      title={conectado ? undefined : 'Tempo real pausado — reconectando'}
      className="relative flex h-40 w-40 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <SimboloMaterial nome="notifications" className="text-2xl" />
      {contador && (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 flex h-16 min-w-16 items-center justify-center rounded-full bg-error px-4 text-label-sm text-on-error"
        >
          {contador}
        </span>
      )}
      {!conectado && (
        <span aria-hidden="true" className="absolute bottom-4 right-4 h-8 w-8 rounded-full border-2 border-surface bg-outline" />
      )}
    </button>
  )
}

/** Casca das telas web autenticadas: sidebar "âncora" + cabeçalho de vidro (DESIGN.md §2 e §4). */
export function LayoutAutenticado({ itemAtivo, titulo, complementoTitulo, children }: PropsLayoutAutenticado) {
  const { sessao, sair } = useAuth()
  const navigate = useNavigate()
  const { naoLidas, conectado, marcarTodasComoLidas } = useNotificacoes()
  const [menuAberto, setMenuAberto] = useState(false)
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const refBotaoAbrir = useRef<HTMLButtonElement>(null)
  const refBotaoFechar = useRef<HTMLButtonElement>(null)
  const perfil = sessao?.usuario.perfil as PerfilWeb | undefined
  const itens = perfil ? ITENS_POR_PERFIL[perfil] : []

  function aoSair() {
    sair()
    navigate('/login', { replace: true })
  }

  function abrirMenu() {
    setMenuAberto(true)
    // Foco só pode ir para o botão "Fechar menu" depois que a gaveta deixa de
    // ser `invisible` (senão o navegador ignora `.focus()` num elemento fora
    // da árvore de foco) — por isso o próximo frame, não um `useEffect`.
    requestAnimationFrame(() => refBotaoFechar.current?.focus())
  }

  function fecharMenu() {
    setMenuAberto(false)
    refBotaoAbrir.current?.focus()
  }

  function aoTeclarNaGaveta(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key === 'Escape' && menuAberto) fecharMenu()
  }

  return (
    <div className="min-h-screen bg-surface">
      {menuAberto && (
        <div aria-hidden="true" onClick={fecharMenu} className="fixed inset-0 z-40 bg-scrim/40 lg:hidden" />
      )}
      <aside
        onKeyDown={aoTeclarNaGaveta}
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-larguraBarraLateral flex-col bg-ancora px-16 py-24 transition-transform print:hidden',
          menuAberto ? 'visible translate-x-0' : 'invisible -translate-x-full',
          'lg:visible lg:translate-x-0',
        ].join(' ')}
      >
        <div className="mb-40 flex items-center gap-12 px-8">
          <span className="flex h-40 w-40 items-center justify-center rounded-lg bg-primary-container">
            <SimboloMaterial nome="conveyor_belt" className="text-2xl text-on-ancora" />
          </span>
          <div className="flex-1">
            <p className="text-headline-sm text-on-ancora">MontaControl</p>
            <p className="text-overline uppercase text-on-ancora-apagado">Operational Excellence</p>
          </div>
          <button
            ref={refBotaoFechar}
            type="button"
            aria-label="Fechar menu"
            onClick={fecharMenu}
            className="rounded-lg p-8 text-on-ancora-variant hover:text-on-ancora lg:hidden"
          >
            <SimboloMaterial nome="close" className="text-2xl" />
          </button>
        </div>
        <nav aria-label="Seções" className="flex-1 space-y-4">
          {itens.map((item) => {
            const ativo = item.caminho === itemAtivo
            return (
              <Link
                key={item.caminho}
                to={item.caminho}
                aria-current={ativo ? 'page' : undefined}
                onClick={() => setMenuAberto(false)}
                className={[
                  'flex items-center gap-12 rounded-lg px-12 py-10 text-body-md transition-colors',
                  ativo
                    ? 'bg-primary-container font-semibold text-on-ancora shadow-elev2'
                    : 'text-on-ancora-variant hover:bg-primary-container/10 hover:text-on-ancora',
                ].join(' ')}
              >
                <SimboloMaterial nome={item.icone} className="text-2xl" />
                {item.rotulo}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-ancora-divisor pt-24">
          <button
            type="button"
            onClick={aoSair}
            className="flex w-full items-center gap-12 rounded-lg px-12 py-10 text-body-md text-on-ancora-variant transition-colors hover:bg-primary-container/10 hover:text-on-ancora"
          >
            <SimboloMaterial nome="logout" className="text-2xl" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-larguraBarraLateral print:pl-0">
        <header className="sticky top-0 z-30 flex h-alturaBarraSuperior items-center justify-between gap-16 bg-surface/80 px-32 shadow-elev4 backdrop-blur-md print:hidden">
          <div className="flex min-w-0 items-center gap-16">
            <button
              ref={refBotaoAbrir}
              type="button"
              aria-label="Abrir menu"
              onClick={abrirMenu}
              className="rounded-lg p-8 text-on-surface-variant lg:hidden"
            >
              <SimboloMaterial nome="menu" className="text-2xl" />
            </button>
            <h1 className="truncate text-headline-sm text-primary">{titulo}</h1>
            {complementoTitulo && (
              <>
                <span aria-hidden="true" className="h-24 w-px bg-outline-variant/30" />
                {complementoTitulo}
              </>
            )}
          </div>
          {sessao && perfil && (
            <div className="flex items-center gap-12">
              <SinoNotificacoes naoLidas={naoLidas} conectado={conectado} aoAbrir={() => setGavetaAberta(true)} />
              <div className="hidden text-right sm:block">
                <p className="text-title-sm text-on-surface">{sessao.usuario.nome}</p>
                <p className="text-label-sm uppercase text-on-surface-variant">{ROTULO_PERFIL[perfil]}</p>
              </div>
              <Avatar nome={sessao.usuario.nome} />
            </div>
          )}
        </header>
        <main className="p-32 print:p-0">{children}</main>
      </div>
      <GavetaLateral
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        titulo="Notificações"
        acaoCabecalho={
          // `aria-disabled` em vez de `disabled`: ao zerar as não lidas, um
          // botão `disabled` com foco o perderia para o `body`, fora da gaveta, e
          // o foco preso pararia de funcionar. Assim ele segue focável e inerte.
          <button
            type="button"
            onClick={() => {
              if (naoLidas > 0) void marcarTodasComoLidas()
            }}
            aria-disabled={naoLidas === 0}
            className="text-label-lg text-primary hover:underline aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Marcar todas como lidas
          </button>
        }
        rodape={
          <Link
            to="/notificacoes"
            onClick={() => setGavetaAberta(false)}
            className="flex items-center justify-center gap-8 text-label-lg text-primary hover:underline"
          >
            Ver todas as notificações
            <SimboloMaterial nome="chevron_right" className="text-xl" />
          </Link>
        }
      >
        <ListaNotificacoes aoNavegar={() => setGavetaAberta(false)} />
      </GavetaLateral>
    </div>
  )
}
