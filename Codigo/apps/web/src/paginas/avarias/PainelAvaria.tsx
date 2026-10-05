import { StatusAvaria } from '@montacontrol/shared'
import type { AvariaDetalhadaDTO } from '@montacontrol/shared'
import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import {
  acoesDisponiveis,
  ROTULO_ORIGEM,
  ROTULO_STATUS_AVARIA,
  VARIANTE_STATUS_AVARIA,
  type AcaoAvaria,
} from '../../formatacao/avarias'
import { formatarDataHoraCurta } from '../../formatacao/datas'
import { BadgeStatus } from '../../ui/BadgeStatus'
import { Botao } from '../../ui/Botao'
import { CampoAreaTexto } from '../../ui/CampoAreaTexto'
import { PainelLateral } from '../../ui/PainelLateral'

const ICONE_POR_STATUS: Record<StatusAvaria, NomeIcone> = {
  [StatusAvaria.REPORTADA]: 'report',
  [StatusAvaria.EM_ANALISE]: 'visibility',
  [StatusAvaria.REPOSICAO_SOLICITADA]: 'sync',
  [StatusAvaria.RESOLVIDA]: 'check_circle',
}

interface PropsPainelAvaria {
  avaria: AvariaDetalhadaDTO | null
  parecer: string
  erroParecer?: string
  aoAlterarParecer: (valor: string) => void
  aoExecutar: (acao: AcaoAvaria) => void
  aoFechar: () => void
  enviando: boolean
}

function Informacao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-16">
      <p className="text-label-sm uppercase text-on-surface-variant">{rotulo}</p>
      <p className="text-title-sm text-on-surface">{valor}</p>
    </div>
  )
}

/** Detalhe da avaria para o gestor: dados da peça, relato, fotos e as ações do fluxo de análise. */
export function PainelAvaria({
  avaria,
  parecer,
  erroParecer,
  aoAlterarParecer,
  aoExecutar,
  aoFechar,
  enviando,
}: PropsPainelAvaria) {
  if (!avaria) {
    return (
      <PainelLateral titulo="Detalhes da Avaria">
        <p className="py-48 text-center text-body-md text-on-surface-variant">
          Selecione uma avaria para ver os detalhes.
        </p>
      </PainelLateral>
    )
  }

  const acoes = acoesDisponiveis(avaria.status)
  const pedeParecer = acoes.some((acao) => acao.exigeParecer)

  return (
    <PainelLateral
      titulo="Detalhes da Avaria"
      subtitulo={`${ROTULO_ORIGEM[avaria.registradaPorPerfil]} ${avaria.registradaPorNome} · ${formatarDataHoraCurta(avaria.criadoEm)}`}
      aoFechar={aoFechar}
      rodape={
        acoes.length > 0 ? (
          <>
            {acoes.map((acao) => (
              <div key={acao.status} className="flex-1">
                <Botao
                  variante={acao.status === StatusAvaria.RESOLVIDA ? 'primario' : 'tonal'}
                  tamanho={48}
                  forma="pilula"
                  icone={ICONE_POR_STATUS[acao.status]}
                  texto={acao.rotulo}
                  larguraTotal
                  carregando={enviando}
                  aoPressionar={() => aoExecutar(acao)}
                />
              </div>
            ))}
          </>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between">
        <p className="text-label-sm uppercase text-on-surface-variant">Situação</p>
        <BadgeStatus variante={VARIANTE_STATUS_AVARIA[avaria.status]} texto={ROTULO_STATUS_AVARIA[avaria.status]} />
      </div>

      <div className="grid grid-cols-2 gap-16">
        <Informacao rotulo="Pedido" valor={avaria.numeroPedido} />
        <Informacao rotulo="Ambiente" valor={avaria.ambiente} />
        <Informacao rotulo="Peça" valor={avaria.descricaoPeca} />
        <Informacao rotulo="Código" valor={avaria.codigoBarras ?? 'Sem código'} />
        <Informacao rotulo="Problema" valor={avaria.tipoAvaria} />
        <Informacao rotulo="Origem" valor={ROTULO_ORIGEM[avaria.registradaPorPerfil]} />
      </div>

      <section className="space-y-8 rounded-xl bg-surface-container-low p-16">
        <h3 className="text-label-md uppercase text-on-surface-variant">Relato</h3>
        <p className="text-body-md italic text-on-surface">“{avaria.descricao}”</p>
      </section>

      <section className="space-y-8">
        <h3 className="text-label-md uppercase text-on-surface-variant">Fotos</h3>
        {avaria.fotos.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">Nenhuma foto enviada.</p>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {avaria.fotos.map((foto) => (
              <a
                key={foto.id}
                href={foto.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl bg-surface-container-low shadow-elev1"
              >
                <img src={foto.url} alt="Foto da avaria" className="max-h-alturaPreviaDocumento w-full object-contain" />
              </a>
            ))}
          </div>
        )}
      </section>

      {avaria.parecer && (
        <section className="space-y-8 rounded-xl bg-surface-container-low p-16">
          <h3 className="text-label-md uppercase text-on-surface-variant">Parecer do gestor</h3>
          <p className="text-body-md italic text-on-surface">“{avaria.parecer}”</p>
          {avaria.analisadaEm && (
            <p className="text-body-sm text-on-surface-variant">
              {avaria.analisadaPorNome ?? 'Gestor'} em {formatarDataHoraCurta(avaria.analisadaEm)}
            </p>
          )}
        </section>
      )}

      {pedeParecer && (
        <CampoAreaTexto
          rotulo="Parecer"
          placeholder="Obrigatório para solicitar reposição ou resolver."
          valor={parecer}
          aoAlterar={aoAlterarParecer}
          erro={erroParecer}
        />
      )}
    </PainelLateral>
  )
}
