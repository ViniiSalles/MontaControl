import type { DiaEspelhoDTO } from '@montacontrol/shared'
import { formatarDiaMes } from '../../formatacao/datas'
import { formatarMinutos } from '../../formatacao/horas'

/**
 * Minutos trabalhados por dia do mês (`banco_de_horas`, card de detalhe).
 * SVG/CSS puro — sem lib de gráfico. A altura de cada barra é proporcional
 * ao maior dia; o dia de maior valor fica em `primary`, os demais em
 * `primary-fixed`.
 */
export function GraficoBarrasDiario({ dias }: { dias: DiaEspelhoDTO[] }) {
  const maximo = Math.max(1, ...dias.map((dia) => dia.minutosTrabalhados))
  return (
    <div role="img" aria-label="Horas trabalhadas por dia no mês" className="flex h-alturaGrafico items-end gap-2">
      {dias.map((dia) => (
        <div
          key={dia.data}
          title={`${formatarDiaMes(dia.data)}: ${formatarMinutos(dia.minutosTrabalhados)}`}
          className={[
            'flex-1 rounded-t-sm',
            dia.minutosTrabalhados === maximo && maximo > 1 ? 'bg-primary' : 'bg-primary-fixed',
          ].join(' ')}
          // Porcentagem dinâmica: único estilo inline aceito (Global Constraints).
          style={{ height: `${Math.max(2, (dia.minutosTrabalhados / maximo) * 100)}%` }}
        />
      ))}
    </div>
  )
}
