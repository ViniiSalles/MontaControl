import { useState } from 'react'
import type { DiaEspelhoDTO } from '@montacontrol/shared'
import type { VarianteBadge } from '@montacontrol/ui-contracts/badge'
import { diaDaSemana, formatarDiaCivil, formatarHora } from '../../formatacao/datas'
import { colunasDoDia, ocorrenciaDoDia, type Ocorrencia } from '../../formatacao/espelho'
import { formatarMinutos } from '../../formatacao/horas'
import { BadgeStatus } from '../../ui/BadgeStatus'
import { TabelaDados, type ColunaTabela } from '../../ui/TabelaDados'

const BADGE_POR_OCORRENCIA: Record<Ocorrencia, { variante: VarianteBadge; texto: string } | null> = {
  ABONADO: { variante: 'info', texto: 'Abonado' },
  EM_ANDAMENTO: { variante: 'info', texto: 'Em andamento' },
  FALTA: { variante: 'erro', texto: 'Falta' },
  LANCADO_EM_ATRASO: { variante: 'aviso', texto: 'Lançado em atraso' },
  HE: { variante: 'info', texto: 'HE' },
  REGULAR: { variante: 'neutro', texto: 'Regular' },
  NAO_UTIL: null,
}

const celulaHora = (iso: string | null) => <span className="font-mono">{formatarHora(iso)}</span>

interface PropsTabelaEspelho {
  dias: DiaEspelhoDTO[]
  hoje: string
}

export function TabelaEspelho({ dias, hoje }: PropsTabelaEspelho) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  function alternar(data: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(data)) proximo.delete(data)
      else proximo.add(data)
      return proximo
    })
  }

  const colunas: ColunaTabela<DiaEspelhoDTO>[] = [
    { titulo: 'Data', render: (dia) => formatarDiaCivil(dia.data) },
    { titulo: 'Dia', render: (dia) => <span className="text-label-lg uppercase">{diaDaSemana(dia.data)}</span> },
    { titulo: 'Entrada', alinhamento: 'centro', render: (dia) => celulaHora(colunasDoDia(dia).entrada) },
    { titulo: 'Saída intervalo', alinhamento: 'centro', render: (dia) => celulaHora(colunasDoDia(dia).saidaIntervalo) },
    { titulo: 'Retorno intervalo', alinhamento: 'centro', render: (dia) => celulaHora(colunasDoDia(dia).retornoIntervalo) },
    {
      titulo: 'Saída',
      alinhamento: 'centro',
      render: (dia) =>
        dia.turnos.length > 2 ? (
          <button type="button" onClick={() => alternar(dia.data)} aria-expanded={expandidos.has(dia.data)} className="text-primary underline underline-offset-2">
            {formatarHora(colunasDoDia(dia).saida)} · {dia.turnos.length} turnos
          </button>
        ) : (
          celulaHora(colunasDoDia(dia).saida)
        ),
    },
    {
      titulo: 'Total horas',
      alinhamento: 'direita',
      render: (dia) => {
        const ocorrencia = ocorrenciaDoDia(dia, hoje)
        const cor = ocorrencia === 'FALTA' ? 'text-error' : ocorrencia === 'HE' ? 'text-primary' : 'text-on-surface'
        return <span className={['font-bold', cor].join(' ')}>{formatarMinutos(dia.minutosTrabalhados)}</span>
      },
    },
    {
      titulo: 'Ocorrência',
      alinhamento: 'centro',
      render: (dia) => {
        const ocorrencia = ocorrenciaDoDia(dia, hoje)
        const badge = ocorrencia ? BADGE_POR_OCORRENCIA[ocorrencia] : null
        if (ocorrencia === 'NAO_UTIL') return <span className="text-label-sm uppercase text-outline">Não útil</span>
        return badge ? <BadgeStatus variante={badge.variante} texto={badge.texto} /> : null
      },
    },
  ]

  return (
    <TabelaDados
      rotulo="Detalhamento mensal"
      colunas={colunas}
      linhas={dias}
      chave={(dia) => dia.data}
      vazio="Sem dias no período."
      classeLinha={(dia) => {
        const ocorrencia = ocorrenciaDoDia(dia, hoje)
        if (ocorrencia === 'FALTA') return 'bg-error-container/30 text-error'
        if (ocorrencia === 'NAO_UTIL') return 'text-on-surface-variant'
        return ''
      }}
      linhasExtras={(dia) =>
        dia.turnos.length > 2 && expandidos.has(dia.data)
          ? dia.turnos.map((turno, indice) => (
              <tr key={`${dia.data}-turno-${indice}`} className="bg-surface-container-low text-body-sm text-on-surface-variant">
                <td className="px-24 py-8" colSpan={2}>Turno {indice + 1}{turno.lancadoEmAtraso ? ' · lançado em atraso' : ''}</td>
                <td className="px-24 py-8 text-center font-mono">{formatarHora(turno.inicio)}</td>
                <td colSpan={2} />
                <td className="px-24 py-8 text-center font-mono">{formatarHora(turno.fim)}</td>
                <td className="px-24 py-8 text-right">{formatarMinutos(turno.minutosTrabalhados)}</td>
                <td />
              </tr>
            ))
          : null
      }
    />
  )
}
