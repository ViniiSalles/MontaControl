import type { ProdutividadeDiaDTO } from '@montacontrol/shared'
import { diaDaSemana, formatarDiaMes } from '../../formatacao/datas'
import { resumirProdutividade } from '../../formatacao/dashboard'

/**
 * Duas séries da mesma grandeza (peças por dia), uma escala só. Cores
 * validadas para daltonismo (`primaryContainer` × `tertiaryContainer`) e as
 * mesmas das barras "Estoque"/"Cliente" do acompanhamento de pedidos.
 */
const SERIES = [
  { chave: 'pecasTriadas', rotulo: 'Chegaram ao estoque', cor: 'bg-primary-container' },
  { chave: 'pecasDescarregadas', rotulo: 'Descarregadas no cliente', cor: 'bg-tertiary-container' },
] as const

function rotuloDoDia(dia: string): string {
  return diaDaSemana(dia).slice(0, 3).toUpperCase()
}

function Coluna({ dia, maximo }: { dia: ProdutividadeDiaDTO; maximo: number }) {
  const descricao = `${formatarDiaMes(dia.dia)}: ${dia.pecasTriadas} no estoque, ${dia.pecasDescarregadas} no cliente`
  return (
    <div className="group relative flex h-full flex-1 flex-col items-center justify-end">
      {/* Dica de hover: o valor exato fica fora do gráfico, sem número em cada barra. */}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full mb-8 hidden whitespace-nowrap rounded-md bg-inverse-surface px-8 py-4 text-body-sm text-inverse-on-surface shadow-elev2 group-hover:block"
      >
        {descricao}
      </div>
      <div className="flex h-full items-end gap-2" aria-hidden="true">
        {SERIES.map((serie) => {
          const valor = dia[serie.chave]
          const altura = maximo === 0 ? 0 : (valor / maximo) * 100
          return (
            <div
              key={serie.chave}
              className={['w-16 rounded-t-xs', valor > 0 ? 'min-h-2' : '', serie.cor].join(' ')}
              style={{ height: `${altura}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}

/** US09 — volume diário de peças nos dois marcos da logística, últimos 7 dias. */
export function GraficoProdutividade({ dias }: { dias: ProdutividadeDiaDTO[] }) {
  const resumo = resumirProdutividade(dias)

  return (
    <section
      aria-labelledby="titulo-produtividade"
      className="space-y-24 rounded-xl bg-surface-container-lowest p-24 shadow-elev1"
    >
      <div className="flex flex-wrap items-start gap-16">
        <div className="min-w-0 flex-1">
          <h2 id="titulo-produtividade" className="text-headline-sm text-on-surface">
            Produtividade semanal
          </h2>
          <p className="text-body-sm text-on-surface-variant">Peças bipadas por dia, últimos 7 dias</p>
        </div>
        <ul className="flex flex-wrap gap-16" aria-label="Legenda">
          {SERIES.map((serie) => (
            <li key={serie.chave} className="flex items-center gap-8 text-body-sm text-on-surface-variant">
              <span className={['h-12 w-12 rounded-xs', serie.cor].join(' ')} aria-hidden="true" />
              {serie.rotulo}
            </li>
          ))}
        </ul>
      </div>

      <div>
        {resumo.maximo === 0 && (
          <p className="text-body-md text-on-surface-variant">Nenhuma peça bipada nos últimos 7 dias.</p>
        )}
        <div className="flex h-alturaGrafico items-end gap-8 border-b border-outline-variant">
          {dias.map((dia) => (
            <Coluna key={dia.dia} dia={dia} maximo={resumo.maximo} />
          ))}
        </div>
        <div className="mt-8 flex gap-8" aria-hidden="true">
          {dias.map((dia) => (
            <span key={dia.dia} className="flex-1 text-center text-label-sm text-on-surface-variant">
              {rotuloDoDia(dia.dia)}
            </span>
          ))}
        </div>
      </div>

      {/* Leitura acessível do gráfico: os mesmos números em tabela. */}
      <table className="sr-only">
        <caption>Peças bipadas por dia</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            {SERIES.map((serie) => (
              <th key={serie.chave} scope="col">
                {serie.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => (
            <tr key={dia.dia}>
              <th scope="row">{formatarDiaMes(dia.dia)}</th>
              <td>{dia.pecasTriadas}</td>
              <td>{dia.pecasDescarregadas}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="grid grid-cols-1 gap-16 sm:grid-cols-3">
        <div>
          <dt className="text-label-md uppercase text-on-surface-variant">No estoque na semana</dt>
          <dd className="text-headline-sm tabular-nums text-on-surface">{resumo.totalTriadas}</dd>
        </div>
        <div>
          <dt className="text-label-md uppercase text-on-surface-variant">No cliente na semana</dt>
          <dd className="text-headline-sm tabular-nums text-on-surface">{resumo.totalDescarregadas}</dd>
        </div>
        <div>
          <dt className="text-label-md uppercase text-on-surface-variant">Média diária no cliente</dt>
          <dd className="text-headline-sm tabular-nums text-on-surface">{resumo.mediaDiariaDescarregadas}</dd>
        </div>
      </dl>
    </section>
  )
}
