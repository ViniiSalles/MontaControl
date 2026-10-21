import type { AcompanhamentoPedidoDTO } from '@montacontrol/shared'
import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import { formatarDataHoraCurta } from '../../formatacao/datas'
import { percentual, ROTULO_ETAPA, VARIANTE_ETAPA } from '../../formatacao/dashboard'
import { BadgeStatus } from '../../ui/BadgeStatus'
import { SimboloMaterial } from '../../ui/SimboloMaterial'

interface PropsBarraEtapa {
  rotulo: string
  icone: NomeIcone
  feitas: number
  total: number
  /** Classe de fundo da barra preenchida — mesma cor da série no gráfico de produtividade. */
  corBarra: string
  ultimaEm: string | null
  descricaoUltima: string
}

/** Um marco da logística (estoque ou cliente): quantas peças já passaram por ele. */
function BarraEtapa({ rotulo, icone, feitas, total, corBarra, ultimaEm, descricaoUltima }: PropsBarraEtapa) {
  const valor = percentual(feitas, total)
  return (
    <div className="min-w-0 flex-1 space-y-6">
      <div className="flex items-center gap-8">
        <SimboloMaterial nome={icone} className="text-lg text-on-surface-variant" />
        <span className="flex-1 text-label-md uppercase text-on-surface-variant">{rotulo}</span>
        <span className="text-title-sm tabular-nums text-on-surface">
          {feitas}/{total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${rotulo}: ${feitas} de ${total} peças`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={feitas}
        className="h-8 overflow-hidden rounded-full bg-surface-container-high"
      >
        <div className={['h-full rounded-full', corBarra].join(' ')} style={{ width: `${valor}%` }} />
      </div>
      <p className="text-body-sm text-on-surface-variant">
        {ultimaEm
          ? `${descricaoUltima} ${formatarDataHoraCurta(ultimaEm)}`
          : feitas > 0
            ? 'Sem horário registrado'
            : 'Nenhuma peça bipada ainda'}
      </p>
    </div>
  )
}

/**
 * Onde está o pedido: bipado no estoque pelo operador (triagem) e bipado no
 * cliente pelo montador (descarregamento), com o que exige ação do gestor.
 */
export function CartaoPedido({ pedido }: { pedido: AcompanhamentoPedidoDTO }) {
  return (
    <article
      aria-label={`Pedido ${pedido.numeroPedido}`}
      className="space-y-16 rounded-xl bg-surface-container-lowest p-24 shadow-elev1"
    >
      <header className="flex flex-wrap items-start gap-12">
        <div className="min-w-0 flex-1">
          <h3 className="text-title-md text-on-surface">{pedido.numeroPedido}</h3>
          <p className="truncate text-body-sm text-on-surface-variant">
            {pedido.cliente.nome} · {pedido.cliente.cidade}/{pedido.cliente.estado}
          </p>
        </div>
        <BadgeStatus variante={VARIANTE_ETAPA[pedido.etapa]} texto={ROTULO_ETAPA[pedido.etapa]} />
      </header>

      {pedido.totalPecas === 0 ? (
        <p className="text-body-md text-on-surface-variant">Nenhuma peça cadastrada para este pedido.</p>
      ) : (
        <div className="flex flex-col gap-16 sm:flex-row sm:gap-24">
          <BarraEtapa
            rotulo="Estoque"
            icone="conveyor_belt"
            feitas={pedido.pecasNoEstoque}
            total={pedido.totalPecas}
            corBarra="bg-primary-container"
            ultimaEm={pedido.ultimaTriagemEm}
            descricaoUltima="Última triagem:"
          />
          <BarraEtapa
            rotulo="Cliente"
            icone="home_work"
            feitas={pedido.pecasNoCliente}
            total={pedido.totalPecas}
            corBarra="bg-tertiary-container"
            ultimaEm={pedido.ultimoDescarregamentoEm}
            descricaoUltima="Último descarregamento:"
          />
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-8 text-body-sm text-on-surface-variant">
        <SimboloMaterial nome="groups" className="text-lg" />
        <span className="flex-1">
          {pedido.montadores.length > 0 ? pedido.montadores.join(', ') : 'Sem montador atribuído'}
        </span>
        {pedido.pecasInconsistentes > 0 && (
          <BadgeStatus
            variante="aviso"
            texto={`${pedido.pecasInconsistentes} na obra errada`}
          />
        )}
        {pedido.avariasAbertas > 0 && (
          <BadgeStatus
            variante="erro"
            texto={`${pedido.avariasAbertas} ${pedido.avariasAbertas === 1 ? 'avaria' : 'avarias'}`}
          />
        )}
      </footer>
    </article>
  )
}
