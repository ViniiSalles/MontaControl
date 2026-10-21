import type { AlertaDashboardDTO } from '@montacontrol/shared'
import { ICONE_ALERTA, tempoRelativo, TOM_ALERTA } from '../../formatacao/dashboard'
import { SimboloMaterial } from '../../ui/SimboloMaterial'

interface PropsFeedAlertas {
  alertas: AlertaDashboardDTO[]
  agora: Date
}

/** "Alertas em tempo real" (Figura 37): o que aconteceu por último na operação. */
export function FeedAlertas({ alertas, agora }: PropsFeedAlertas) {
  return (
    <section aria-labelledby="titulo-alertas" className="space-y-16 rounded-xl bg-surface-container-lowest p-24 shadow-elev1">
      <div>
        <h2 id="titulo-alertas" className="text-headline-sm text-on-surface">
          Alertas recentes
        </h2>
        <p className="text-body-sm text-on-surface-variant">Últimos eventos da operação</p>
      </div>

      {alertas.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">Nenhum evento registrado ainda.</p>
      ) : (
        <ul className="space-y-16">
          {alertas.map((alerta) => (
            <li key={alerta.id} className="flex gap-12">
              <span
                className={[
                  'flex h-40 w-40 shrink-0 items-center justify-center rounded-full',
                  TOM_ALERTA[alerta.tipo],
                ].join(' ')}
              >
                <SimboloMaterial nome={ICONE_ALERTA[alerta.tipo]} className="text-xl" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-8">
                  <p className="flex-1 text-title-sm text-on-surface">{alerta.titulo}</p>
                  <time dateTime={alerta.em} className="shrink-0 text-body-sm text-on-surface-variant">
                    {tempoRelativo(alerta.em, agora)}
                  </time>
                </div>
                <p className="text-body-sm text-on-surface-variant">{alerta.descricao}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
