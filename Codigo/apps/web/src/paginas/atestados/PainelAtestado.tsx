import { StatusAtestado } from '@montacontrol/shared'
import type { AtestadoDetalhadoDTO } from '@montacontrol/shared'
import { diasCorridos, formatarDataHoraCurta, formatarDiaMes } from '../../formatacao/datas'
import { BadgeStatus } from '../../ui/BadgeStatus'
import { Botao } from '../../ui/Botao'
import { CampoAreaTexto } from '../../ui/CampoAreaTexto'
import { PainelLateral } from '../../ui/PainelLateral'

export const ROTULO_STATUS: Record<StatusAtestado, string> = {
  [StatusAtestado.PENDENTE]: 'Pendente',
  [StatusAtestado.VALIDADO]: 'Aprovado',
  [StatusAtestado.REJEITADO]: 'Recusado',
}

export const VARIANTE_STATUS = {
  [StatusAtestado.PENDENTE]: 'aviso',
  [StatusAtestado.VALIDADO]: 'sucesso',
  [StatusAtestado.REJEITADO]: 'erro',
} as const

/** `3 dias (14/10 a 16/10)` / `1 dia (12/10)`. */
export function textoPeriodo(inicio: string, fim: string): string {
  const dias = diasCorridos(inicio, fim)
  const intervalo = dias === 1 ? formatarDiaMes(inicio) : `${formatarDiaMes(inicio)} a ${formatarDiaMes(fim)}`
  return `${dias} ${dias === 1 ? 'dia' : 'dias'} (${intervalo})`
}

interface PropsPainelAtestado {
  atestado: AtestadoDetalhadoDTO | null
  motivo: string
  erroMotivo?: string
  aoAlterarMotivo: (valor: string) => void
  aoAprovar: () => void
  aoRecusar: () => void
  aoFechar: () => void
  enviando: boolean
}

export function PainelAtestado({
  atestado,
  motivo,
  erroMotivo,
  aoAlterarMotivo,
  aoAprovar,
  aoRecusar,
  aoFechar,
  enviando,
}: PropsPainelAtestado) {
  if (!atestado) {
    return (
      <PainelLateral titulo="Detalhes do Atestado">
        <p className="py-48 text-center text-body-md text-on-surface-variant">
          Selecione um atestado para ver os detalhes.
        </p>
      </PainelLateral>
    )
  }

  const pendente = atestado.status === StatusAtestado.PENDENTE
  const dias = diasCorridos(atestado.dataInicio, atestado.dataFim)

  return (
    <PainelLateral
      titulo="Detalhes do Atestado"
      subtitulo={`Submetido por ${atestado.usuarioNome}`}
      aoFechar={aoFechar}
      rodape={
        pendente ? (
          <>
            <div className="flex-1">
              <Botao variante="perigo" tamanho={48} forma="pilula" icone="cancel" texto="Recusar" larguraTotal carregando={enviando} aoPressionar={aoRecusar} />
            </div>
            <div className="flex-1">
              <Botao variante="primario" tamanho={48} forma="pilula" icone="check_circle" texto="Aprovar" larguraTotal carregando={enviando} aoPressionar={aoAprovar} />
            </div>
          </>
        ) : undefined
      }
    >
      <section className="space-y-8">
        <h3 className="text-label-md uppercase text-on-surface-variant">Documento digitalizado</h3>
        <div className="grid gap-8">
          {atestado.fotos.map((foto) => (
            <a key={foto.id} href={foto.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-surface-container-low shadow-elev1">
              <img src={foto.url} alt="Foto do atestado" className="max-h-alturaPreviaDocumento w-full object-contain" />
            </a>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-16">
        <div className="rounded-xl bg-surface-container-low p-16">
          <p className="text-label-sm uppercase text-on-surface-variant">Período</p>
          <p className="text-title-md text-on-surface">
            {formatarDiaMes(atestado.dataInicio)} a {formatarDiaMes(atestado.dataFim)}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-16">
          <p className="text-label-sm uppercase text-on-surface-variant">Duração</p>
          <p className="text-title-md text-on-surface">
            {dias} {dias === 1 ? 'dia corrido' : 'dias corridos'}
          </p>
        </div>
      </div>

      {pendente ? (
        <CampoAreaTexto
          rotulo="Feedback de RH (motivo da recusa)"
          placeholder="Obrigatório para recusar."
          valor={motivo}
          aoAlterar={aoAlterarMotivo}
          erro={erroMotivo}
        />
      ) : (
        <section className="space-y-8 rounded-xl bg-surface-container-low p-16">
          <div className="flex items-center justify-between">
            <p className="text-label-sm uppercase text-on-surface-variant">Situação</p>
            <BadgeStatus variante={VARIANTE_STATUS[atestado.status]} texto={ROTULO_STATUS[atestado.status]} />
          </div>
          {atestado.motivoRejeicao && <p className="text-body-md italic text-on-surface">“{atestado.motivoRejeicao}”</p>}
          {atestado.validadoEm && (
            <p className="text-body-sm text-on-surface-variant">Analisado em {formatarDataHoraCurta(atestado.validadoEm)}</p>
          )}
        </section>
      )}
    </PainelLateral>
  )
}
