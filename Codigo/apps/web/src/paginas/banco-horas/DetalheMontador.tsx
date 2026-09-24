import { Link } from 'react-router-dom'
import type { DiaEspelhoDTO, EspelhoPontoDTO, SaldoMontadorDTO, SolicitacaoPontoDTO } from '@montacontrol/shared'
import { formatarDiaMes, nomeDoMes } from '../../formatacao/datas'
import { resumoDoMes, saldoDoDia, ultimosDiasComMarcacao } from '../../formatacao/espelho'
import { formatarMinutos } from '../../formatacao/horas'
import { Botao } from '../../ui/Botao'
import { PainelLateral } from '../../ui/PainelLateral'
import { SimboloMaterial } from '../../ui/SimboloMaterial'
import { GraficoBarrasDiario } from './GraficoBarrasDiario'

function rotuloDoDia(dia: DiaEspelhoDTO): string {
  if (dia.abonado) return 'Abonado'
  if (dia.lancadoEmAtraso) return 'Lançado em atraso'
  if (!dia.diaUtil) return 'Dia não útil'
  return 'Jornada regular'
}

interface PropsDetalheMontador {
  saldo: SaldoMontadorDTO
  espelho: EspelhoPontoDTO | null
  falhaEspelho: boolean
  compensacaoPendente: SolicitacaoPontoDTO | null
  ano: number
  mes: number
  aoAprovar: (compensacao: SolicitacaoPontoDTO) => void
  aoRejeitar: (compensacao: SolicitacaoPontoDTO) => void
}

export function DetalheMontador({ saldo, espelho, falhaEspelho, compensacaoPendente, ano, mes, aoAprovar, aoRejeitar }: PropsDetalheMontador) {
  const resumo = espelho ? resumoDoMes(espelho.dias) : null
  const ultimos = espelho ? ultimosDiasComMarcacao(espelho.dias, 3) : []

  return (
    <div className="flex w-full shrink-0 flex-col gap-24 lg:w-larguraPainelLateral">
      <div className="flex items-center justify-between gap-16">
        <h2 className="text-headline-sm text-on-surface">Detalhamento: {saldo.usuarioNome}</h2>
        <span className="flex items-center gap-6 rounded-full bg-primary-fixed px-12 py-4 text-label-lg text-primary">
          <SimboloMaterial nome="calendar_month" className="text-base" />
          {nomeDoMes(mes)} / {ano}
        </span>
      </div>

      <PainelLateral
        titulo={`Resumo de ${saldo.usuarioNome}`}
        rodape={
          compensacaoPendente ? (
            <>
              <div className="flex-1">
                <Botao variante="primario" tamanho={48} forma="pilula" icone="check_circle" texto="Aprovar compensação" larguraTotal aoPressionar={() => aoAprovar(compensacaoPendente)} />
              </div>
              <Botao variante="icone" tamanho={48} forma="retangular" icone="report" texto="Rejeitar compensação" aoPressionar={() => aoRejeitar(compensacaoPendente)} />
            </>
          ) : undefined
        }
      >
        {!resumo ? (
          <p className="py-24 text-center text-body-md text-on-surface-variant">
            {falhaEspelho ? 'Não foi possível carregar as marcações.' : 'Carregando marcações…'}
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label-md uppercase text-on-surface-variant">Total trabalhado no mês</p>
                <p className="text-display-sm text-primary">{formatarMinutos(resumo.minutosTrabalhados)}<span className="text-title-lg">h</span></p>
              </div>
              <div className="text-right">
                <p className="text-label-md uppercase text-on-surface-variant">Média diária</p>
                <p className="text-headline-sm text-on-surface">{formatarMinutos(resumo.mediaDiariaMinutos)}h</p>
              </div>
            </div>
            <GraficoBarrasDiario dias={espelho?.dias ?? []} />
            <section className="space-y-8">
              <h3 className="text-label-md uppercase text-on-surface-variant">Histórico de marcações (últimos 3 dias)</h3>
              {ultimos.length === 0 && <p className="text-body-sm text-on-surface-variant">Sem marcações no mês.</p>}
              {ultimos.map((dia) => {
                const diferenca = saldoDoDia(dia)
                return (
                  <div key={dia.data} className="flex items-center gap-12 rounded-lg bg-surface-container-low px-12 py-10">
                    <span className="rounded bg-surface-container-high px-6 py-4 text-label-sm text-on-surface-variant">{formatarDiaMes(dia.data)}</span>
                    <span className="flex-1 text-body-md text-on-surface">{rotuloDoDia(dia)}</span>
                    <span className={['text-title-sm', diferenca < 0 ? 'text-error' : 'text-primary'].join(' ')}>
                      {formatarMinutos(diferenca, true)}h
                    </span>
                  </div>
                )
              })}
            </section>
          </>
        )}
        <Link to={`/espelho-ponto/${saldo.usuarioId}?ano=${ano}&mes=${mes}`} className="inline-flex items-center gap-4 text-title-sm text-primary hover:underline">
          Ver espelho de ponto
          <SimboloMaterial nome="chevron_right" className="text-xl" />
        </Link>
      </PainelLateral>

      {compensacaoPendente && (
        <div role="note" className="flex gap-12 rounded-xl bg-tertiary-fixed p-24 text-on-tertiary-fixed-variant">
          <SimboloMaterial nome="info" className="mt-2 shrink-0 text-xl text-tertiary" />
          <div>
            <p className="text-title-sm">Nota da Gestão</p>
            <p className="text-body-sm">
              {saldo.usuarioNome} possui um pedido de compensação pendente para o dia {formatarDiaMes(compensacaoPendente.data)} ({formatarMinutos(compensacaoPendente.minutosSolicitados)}h): “{compensacaoPendente.justificativa}”. A aprovação acima lança as horas no espelho.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
