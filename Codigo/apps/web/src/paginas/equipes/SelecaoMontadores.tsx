import { useState } from 'react'
import type { MontadorResumoDTO } from '@montacontrol/shared'
import { alternarSelecao, filtrarPorNome } from '../../formatacao/equipes'
import { CampoTexto } from '../../ui/CampoTexto'
import { Checkbox } from '../../ui/Checkbox'

interface PropsSelecaoMontadores {
  montadores: MontadorResumoDTO[]
  selecionados: number[]
  aoAlterar: (selecionados: number[]) => void
}

/** Lista marcável de montadores com busca — usada na equipe e na atribuição da obra. */
export function SelecaoMontadores({ montadores, selecionados, aoAlterar }: PropsSelecaoMontadores) {
  const [busca, setBusca] = useState('')
  const visiveis = filtrarPorNome(montadores, busca)

  return (
    <div className="space-y-12">
      <CampoTexto
        rotulo={`Montadores (${selecionados.length} selecionados)`}
        iconeEsquerda="search"
        placeholder="Buscar por nome…"
        valor={busca}
        aoAlterar={setBusca}
      />
      <div className="max-h-[320px] space-y-8 overflow-y-auto rounded-lg bg-surface-container-low p-16">
        {visiveis.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            {montadores.length === 0 ? 'Nenhum montador ativo cadastrado.' : 'Nenhum montador encontrado.'}
          </p>
        ) : (
          visiveis.map((montador) => (
            <Checkbox
              key={montador.id}
              rotulo={montador.nome}
              marcado={selecionados.includes(montador.id)}
              aoAlterar={() => aoAlterar(alternarSelecao(selecionados, montador.id))}
            />
          ))
        )}
      </div>
    </div>
  )
}
