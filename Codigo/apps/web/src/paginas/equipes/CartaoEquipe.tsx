import { useId } from 'react'
import type { EquipeDTO, MembroEquipeDTO } from '@montacontrol/shared'
import { textoQuantidadeMontadores } from '../../formatacao/equipes'
import { mascararTelefone } from '../../formatacao/clientes'
import { Avatar } from '../../ui/Avatar'
import { BadgeStatus } from '../../ui/BadgeStatus'
import { Botao } from '../../ui/Botao'
import { SimboloMaterial } from '../../ui/SimboloMaterial'

/** Quantos rostos aparecem empilhados no cabeçalho fechado. */
const MAXIMO_AVATARES_RESUMO = 5

interface PropsCartaoEquipe {
  equipe: EquipeDTO
  aberta: boolean
  aoAlternar: () => void
  aoEditar: () => void
  aoExcluir: () => void
}

function LinhaMembro({ membro }: { membro: MembroEquipeDTO }) {
  return (
    <li className="flex flex-wrap items-center gap-16 rounded-lg bg-surface-container-low p-16">
      <Avatar nome={membro.nome} fotoUrl={membro.fotoUrl} tamanho="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-title-sm text-on-surface">{membro.nome}</p>
        <p className="break-all text-body-sm text-on-surface-variant">{membro.email}</p>
      </div>
      <p className="text-body-md text-on-surface-variant">
        {membro.telefone ? mascararTelefone(membro.telefone) : 'Sem telefone'}
      </p>
      <BadgeStatus variante={membro.ativo ? 'sucesso' : 'neutro'} texto={membro.ativo ? 'Ativo' : 'Inativo'} />
    </li>
  )
}

/** Equipe em acordeão: cabeçalho com resumo, membros detalhados ao abrir. */
export function CartaoEquipe({ equipe, aberta, aoAlternar, aoEditar, aoExcluir }: PropsCartaoEquipe) {
  const idConteudo = useId()
  const resumo = equipe.membros.slice(0, MAXIMO_AVATARES_RESUMO)
  const restantes = equipe.membros.length - resumo.length

  return (
    <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-elev1">
      <div className="flex flex-wrap items-center gap-16 p-16">
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={idConteudo}
          onClick={aoAlternar}
          className="flex min-w-0 flex-1 items-center gap-16 rounded-lg text-left"
        >
          <SimboloMaterial
            nome="chevron_right"
            className={['text-2xl text-on-surface-variant transition-transform', aberta ? 'rotate-90' : ''].join(' ')}
          />
          <div className="min-w-0">
            <p className="text-title-md text-on-surface">{equipe.nome}</p>
            <p className="text-body-sm text-on-surface-variant">{textoQuantidadeMontadores(equipe.membros.length)}</p>
          </div>
          {!aberta && resumo.length > 0 && (
            <div className="ml-auto hidden items-center -space-x-8 sm:flex" aria-hidden="true">
              {resumo.map((membro) => (
                <span key={membro.id} className="rounded-full ring-2 ring-surface-container-lowest">
                  <Avatar nome={membro.nome} fotoUrl={membro.fotoUrl} />
                </span>
              ))}
              {restantes > 0 && <span className="pl-12 text-label-lg text-on-surface-variant">+{restantes}</span>}
            </div>
          )}
        </button>
        <div className="flex gap-8">
          <Botao variante="tonal" tamanho={40} forma="pilula" texto="Editar" aoPressionar={aoEditar} />
          <Botao variante="fantasma" tamanho={40} forma="pilula" texto="Excluir" aoPressionar={aoExcluir} />
        </div>
      </div>

      {aberta && (
        <div id={idConteudo} className="px-16 pb-16">
          {equipe.membros.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low p-16 text-body-md text-on-surface-variant">
              Nenhum membro nesta equipe.
            </p>
          ) : (
            <ul className="space-y-8">
              {equipe.membros.map((membro) => (
                <LinhaMembro key={membro.id} membro={membro} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
