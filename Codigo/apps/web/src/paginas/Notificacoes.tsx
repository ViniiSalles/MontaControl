import { useNotificacoes } from '../notificacoes/ProvedorNotificacoes'
import { Botao } from '../ui/Botao'
import { LayoutAutenticado } from './LayoutAutenticado'
import { ListaNotificacoes } from './notificacoes/ListaNotificacoes'

/** Histórico completo de notificações do usuário — destino do "Ver todas" da gaveta do sino. */
export default function Notificacoes() {
  const { naoLidas, marcarTodasComoLidas } = useNotificacoes()

  return (
    <LayoutAutenticado itemAtivo="/notificacoes" titulo="Notificações">
      <section aria-label="Notificações" className="mx-auto max-w-3xl space-y-16">
        <div className="flex items-center justify-between gap-16">
          <p className="text-body-md text-on-surface-variant">
            {naoLidas === 0 ? 'Tudo em dia.' : `${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`}
          </p>
          <Botao
            variante="fantasma"
            tamanho={40}
            forma="pilula"
            icone="done_all"
            texto="Marcar todas como lidas"
            desabilitado={naoLidas === 0}
            aoPressionar={() => void marcarTodasComoLidas()}
          />
        </div>
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-elev2">
          <ListaNotificacoes />
        </div>
      </section>
    </LayoutAutenticado>
  )
}
